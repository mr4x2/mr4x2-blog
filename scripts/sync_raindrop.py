#!/usr/bin/env python3
"""Copy the Raindrop Reading collection into data/reading.json."""

import argparse
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

API = "https://api.raindrop.io/rest/v1/raindrops/{id}?perpage=50&page={page}&sort=-created"
PER_PAGE = 50
VIETNAM = ZoneInfo("Asia/Ho_Chi_Minh")
DEFAULT_OUTPUT = "data/reading.json"


class SyncError(Exception):
    pass


def _created(item):
    raw = item.get("created")
    if not isinstance(raw, str):
        raise SyncError(f"item {item.get('_id')} has no created date")
    try:
        # fromisoformat only accepts a trailing "Z" from Python 3.11
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise SyncError(f"item {item.get('_id')} has a bad created date: {raw!r}")


def _tags(raw_tags):
    seen = []
    for tag in raw_tags or []:
        tag = str(tag).strip().lower()
        if tag and tag not in seen:
            seen.append(tag)
    return seen


def to_entry(item):
    url = item.get("link") or ""
    if not url.startswith(("http://", "https://")):
        return None
    return {
        "title": (item.get("title") or "").strip() or url,
        "url": url,
        "site": item.get("domain") or "",
        "date": _created(item).astimezone(VIETNAM).strftime("%Y-%m-%d"),
        "tags": _tags(item.get("tags")),
        "note": (item.get("note") or "").strip(),
        "excerpt": (item.get("excerpt") or "").strip(),
    }


def fetch_all(get_page):
    items = []
    page = 0
    while True:
        data = get_page(page)
        if data.get("result") is not True:
            raise SyncError(f"Raindrop said result=false: {data.get('errorMessage')}")
        batch = data.get("items") or []
        items.extend(batch)
        if len(batch) < PER_PAGE:
            return items
        page += 1


def build_entries(items):
    ordered = sorted(items, key=lambda i: (_created(i), i.get("_id", 0)), reverse=True)
    entries = (to_entry(i) for i in ordered)
    return [e for e in entries if e is not None]


def render(entries):
    return json.dumps(entries, ensure_ascii=False, indent=2) + "\n"


def check_not_wiping(old_text, entries):
    if not entries and old_text is not None and old_text.strip() not in ("", "[]"):
        raise SyncError("Raindrop returned no bookmarks but the current file has some; refusing to wipe it")


def make_get_page(token, collection_id):
    def get_page(page):
        req = urllib.request.Request(
            API.format(id=collection_id, page=page),
            headers={"Authorization": f"Bearer {token}", "User-Agent": "reading-sync/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise SyncError(f"Raindrop request failed: HTTP {e.code}")
        except urllib.error.URLError as e:
            raise SyncError(f"Raindrop request failed: {e.reason}")
        except json.JSONDecodeError:
            raise SyncError("Raindrop returned malformed JSON")

    return get_page


def write_atomically(path, text):
    directory = os.path.dirname(os.path.abspath(path))
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".reading-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    args = parser.parse_args(argv)

    token = os.environ.get("RAINDROP_TOKEN")
    collection_id = os.environ.get("RAINDROP_COLLECTION_ID")
    missing = [n for n, v in (("RAINDROP_TOKEN", token), ("RAINDROP_COLLECTION_ID", collection_id)) if not v]
    if missing:
        print(f"missing environment variable(s): {', '.join(missing)}", file=sys.stderr)
        return 2
    # Raindrop reads 0 as every bookmark and -1 as Unsorted, which would publish private ones.
    if not (collection_id.isdigit() and int(collection_id) > 0):
        print("RAINDROP_COLLECTION_ID must be the Reading collection's numeric ID", file=sys.stderr)
        return 2

    try:
        entries = build_entries(fetch_all(make_get_page(token, collection_id)))
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

    print(f"{len(entries)} bookmarks, {'changed' if changed else 'unchanged'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
