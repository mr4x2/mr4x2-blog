#!/usr/bin/env python3
"""Log in to Spotify once and print the refresh token the daily sync needs."""

import base64
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
REDIRECT_URI = "http://127.0.0.1:8888/callback"
SCOPE = "user-top-read"


class AuthError(Exception):
    pass


def authorize_url(client_id, state):
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": SCOPE,
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def code_from_redirect(pasted, state):
    params = urllib.parse.parse_qs(urllib.parse.urlparse(pasted.strip()).query)
    if params.get("state") != [state]:
        raise AuthError("the state in the address does not match this login; start again")
    if "error" in params:
        raise AuthError(f"Spotify refused the login: {params['error'][0]}")
    if "code" not in params:
        raise AuthError("the address has no code; paste the full address the browser ended on")
    return params["code"][0]


def exchange_code(client_id, client_secret, code):
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=urllib.parse.urlencode(
            {"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI}
        ).encode(),
        method="POST",
        headers={"Authorization": f"Basic {basic}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        raise AuthError(f"Spotify token request failed: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise AuthError(f"Spotify token request failed: {e.reason}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise AuthError("Spotify returned malformed JSON")
    token = data.get("refresh_token") if isinstance(data, dict) else None
    if not token:
        raise AuthError("Spotify returned no refresh token")
    return token


def main():
    client_id = os.environ.get("SPOTIFY_CLIENT_ID")
    client_secret = os.environ.get("SPOTIFY_CLIENT_SECRET")
    missing = [n for n, v in (("SPOTIFY_CLIENT_ID", client_id), ("SPOTIFY_CLIENT_SECRET", client_secret)) if not v]
    if missing:
        print(f"missing environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 2

    state = secrets.token_urlsafe(16)
    print("Open this address in a browser and log in:\n")
    print(authorize_url(client_id, state))
    print("\nThe browser then lands on a 127.0.0.1 page that may fail to load. That is fine.")
    pasted = input("Paste that page's full address here: ")

    try:
        refresh_token = exchange_code(client_id, client_secret, code_from_redirect(pasted, state))
    except AuthError as e:
        print(f"login failed: {e}", file=sys.stderr)
        return 1

    print(f"\nRefresh token (shown once):\n\n{refresh_token}\n")
    print("Store it in two places:")
    print("  1. GitHub: gh secret set SPOTIFY_REFRESH_TOKEN   (paste it when asked)")
    print(f"  2. Local runs: add this line to .env\n     SPOTIFY_REFRESH_TOKEN={refresh_token}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
