import base64
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import sync_top_tracks as stt

TOKEN_URL = "https://accounts.spotify.com/api/token"
TRACKS_URL = "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5"

TRACK = {
    "name": "Holocene",
    "artists": [{"name": "Bon Iver"}],
    "external_urls": {"spotify": "https://open.spotify.com/track/abc"},
    "album": {"name": "Bon Iver"},
    "popularity": 70,
    "duration_ms": 336000,
}
ENTRY = {"title": "Holocene", "artists": ["Bon Iver"], "url": "https://open.spotify.com/track/abc"}
SECRETS = ("csecret", "rtoken", "atoken")
ENV = {"SPOTIFY_CLIENT_ID": "cid", "SPOTIFY_CLIENT_SECRET": "csecret", "SPOTIFY_REFRESH_TOKEN": "rtoken"}
TOKEN_OK = {"access_token": "atoken", "token_type": "Bearer", "expires_in": 3600}
OLD = '[{"title": "keep me"}]\n'


def track(**over):
    return {**TRACK, **over}


def http_error(url, code, body=b""):
    return urllib.error.HTTPError(url, code, "error", {}, io.BytesIO(body))


def run_main(out, *responses, env=ENV):
    replies = iter(responses)
    requests = []

    def urlopen(req, timeout=None):
        requests.append(req)
        reply = next(replies)
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, bytes):
            return io.BytesIO(reply)
        return io.BytesIO(json.dumps(reply).encode())

    stdout, stderr = io.StringIO(), io.StringIO()
    with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(
        stt.urllib.request, "urlopen", side_effect=urlopen
    ), redirect_stdout(stdout), redirect_stderr(stderr):
        code = stt.main(["--output", out])
    return code, stdout.getvalue(), stderr.getvalue(), requests


class ToEntryTests(unittest.TestCase):
    def test_to_entry_maps_only_title_artists_url(self):
        self.assertEqual(stt.to_entry(TRACK), ENTRY)

    def test_to_entry_keeps_every_artist_in_order(self):
        e = stt.to_entry(track(artists=[{"name": "A"}, {"name": "B"}]))
        self.assertEqual(e["artists"], ["A", "B"])

    def test_track_without_spotify_url_is_skipped(self):
        self.assertIsNone(stt.to_entry(track(external_urls={})))
        self.assertIsNone(stt.to_entry(track(is_local=True, external_urls={})))


class BuildAndRenderTests(unittest.TestCase):
    def test_build_entries_keeps_spotify_order(self):
        second = track(name="Re: Stacks", external_urls={"spotify": "https://open.spotify.com/track/def"})
        local = track(name="Demo", is_local=True, external_urls={})
        self.assertEqual(
            [e["title"] for e in stt.build_entries([TRACK, local, second])],
            ["Holocene", "Re: Stacks"],
        )

    def test_render_keeps_unicode(self):
        entries = [{"title": 'Tiếng Việt & "x"', "artists": ["Đen"], "url": "https://open.spotify.com/track/v"}]
        text = stt.render(entries)
        self.assertIn("Tiếng Việt", text)
        self.assertTrue(text.endswith("\n"))
        self.assertEqual(text, stt.render(entries))
        self.assertEqual(json.loads(text), entries)

    def test_check_not_wiping(self):
        with self.assertRaises(stt.SyncError):
            stt.check_not_wiping('[{"title": "x"}]', [])
        for old in (None, "", "[]", "[]\n"):
            stt.check_not_wiping(old, [])


class MainTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = tmp.name
        self.out = os.path.join(self.dir, "top_tracks.json")

    def write_old(self):
        with open(self.out, "w", encoding="utf-8") as f:
            f.write(OLD)
        return os.stat(self.out)

    def assert_untouched(self, before):
        with open(self.out, encoding="utf-8") as f:
            self.assertEqual(f.read(), OLD)
        after = os.stat(self.out)
        self.assertEqual((after.st_ino, after.st_mtime_ns), (before.st_ino, before.st_mtime_ns))
        self.assertEqual(os.listdir(self.dir), ["top_tracks.json"])

    def assert_no_secret(self, *outputs):
        for secret in SECRETS:
            for text in outputs:
                self.assertNotIn(secret, text)

    def test_success_writes_file_and_requests_right_urls(self):
        code, stdout, stderr, requests = run_main(self.out, TOKEN_OK, {"items": [TRACK]})
        self.assertEqual(code, 0, stderr)
        with open(self.out, encoding="utf-8") as f:
            self.assertEqual(f.read(), stt.render([ENTRY]))
        self.assertIn("1 top tracks, changed", stdout)

        token_req, tracks_req = requests
        self.assertEqual(token_req.full_url, TOKEN_URL)
        self.assertEqual(token_req.get_method(), "POST")
        self.assertEqual(
            urllib.parse.parse_qs(token_req.data.decode()),
            {"grant_type": ["refresh_token"], "refresh_token": ["rtoken"]},
        )
        self.assertEqual(
            token_req.get_header("Authorization"),
            "Basic " + base64.b64encode(b"cid:csecret").decode(),
        )
        self.assertEqual(tracks_req.full_url, TRACKS_URL)
        self.assertEqual(tracks_req.get_header("Authorization"), "Bearer atoken")
        self.assert_no_secret(stdout, stderr)

    def test_repeat_run_leaves_file_alone(self):
        run_main(self.out, TOKEN_OK, {"items": [TRACK]})
        first = os.stat(self.out)
        code, stdout, _, _ = run_main(self.out, TOKEN_OK, {"items": [TRACK]})
        self.assertEqual(code, 0)
        self.assertIn("unchanged", stdout)
        again = os.stat(self.out)
        self.assertEqual((again.st_ino, again.st_mtime_ns), (first.st_ino, first.st_mtime_ns))

    def test_invalid_grant_says_how_to_fix(self):
        before = self.write_old()
        error = http_error(TOKEN_URL, 400, b'{"error": "invalid_grant", "error_description": "Refresh token revoked"}')
        code, stdout, stderr, requests = run_main(self.out, error)
        self.assertEqual(code, 1)
        self.assertIn("scripts/spotify_auth.py", stderr)
        self.assertIn("SPOTIFY_REFRESH_TOKEN", stderr)
        self.assertEqual(len(requests), 1)
        self.assert_untouched(before)
        self.assert_no_secret(stdout, stderr)

    def test_forbidden_mentions_premium_and_user_management(self):
        before = self.write_old()
        code, stdout, stderr, _ = run_main(self.out, TOKEN_OK, http_error(TRACKS_URL, 403))
        self.assertEqual(code, 1)
        self.assertIn("Premium", stderr)
        self.assertIn("User Management", stderr)
        self.assert_untouched(before)
        self.assert_no_secret(stdout, stderr)

    def test_other_http_error_leaves_file_untouched(self):
        before = self.write_old()
        for error in (http_error(TRACKS_URL, 429), http_error(TRACKS_URL, 503)):
            with self.subTest(code=error.code):
                code, stdout, stderr, _ = run_main(self.out, TOKEN_OK, error)
                self.assertEqual(code, 1)
                self.assertIn(f"HTTP {error.code}", stderr)
                self.assert_untouched(before)
                self.assert_no_secret(stdout, stderr)

    def test_network_error_leaves_file_untouched(self):
        before = self.write_old()
        code, stdout, stderr, _ = run_main(self.out, urllib.error.URLError("timed out"))
        self.assertEqual(code, 1)
        self.assertIn("timed out", stderr)
        self.assert_untouched(before)

    def test_token_response_without_access_token_fails(self):
        before = self.write_old()
        for reply in ({}, b"not json"):
            with self.subTest(reply=reply):
                code, stdout, stderr, requests = run_main(self.out, reply)
                self.assertEqual(code, 1)
                self.assertEqual(len(requests), 1)
                self.assert_untouched(before)
                self.assert_no_secret(stdout, stderr)

    def test_malformed_tracks_response_fails(self):
        before = self.write_old()
        for reply in (b"not json", {"items": "nope"}):
            with self.subTest(reply=reply):
                code, _, _, _ = run_main(self.out, TOKEN_OK, reply)
                self.assertEqual(code, 1)
                self.assert_untouched(before)

    def test_empty_result_never_wipes_existing_list(self):
        before = self.write_old()
        code, _, stderr, _ = run_main(self.out, TOKEN_OK, {"items": []})
        self.assertEqual(code, 1)
        self.assert_untouched(before)

    def test_empty_result_over_missing_file_writes_empty_list(self):
        code, _, _, _ = run_main(self.out, TOKEN_OK, {"items": []})
        self.assertEqual(code, 0)
        with open(self.out, encoding="utf-8") as f:
            self.assertEqual(f.read(), "[]\n")

    def test_missing_env_exits_2_without_network(self):
        for name in ENV:
            with self.subTest(missing=name):
                env = {k: v for k, v in ENV.items() if k != name}
                code, _, stderr, requests = run_main(self.out, env=env)
                self.assertEqual(code, 2)
                self.assertIn(name, stderr)
                self.assertEqual(requests, [])
                self.assertFalse(os.path.exists(self.out))

    def test_new_refresh_token_is_noted_not_printed(self):
        code, stdout, stderr, _ = run_main(self.out, {**TOKEN_OK, "refresh_token": "newsecret"}, {"items": [TRACK]})
        self.assertEqual(code, 0)
        self.assertIn("new refresh token", stderr)
        self.assertNotIn("newsecret", stdout + stderr)


if __name__ == "__main__":
    unittest.main()
