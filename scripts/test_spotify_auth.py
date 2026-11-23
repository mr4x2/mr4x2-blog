import base64
import io
import json
import os
import sys
import unittest
import urllib.parse
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import spotify_auth as sa

GOOD = "http://127.0.0.1:8888/callback?code=abc&state=st"


class AuthorizeUrlTests(unittest.TestCase):
    def test_authorize_url_params(self):
        parts = urllib.parse.urlparse(sa.authorize_url("cid", "st"))
        self.assertEqual(parts.netloc, "accounts.spotify.com")
        self.assertEqual(parts.path, "/authorize")
        self.assertEqual(
            urllib.parse.parse_qs(parts.query),
            {
                "client_id": ["cid"],
                "response_type": ["code"],
                "redirect_uri": [sa.REDIRECT_URI],
                "scope": ["user-top-read"],
                "state": ["st"],
            },
        )


class CodeFromRedirectTests(unittest.TestCase):
    def test_code_from_redirect_returns_code(self):
        self.assertEqual(sa.code_from_redirect(GOOD, "st"), "abc")

    def test_code_from_redirect_strips_whitespace(self):
        self.assertEqual(sa.code_from_redirect(f"  {GOOD}\n", "st"), "abc")

    def test_state_mismatch_raises(self):
        with self.assertRaises(sa.AuthError):
            sa.code_from_redirect(GOOD, "other")

    def test_denied_raises_with_spotify_error(self):
        with self.assertRaises(sa.AuthError) as ctx:
            sa.code_from_redirect("http://127.0.0.1:8888/callback?error=access_denied&state=st", "st")
        self.assertIn("access_denied", str(ctx.exception))

    def test_missing_code_raises(self):
        with self.assertRaises(sa.AuthError):
            sa.code_from_redirect("http://127.0.0.1:8888/callback?state=st", "st")


class ExchangeCodeTests(unittest.TestCase):
    def exchange(self, reply):
        requests = []

        def urlopen(req, timeout=None):
            requests.append(req)
            return io.BytesIO(json.dumps(reply).encode())

        with mock.patch.object(sa.urllib.request, "urlopen", side_effect=urlopen):
            return sa.exchange_code("cid", "csecret", "abc"), requests

    def test_exchange_code_posts_auth_code_grant(self):
        token, (req,) = self.exchange({"access_token": "a", "refresh_token": "r"})
        self.assertEqual(token, "r")
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(
            urllib.parse.parse_qs(req.data.decode()),
            {"grant_type": ["authorization_code"], "code": ["abc"], "redirect_uri": [sa.REDIRECT_URI]},
        )
        self.assertEqual(
            req.get_header("Authorization"),
            "Basic " + base64.b64encode(b"cid:csecret").decode(),
        )

    def test_exchange_without_refresh_token_raises(self):
        with self.assertRaises(sa.AuthError):
            self.exchange({"access_token": "a"})


if __name__ == "__main__":
    unittest.main()
