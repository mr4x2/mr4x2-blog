# Raindrop sync

The author's sync command (new in #15) copies the Reading collection from Raindrop into `data/reading.json`. It writes the file only when something changed, never wipes a non-empty list with an empty one, and exits non-zero on any API problem without printing the token. The hourly GitHub Action runs the same command.

## Sub-features

- `sync-happy` writes every Bookmark in the collection, newest first, and prints `N bookmarks, changed`.
- `sync-unchanged` leaves the file untouched (mtime and `git diff`) on a second run, which prints `N bookmarks, unchanged`.
- `sync-bad-token` exits 1, names HTTP 401, writes nothing, and never shows the token.
- `sync-missing-env` exits 2, naming the missing variable.
- `sync-wipe-guard` refuses to replace a non-empty file with an empty result. This is covered by the unit tests only (see Gotchas).
- `sync-tests` passes the unit test suite.

## How to get to it (user POV)

- From a terminal at the repo root: `set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py`.
- On GitHub: Actions → "Sync reading" → Run workflow. That runs on production; see `deploy.md`.

## Driving it with the CLI

Preconditions:

- `.env` has a working `RAINDROP_TOKEN` (a Raindrop **Test token**) and `RAINDROP_COLLECTION_ID=77506144`. A quick check: `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $RAINDROP_TOKEN" https://api.raindrop.io/rest/v1/user` prints `200`.
- `RUN_ID` is an existing run (no instance is needed), and `E=.verify/runs/$RUN_ID/sync`, created with `mkdir -p`.

- **Tests.** `python3 -m unittest discover -s scripts -v >$E/tests.txt 2>&1; echo $? >$E/tests.exit`. The exit code is `0`, and the output ends with `OK`.
- **Happy path to a scratch file.** `(set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py --output $E/reading.json) >$E/happy.out 2>$E/happy.err; echo $? >$E/happy.exit`. The exit code is `0`, and stdout is `N bookmarks, changed`. `python3 -c "import json;d=json.load(open('$E/reading.json'));print(len(d), sorted(d[0]))"` prints N and `['date','excerpt','note','site','tags','title','url']`. N equals the collection `count` from `GET /rest/v1/collection/$RAINDROP_COLLECTION_ID`.
- **Unchanged.** Run the same command again. It prints `N bookmarks, unchanged`, and `stat -c %Y` on the file is the same before and after.
- **Bad token.** `RAINDROP_TOKEN=00000000-0000-0000-0000-000000000000 RAINDROP_COLLECTION_ID=77506144 python3 scripts/sync_raindrop.py --output $E/bad.json`. The exit code is `1`, stderr mentions `401`, and `$E/bad.json` doesn't exist. Grepping stderr for the real token finds nothing.
- **Missing settings.** `env -u RAINDROP_TOKEN RAINDROP_COLLECTION_ID=1 python3 scripts/sync_raindrop.py --output $E/none.json`. The exit code is `2`, and stderr names `RAINDROP_TOKEN`.
- **Into the repo** (when the journey is to update the page). Run without `--output`, then `git diff --stat data/reading.json` shows the change. Check the result with the `reading.md` journeys.
- **Proof.** Keep the `.out`, `.err` and `.exit` files and the scratch JSON in `$E`.

## Gotchas

- Never `cat` `.env` or echo `$RAINDROP_TOKEN`. Check it by HTTP status only.
- The Client ID (24 hex characters) and the Client secret are *not* API credentials. Only the Test token works as the Bearer token.
- The wipe guard can't be triggered against the real API without emptying the collection, so it is proven by `test_check_not_wiping`. Report it as "unit-tested only".
- Sub-collections of the Reading collection aren't fetched by `raindrops/{id}`. If the author starts using them, this map and the script both need updating.
- Raindrop allows 120 API calls a minute. Each sync uses one call per 50 Bookmarks.
