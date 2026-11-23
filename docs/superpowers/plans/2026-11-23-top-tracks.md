# Top tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the author's 5 Spotify Top tracks on the home page, refreshed daily by a GitHub Action, with no live data and no times.

**Architecture:** A stdlib Python sync script trades a stored refresh token for an access token, reads `/me/top/tracks`, and writes `data/top_tracks.json`. A daily workflow commits the file through a shared `scripts/commit_data.sh` and dispatches the normal deploy. A Hugo partial renders the list at build time and joins the home page's existing `.reveal` entrance.

**Tech Stack:** Python 3 stdlib + `unittest`, Bash, GitHub Actions, Hugo templates, Tailwind CSS 4 (`assets/css/input.css`), the verify skill's `drive.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-23-top-tracks-design.md`

## Global Constraints

- Python standard library only. Tests are `unittest` files in `scripts/`, run by `python3 -m unittest discover -s scripts -v`.
- Spotify values: token URL `https://accounts.spotify.com/api/token`; tracks URL `https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5`; scope `user-top-read`; redirect `http://127.0.0.1:8888/callback`.
- Env and secret names: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`.
- Each entry in `data/top_tracks.json` is exactly `{"title", "artists", "url"}`. No time, count or fetch date anywhere.
- No token or secret is ever printed, logged or written to the data file.
- The workflow cron is `'0 20 * * *'`. The commit message is `chore(music): sync top tracks`.
- CLAUDE.md "Visual rules" 1–10 and "Avoid slop" 1–5 apply, and `.claude/skills/verify-mr4x2-blog/scripts/slop-check.sh` must print nothing.
- `hugo --gc` passes with the data file present, `[]`, and missing.
- Commits: conventional prefix, no emoji, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A new, untracked data file must still get committed by `commit_data.sh`, because `git diff` ignores untracked paths. Test: `test_commits_a_new_untracked_file` (Task 3).
2. Spotify answering 429 or 5xx: exit 1, file untouched. Test: `test_other_http_error_leaves_file_untouched` (Task 1).
3. A track title with `&`, quotes or Vietnamese: kept as UTF-8 in the JSON, escaped in the HTML. Tests: `test_render_keeps_unicode` (Task 1) and fixture rows checked in `home-tracks.json` (Task 4).
4. A pasted redirect with surrounding whitespace or a trailing newline still parses. Test: `test_code_from_redirect_strips_whitespace` (Task 2).
5. A token response that is 200 but has no `access_token`, or isn't JSON: SyncError, file untouched. Test: `test_token_response_without_access_token_fails` (Task 1).

---

### Task 1: Sync script

**Files:**
- Create: `scripts/sync_top_tracks.py`, `scripts/test_sync_top_tracks.py`, `data/top_tracks.json` (contents `[]\n`)

**Interfaces:**
- Consumes: `write_atomically(path, text)` from `scripts/sync_raindrop.py` (import it, don't copy it).
- Produces: CLI `python3 scripts/sync_top_tracks.py [--output PATH]`. Exit 0 prints `N top tracks, changed|unchanged`. Exit 1 prints `sync failed: <reason>` to stderr. Exit 2 means missing env. Module API: `SyncError`, `to_entry(track: dict) -> dict | None`, `build_entries(items: list) -> list`, `render(entries: list) -> str`, `check_not_wiping(old_text: str | None, entries: list) -> None`, `refresh_access_token(client_id, client_secret, refresh_token) -> str`, `fetch_top_tracks(access_token) -> list`, `main(argv=None) -> int`.

- [ ] **Step 1: Write the failing tests** in `scripts/test_sync_top_tracks.py`, in the style of `test_sync_raindrop.py`: patch `stt.urllib.request.urlopen` with a fake that returns queued responses or raises queued errors, and record each `Request`. A `run_main(out, *responses, env=ENV)` helper returns `(code, stdout, stderr, requests)`.

```python
TRACK = {"name": "Holocene", "artists": [{"name": "Bon Iver"}],
         "external_urls": {"spotify": "https://open.spotify.com/track/abc"},
         "album": {"name": "Bon Iver"}, "popularity": 70, "duration_ms": 336000}
ENV = {"SPOTIFY_CLIENT_ID": "cid", "SPOTIFY_CLIENT_SECRET": "csecret", "SPOTIFY_REFRESH_TOKEN": "rtoken"}
TOKEN_OK = {"access_token": "atoken", "token_type": "Bearer", "expires_in": 3600}

test_to_entry_maps_only_title_artists_url:   to_entry(TRACK) == {"title": "Holocene", "artists": ["Bon Iver"], "url": "https://open.spotify.com/track/abc"}
test_to_entry_keeps_every_artist_in_order:   artists [A, B] -> ["A", "B"]
test_track_without_spotify_url_is_skipped:   external_urls {} -> None; is_local True with no url -> None
test_build_entries_keeps_spotify_order:      [t1, local, t2] -> [e1, e2]
test_render_keeps_unicode:                   render([{"title": "Tiếng Việt & \"x\"", ...}]) contains "Tiếng Việt", ends with "\n", equal on two calls
test_check_not_wiping:                       ([] over "[...]") raises; ([] over None / "" / "[]") passes
test_success_writes_file_and_requests_right_urls:
    responses TOKEN_OK, {"items": [TRACK]} -> code 0, file == render([entry]);
    request 0: url == token URL, method POST, body has grant_type=refresh_token&refresh_token=rtoken,
               Authorization == "Basic " + b64("cid:csecret");
    request 1: full_url == tracks URL, Authorization == "Bearer atoken"
test_repeat_run_leaves_file_alone:           second identical run prints "unchanged", same inode and mtime
test_invalid_grant_says_how_to_fix:          HTTPError 400 with body {"error": "invalid_grant"} -> code 1,
                                             stderr contains "scripts/spotify_auth.py" and "SPOTIFY_REFRESH_TOKEN", file untouched
test_forbidden_mentions_premium_and_user_management:  token OK, API HTTPError 403 -> stderr contains "Premium" and "User Management"
test_other_http_error_leaves_file_untouched: API HTTPError 429 -> code 1, stderr contains "HTTP 429", file untouched
test_token_response_without_access_token_fails: 200 {} and 200 b"not json" -> code 1, file untouched
test_empty_result_never_wipes_existing_list: {"items": []} over a non-empty file -> code 1, untouched
test_empty_result_over_missing_file_writes_empty_list: -> code 0, file == "[]\n"
test_missing_env_exits_2_without_network:    each var removed in turn -> code 2, no request made
test_new_refresh_token_is_noted_not_printed: TOKEN_OK + {"refresh_token": "newsecret"} -> code 0, "new refresh token" in stderr, "newsecret" not in stdout+stderr
test_no_secret_in_any_output:                across the failure tests, none of "csecret", "rtoken", "atoken" appear in stdout or stderr
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python3 -m unittest scripts/test_sync_top_tracks.py -v`
Expected: ERROR, `ModuleNotFoundError: No module named 'sync_top_tracks'`.

- [ ] **Step 3: Implement `scripts/sync_top_tracks.py`.** Its shape follows `sync_raindrop.py`: module docstring, `DEFAULT_OUTPUT = "data/top_tracks.json"`, and `render` = `json.dumps(entries, ensure_ascii=False, indent=2) + "\n"`. Send a `User-Agent: top-tracks-sync/1.0` header and a 30 s timeout. Parse `invalid_grant` from the HTTPError body (`e.read()`) of the token endpoint. Compare old and new text so an unchanged list never rewrites the file. Then write `[]\n` to `data/top_tracks.json`.

- [ ] **Step 4: Run all script tests**

Run: `python3 -m unittest discover -s scripts -v`
Expected: all pass, Raindrop tests included.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync_top_tracks.py scripts/test_sync_top_tracks.py data/top_tracks.json
git commit -m "feat(music): sync Spotify top tracks into data/top_tracks.json"
```

### Task 2: One-time login script

**Files:**
- Create: `scripts/spotify_auth.py`, `scripts/test_spotify_auth.py`

**Interfaces:**
- Produces: CLI `python3 scripts/spotify_auth.py`, which reads `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (exit 2 if missing). Module API: `REDIRECT_URI = "http://127.0.0.1:8888/callback"`, `AuthError`, `authorize_url(client_id: str, state: str) -> str`, `code_from_redirect(pasted: str, state: str) -> str`, `exchange_code(client_id, client_secret, code) -> str` (the refresh token), `main() -> int`.

- [ ] **Step 1: Write the failing tests**

```python
test_authorize_url_params:  parse_qs(urlparse(authorize_url("cid", "st")).query) ==
    {"client_id": ["cid"], "response_type": ["code"], "redirect_uri": [REDIRECT_URI], "scope": ["user-top-read"], "state": ["st"]}
    and the host is accounts.spotify.com, path /authorize
test_code_from_redirect_returns_code:      "http://127.0.0.1:8888/callback?code=abc&state=st" -> "abc"
test_code_from_redirect_strips_whitespace: "  http://...?code=abc&state=st\n" -> "abc"
test_state_mismatch_raises:                state=other -> AuthError
test_denied_raises_with_spotify_error:     "?error=access_denied&state=st" -> AuthError whose message contains "access_denied"
test_missing_code_raises:                  "?state=st" -> AuthError
test_exchange_code_posts_auth_code_grant:  mocked urlopen returns {"access_token": "a", "refresh_token": "r"} -> "r";
    body has grant_type=authorization_code, code=abc, redirect_uri=REDIRECT_URI; Authorization == "Basic " + b64("cid:csecret")
test_exchange_without_refresh_token_raises: {"access_token": "a"} -> AuthError
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python3 -m unittest scripts/test_spotify_auth.py -v`
Expected: ERROR, `ModuleNotFoundError`.

- [ ] **Step 3: Implement `scripts/spotify_auth.py`.** `main` makes `state = secrets.token_urlsafe(16)`, prints the URL, and asks for the browser's address after login with `input()`. It then prints the refresh token once, with two next steps: `gh secret set SPOTIFY_REFRESH_TOKEN` (paste it when asked) and the `.env` line. On `AuthError` it prints `login failed: <reason>` and returns 1.

- [ ] **Step 4: Run all script tests**

Run: `python3 -m unittest discover -s scripts -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/spotify_auth.py scripts/test_spotify_auth.py
git commit -m "feat(music): add the one-time Spotify login script"
```

### Task 3: Shared commit step and the daily workflow

**Files:**
- Create: `scripts/commit_data.sh` (executable), `scripts/test_commit_data.py`, `.github/workflows/sync-top-tracks.yml`
- Modify: `.github/workflows/sync-reading.yml` (the "Commit and deploy" step), `CLAUDE.md` (new "Top tracks" section after "Reading page")

**Interfaces:**
- Consumes: Task 1's CLI.
- Produces: `scripts/commit_data.sh <path> <message>`. It exits 0 when the file is unchanged or was pushed, and 1 after 5 rejected pushes. When it pushed and `$GITHUB_OUTPUT` is set, it appends `pushed=true` to it. It sets the `github-actions[bot]` identity itself. It never calls `gh`: the workflow dispatches `hugo.yml` in its own step, `if: steps.commit.outputs.pushed == 'true'`.

- [ ] **Step 1: Write the failing tests** in `scripts/test_commit_data.py`. Each test makes a bare repo with one commit on `main` that holds `data/x.json`, clones it into a temp directory, edits the clone, and runs the script there with `GITHUB_OUTPUT` pointing at a temp file.

```python
test_unchanged_file_exits_0_without_commit:  origin main sha unchanged, output file has no "pushed=true"
test_changed_file_is_committed_and_pushed:   origin main has a new commit with the message and the new contents, output has "pushed=true"
test_commits_a_new_untracked_file:           data/new.json untracked in the clone -> pushed to origin
test_rebases_onto_a_newer_main:              another clone pushes an unrelated commit first -> both commits on origin main, ours on top
```

- [ ] **Step 2: Run them to verify they fail**

Run: `python3 -m unittest scripts/test_commit_data.py -v`
Expected: FAIL, the script doesn't exist.

- [ ] **Step 3: Implement `scripts/commit_data.sh`** with `set -euo pipefail`. Move the loop out of `sync-reading.yml`: copy the file aside, then up to 5 times fetch, reset to `origin/main`, copy the file back, and commit and push if it changed. Every "changed" check uses `git status --porcelain -- "$path"`, never `git diff`, so a new file counts (Review Focus 1). Then:
  - **`sync-reading.yml`:** replace its step with `id: commit`, running `scripts/commit_data.sh data/reading.json "chore(reading): sync from Raindrop"`, plus a dispatch step with `GH_TOKEN: ${{ github.token }}` running `gh workflow run hugo.yml --ref main`.
  - **`sync-top-tracks.yml`:** the same shape with name `Sync top tracks`, `cron: '0 20 * * *'` plus `workflow_dispatch`, `permissions: contents: write, actions: write`, and `concurrency: sync-top-tracks`. It runs the tests, then the sync with the three secrets, then the commit with the Global Constraints message.
  - **CLAUDE.md "Top tracks" section:** cover the data flow (Spotify → daily workflow → `data/top_tracks.json` → `hugo.yml` → Watchtower), that the file is generated, the local run (`set -a; . ./.env; set +a; python3 scripts/sync_top_tracks.py`), the tests, and the re-login every 6 months with `scripts/spotify_auth.py` plus `gh secret set SPOTIFY_REFRESH_TOKEN`. Note that the home page never shows times and why. Add one line under "Reading page" saying its commit step lives in `scripts/commit_data.sh`.

- [ ] **Step 4: Run the tests and lint the workflows**

Run: `python3 -m unittest discover -s scripts -v && bash -n scripts/commit_data.sh && python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/sync-*.yml`
Expected: all pass, no output from the last two commands. If PyYAML is missing, use `npx -y yaml-lint` or skip with a note.

- [ ] **Step 5: Commit**

```bash
git add scripts/commit_data.sh scripts/test_commit_data.py .github/workflows/sync-top-tracks.yml .github/workflows/sync-reading.yml CLAUDE.md
git commit -m "feat(music): sync top tracks daily, sharing the commit step with Reading"
```

### Task 4: Home page block and its verify coverage

**Files:**
- Create: `layouts/partials/home/top-tracks.html`, `.claude/skills/verify-mr4x2-blog/fixtures/top_tracks.json`, `.claude/skills/verify-mr4x2-blog/journeys/home-tracks.json`
- Modify: `layouts/index.html`, `layouts/partials/home/posts.html` (`--i: 1` → `2`, `add $i 2` → `add $i 3`), `assets/css/input.css` (components layer, next to `.posts`), `assets/css/output.css` (via `npm run build`), `.claude/skills/verify-mr4x2-blog/journeys/home.json` (line 6 selector), `.claude/skills/verify-mr4x2-blog/features/home.md`

**Interfaces:**
- Consumes: `site.Data.top_tracks` (Task 1's format).
- Produces: the markup `<section class="sec tracks reveal" style="--i: 1">` with `<p class="cmd">$ <b>top --tracks --last 4w</b></p>` and `<ol class="tracks-list">`. Each `<li>` holds `<span class="track-rank">01</span>`, `<a class="track-title" href target="_blank" rel="noopener">`, and `<span class="track-artists"> — A, B</span>`. Nothing is rendered when the data is missing or empty.

- [ ] **Step 1: Write the fixture and the failing journey.** The fixture has 5 entries: two artists on one, a long title on one, `Tiếng Việt` on one, `Rock & "Roll" <b>` on one, and one plain. `home-tracks.json` waits for the intro to end, then expects:

```
$('.who').nextElementSibling.matches('section.tracks')
$('.tracks .cmd').textContent.replace(/\s+/g,' ').trim() == "$ top --tracks --last 4w"
$$('.track-rank').map(t) == ["01","02","03","04","05"]
$$('.track-title').map(t) == fixture titles in order (the escaping row shows literal `<b>`)
the two-artist row's .track-artists text == "— A, B" (trimmed)
$$('.track-title').every(a => a.href.startsWith('https://open.spotify.com/') && a.target === '_blank' && a.rel.includes('noopener'))
!/\d{1,2}:\d{2}|\bago\b|\d{4}-\d{2}-\d{2}/.test($('.tracks').innerText)
[$('.tracks'), $('.sec:has(.tag-line)'), ...$$('.post')].map(e => e.style.getPropertyValue('--i').trim()) == ["1","2","3","4"]
a `.track-title:hover` (or `.tracks-list a:hover`) rule inside "(hover: hover) and (pointer: fine)" sets color var(--accent)  (read from the stylesheet, as motion.json does for .btn:hover)
shot "home-tracks"
```

Change `home.json` line 6 to `$('.sec:has(.tag-line) .cmd')`, so it holds whether or not the block renders.

- [ ] **Step 2: Run it to verify it fails**

Run: `rm -rf public && cp .claude/skills/verify-mr4x2-blog/fixtures/top_tracks.json data/top_tracks.json && V=.claude/skills/verify-mr4x2-blog/scripts && $V/verify.sh launch local`, then `node $V/drive.mjs --run RUN_ID --name home-tracks .claude/skills/verify-mr4x2-blog/journeys/home-tracks.json`
Expected: FAIL on the first `section.tracks` check.

- [ ] **Step 3: Implement the partial, the include, the index shift and the CSS.** In the partial, the rank is `printf "%02d" (add $i 1)` and the artists are `delimit .artists ", "`. In `index.html` the partial sits between `whoami` and `posts`. The CSS uses tokens only: the rank in `--font-mono`, `--fs-sm`, `--faint`; the title in `--ink`; the artists in `--muted`. Long titles wrap. The hover rule is `transition: color var(--dur-hover) ease`, with `color: var(--accent)` on hover, inside `@media (hover: hover) and (pointer: fine)`. Then run `npm run build`.

- [ ] **Step 4: Verify**

Run, with the fixture in place:
- `home-tracks.json`, plus the existing `home.json`, `home-intro.json`, `home-intro-blocked.json`, `home-reduced.json` and `home-nojs.json`.
- `home-tracks` again with `--dark`, with `--width 390 --height 844`, and with `--no-js`.

Expected: all pass. Look at the `home-tracks` screenshots in light, dark and phone width. Then put `[]` back (`git checkout -- data/top_tracks.json`), and check that `home.json` passes and `!$('.tracks')` holds. Then:
- `hugo --gc` passes with the file present, `[]`, and moved aside.
- `$V/verify.sh launch prod`, then `home-tracks` with the fixture, which checks the 0.154.5 build.
- `slop-check.sh` prints nothing.

Restore the data file and stop every run.

- [ ] **Step 5: Update `features/home.md`.** Add a `home-tracks` sub-feature line, the fixture recipe (copy over `data/top_tracks.json`, restore with `git checkout`, never commit it), the drive commands, and a gotcha: home checks must not assume the first `.sec` is the posts section.

- [ ] **Step 6: Commit**

```bash
git add layouts assets/css .claude/skills/verify-mr4x2-blog
git commit -m "feat(music): show Top tracks on the home page"
```

### Task 5: Ship

- [ ] **Step 1:** Run `python3 -m unittest discover -s scripts -v`, `hugo --gc`, and `slop-check.sh` once more on the final tree. Check that `git status` is clean and `data/top_tracks.json` is `[]`.
- [ ] **Step 2:** Push `feat/top-tracks` over HTTPS with the `gh` credential helper, and open a PR against `main` that links the spec. Its body lists the author-only setup (spec "Setup only I can do"), says the secrets must exist before merging, and lists the after-merge checks: dispatch `sync-top-tracks.yml` and `sync-reading.yml` once, watch the commit, `hugo.yml` and Watchtower, then check mr4x2.com.
