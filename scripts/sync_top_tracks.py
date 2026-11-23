#!/usr/bin/env python3
"""Copy the author's Spotify Top tracks into data/top_tracks.json."""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from sync_raindrop import write_atomically

TOKEN_URL = "https://accounts.spotify.com/api/token"
TRACKS_URL = "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5"
DEFAULT_OUTPUT = "data/top_tracks.json"
ENV_NAMES = ("SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REFRESH_TOKEN")
USER_AGENT = "top-tracks-sync/1.0"


class SyncError(Exception):
    pass


def to_entry(track):
    url = (track.get("external_urls") or {}).get("spotify") or ""
    if not url:
        return None
    return {
        "title": track.get("name") or "",
        "artists": [a["name"] for a in track.get("artists") or []],
        "url": url,
    }


def build_entries(items):
    entries = (to_entry(i) for i in items)
    return [e for e in entries if e is not None]


def render(entries):
    return json.dumps(entries, ensure_ascii=False, indent=2) + "\n"


def check_not_wiping(old_text, entries):
    if not entries and old_text is not None and old_text.strip() not in ("", "[]"):
        raise SyncError("Spotify returned no tracks but the current file has some; refusing to wipe it")


def _read_json(req, what):
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError:
        raise
    except urllib.error.URLError as e:
        raise SyncError(f"{what} request failed: {e.reason}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise SyncError(f"{what} returned malformed JSON")


def refresh_access_token(client_id, client_secret, refresh_token):
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": refresh_token}).encode(),
        method="POST",
        headers={"Authorization": f"Basic {basic}", "User-Agent": USER_AGENT},
    )
    try:
        data = _read_json(req, "Spotify token")
    except urllib.error.HTTPError as e:
        try:
            error = json.load(e).get("error")
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            error = None
        if error == "invalid_grant":
            raise SyncError(
                "the Spotify login expired or was revoked; run scripts/spotify_auth.py "
                "and update the SPOTIFY_REFRESH_TOKEN secret"
            )
        raise SyncError(f"Spotify token request failed: HTTP {e.code}")
    token = data.get("access_token") if isinstance(data, dict) else None
    if not token:
        raise SyncError("Spotify token response has no access_token")
    if data.get("refresh_token"):
        print("Spotify issued a new refresh token; the current one keeps working", file=sys.stderr)
    return token


def fetch_top_tracks(access_token):
    req = urllib.request.Request(
        TRACKS_URL,
        headers={"Authorization": f"Bearer {access_token}", "User-Agent": USER_AGENT},
    )
    try:
        data = _read_json(req, "Spotify")
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise SyncError(
                "Spotify answered HTTP 403; check that the app owner still has Premium "
                "and that the account is listed under the app's User Management"
            )
        raise SyncError(f"Spotify request failed: HTTP {e.code}")
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise SyncError("Spotify returned no items list")
    return items


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    env = {name: os.environ.get(name) for name in ENV_NAMES}
    missing = [name for name, value in env.items() if not value]
    if missing:
        print(f"missing environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 2

    try:
        token = refresh_access_token(*(env[name] for name in ENV_NAMES))
        entries = build_entries(fetch_top_tracks(token))
        try:
            with open(args.output, encoding="utf-8") as f:
                old_text = f.read()
        except FileNotFoundError:
            old_text = None
        check_not_wiping(old_text, entries)
        text = render(entries)
        changed = text != old_text
        if changed:
            write_atomically(args.output, text)
    except SyncError as e:
        print(f"sync failed: {e}", file=sys.stderr)
        return 1

    print(f"{len(entries)} top tracks, {'changed' if changed else 'unchanged'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
