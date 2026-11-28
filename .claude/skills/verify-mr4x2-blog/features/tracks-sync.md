# Top tracks sync

The author's second sync command copies their five Spotify Top tracks of the last 4 weeks into `data/top_tracks.json`, which the home page shows under `whoami`. Each entry is `{title, artists, url}` in Spotify's rank order, with no time, count or fetch date. It writes the file only when something changed, never wipes a non-empty list with an empty one, and exits non-zero on any API problem without printing a secret. The daily GitHub Action runs the same command. A one-time login script, `scripts/spotify_auth.py`, makes the refresh token the sync needs.

## Sub-features

- `tracks-happy` writes up to 5 tracks and prints `N top tracks, changed`.
- `tracks-unchanged` leaves the file untouched (mtime and `git diff`) on a second run, which prints `N top tracks, unchanged`.
- `tracks-missing-env` exits 2 with `missing environment variable(s): <names>` and makes no network call.
- `tracks-bad-login` exits 1 with `sync failed: …` and writes nothing. A wrong client gives `Spotify token request failed: HTTP 400`. An expired or revoked refresh token gives `the Spotify login expired or was revoked; run scripts/spotify_auth.py and update the SPOTIFY_REFRESH_TOKEN secret`. A 403 names Premium and the app's User Management.
- `tracks-wipe-guard` refuses to replace a non-empty file with an empty result: `Spotify returned no tracks but the current file has some; refusing to wipe it`. This is covered by the unit tests only (see Gotchas).
- `tracks-new-token` notes on stderr that Spotify issued a new refresh token, without printing it.
- `tracks-auth-missing-env` makes `spotify_auth.py` exit 2 when `SPOTIFY_CLIENT_ID` or `SPOTIFY_CLIENT_SECRET` is missing.
- `tracks-tests` passes the unit test suite.

## How to get to it (user POV)

- From a terminal at the repo root: `set -a; . ./.env; set +a; python3 scripts/sync_top_tracks.py`. Add `--output <file>` to write somewhere else.
- On GitHub: Actions → "Sync top tracks" → Run workflow. That runs on production; see `deploy.md`.
- When the login expires: `python3 scripts/spotify_auth.py`, then `gh secret set SPOTIFY_REFRESH_TOKEN`.

## Driving it with the CLI

Preconditions:

- `.env` has `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`. Check the names with `grep -oE '^[A-Z_]+=' .env`, never the values. `.env` is gitignored, so a git worktree has none. Source the main checkout's file by its full path in place of `./.env`.
- `RUN_ID` is an existing run (no instance is needed), and `E=.verify/runs/$RUN_ID/sync-tracks`, created with `mkdir -p`.

- **Tests.** `python3 -m unittest discover -s scripts -v >$E/tests.txt 2>&1; echo $? >$E/tests.exit`. The exit code is `0`, and the output ends with `OK`. The suite holds the Raindrop, Top tracks, login and `commit_data.sh` tests.
- **Happy path to a scratch file.** `(set -a; . ./.env; set +a; python3 scripts/sync_top_tracks.py --output $E/top_tracks.json) >$E/happy.out 2>$E/happy.err; echo $? >$E/happy.exit`. The exit code is `0`, and stdout is `N top tracks, changed` with N at most 5. `python3 -c "import json;d=json.load(open('$E/top_tracks.json'));print(len(d), sorted(d[0]))"` prints N and `['artists', 'title', 'url']`.
- **Unchanged.** Run the same command again. It prints `N top tracks, unchanged`, and `stat -c %Y` on the file is the same before and after. If the author listened in between, the ranks can move and it prints `changed`. That is not a failure.
- **Missing settings.** `(set -a; . ./.env; set +a; env -u SPOTIFY_REFRESH_TOKEN python3 scripts/sync_top_tracks.py --output $E/none.json)`. The exit code is `2`, stderr names `SPOTIFY_REFRESH_TOKEN`, and `$E/none.json` doesn't exist.
- **Bad login.** `env -u SPOTIFY_CLIENT_ID -u SPOTIFY_CLIENT_SECRET -u SPOTIFY_REFRESH_TOKEN SPOTIFY_CLIENT_ID=x SPOTIFY_CLIENT_SECRET=y SPOTIFY_REFRESH_TOKEN=z python3 scripts/sync_top_tracks.py --output $E/bad.json`. The exit code is `1`, stderr is `sync failed: Spotify token request failed: HTTP 400`, and `$E/bad.json` doesn't exist.
- **Login script settings.** `env -u SPOTIFY_CLIENT_ID -u SPOTIFY_CLIENT_SECRET python3 scripts/spotify_auth.py </dev/null`. The exit code is `2`, and stderr names both variables.
- **No secret in the output.** `(set -a; . ./.env; set +a; grep -lF -e "$SPOTIFY_REFRESH_TOKEN" -e "$SPOTIFY_CLIENT_SECRET" $E/*.out $E/*.err)` finds nothing.
- **Into the repo** (when the journey is to update the page). Run without `--output`, then `git diff --stat data/top_tracks.json` shows the change. Check the result with `home.json`, then put the committed file back with `git checkout -- data/top_tracks.json` unless the author asked to commit it.
- **Proof.** Keep the `.out`, `.err` and `.exit` files and the scratch JSON in `$E`.

## Gotchas

- Never `cat` `.env` or echo a `SPOTIFY_*` value. Check settings by name only.
- Never run the full `spotify_auth.py` login as proof. It is interactive, and on success it prints the new refresh token to the terminal. Its error paths are covered by `scripts/test_spotify_auth.py`.
- The wipe guard can't be triggered against the real API without the author's history going empty, so it is proven by `test_check_not_wiping` and `test_empty_result_never_wipes_existing_list`. Report it as "unit-tested only".
- The refresh token expires 6 months after the login. Until the author logs in again, the scheduled sync fails with the expired-login message and the site keeps the last list.
- The workflow's cron is `0 20 * * *` (03:00 Vietnam time), but GitHub starts scheduled runs late. From 2026-11-24 to 2026-11-28 they began between 02:30 and 04:40 UTC. A missing run at 20:00 UTC is not a failure.
- The request is `time_range=short_term&limit=5`, so the list holds at most 5 tracks. Spotify's "short term" is about the last 4 weeks, which is what the home page's `--last 4w` prompt says.
