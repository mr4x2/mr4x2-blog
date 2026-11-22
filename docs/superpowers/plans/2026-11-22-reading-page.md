# Reading Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/reading` lists every Bookmark in the Raindrop Reading collection, synced hourly into git and deployed automatically.

**Architecture:** A stdlib Python script pulls the collection from the Raindrop API and writes `data/reading.json`. A scheduled GitHub Action commits that file when it changes and dispatches the existing `hugo.yml` build, and Watchtower deploys the result. One Hugo layout renders the JSON, with inline vanilla JS for the filter.

**Tech Stack:** Python 3 (stdlib, `unittest`), Hugo (local 0.145, server image 0.154.5, CI `latest`), Tailwind v4 (`npm run build`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-22-reading-page-design.md`. Terms (Bookmark, Note, Excerpt, Read date…) are defined in `CONTEXT.md`.

## Global Constraints

- Python standard library only. Python ≥ 3.9, for `zoneinfo`.
- Env vars: `RAINDROP_TOKEN` (Raindrop test token) and `RAINDROP_COLLECTION_ID` (numeric). Never print the token.
- Output file: `data/reading.json`, a JSON array, newest first. Entry keys are exactly `title, url, site, date, tags, note, excerpt`.
- `date` is `YYYY-MM-DD` in `Asia/Ho_Chi_Minh` time.
- API: `GET https://api.raindrop.io/rest/v1/raindrops/{id}?perpage=50&page=N&sort=-created`, with `Authorization: Bearer <token>`. Pages start at 0, with at most 50 per page.
- Cron: `'17 * * * *'`.
- Copy: page title `Reading`; summary `Technical articles by other people that I've read and want to keep.`; empty state `Nothing here yet.`; month heading in Go format `January 2006`; count `N of M`.
- Menu weights: Contact 1, Tags 2, Reading 3, About 4.
- Templates use `site.Data.reading`, not `hugo.Data` (that doesn't exist in 0.145).
- No new npm dependencies.

## Review Focus

- A title or Note containing HTML (`<script>`, `"`, `&`) has to render as text, never as markup. Pinned in Task 2, Step 4.
- A bookmark saved after 17:00 UTC must get the next day as its Read date in Vietnam time. Pinned in Task 1 `test_date_uses_vietnam_time`.
- A collection with exactly 50 or 100 bookmarks has to fetch every page and stop cleanly. Pinned in Task 1 `test_fetch_all_stops_on_empty_page`.
- `Ceph`, `ceph ` and `ceph` must count as one Bookmark tag. Pinned in Task 1 `test_tags_normalized`.
- With `data/reading.json` missing or `[]`, the site must still build and show `Nothing here yet.` Pinned in Task 2, Step 5.

---

### Task 1: Sync script

**Files:**
- Create: `scripts/sync_raindrop.py`
- Test: `scripts/test_sync_raindrop.py`

**Interfaces:**
- Produces:
  - `class SyncError(Exception)`
  - `to_entry(item: dict) -> dict | None`: one Raindrop item becomes one entry. Returns `None` when `link` isn't http(s).
  - `fetch_all(get_page: Callable[[int], dict]) -> list[dict]`: raw items from page 0 onward.
  - `build_entries(items: list[dict]) -> list[dict]`: sorted newest first by `(created, _id)` descending, with `None` entries dropped.
  - `render(entries: list[dict]) -> str`
  - `check_not_wiping(old_text: str | None, entries: list[dict]) -> None`
  - `main(argv: list[str] | None = None) -> int`: `--output` defaults to `data/reading.json`.
  - The output file, consumed by Task 2.

- [ ] **Step 1: Write the failing tests** in `scripts/test_sync_raindrop.py`. Use `unittest`, and import with `sys.path.insert(0, os.path.dirname(__file__))`. Base item: `{"_id": 1, "title": "BlueStore", "link": "https://ceph.io/a", "domain": "ceph.io", "created": "2026-11-21T03:00:00.000Z", "tags": ["ceph"], "note": "good", "excerpt": "about bluestore"}`.
  - `test_to_entry_maps_fields`: the base item gives `{"title": "BlueStore", "url": "https://ceph.io/a", "site": "ceph.io", "date": "2026-11-21", "tags": ["ceph"], "note": "good", "excerpt": "about bluestore"}`.
  - `test_date_uses_vietnam_time`: `created "2026-11-21T18:30:00.000Z"` gives `date == "2026-11-22"`.
  - `test_tags_normalized`: `["Ceph", " ceph ", "Storage", ""]` gives `["ceph", "storage"]`. Lowercase, trimmed, deduplicated in first-seen order, blanks dropped.
  - `test_missing_fields_default_empty`: an item without `note`, `excerpt` or `tags` gives `""`, `""` and `[]`. Surrounding whitespace on `note` and `title` is stripped.
  - `test_title_falls_back_to_url`: an empty `title` gives `title == url`.
  - `test_non_http_link_skipped`: `link "javascript:alert(1)"` gives `None`.
  - `test_fetch_all_stops_on_empty_page`: the stub returns 50, then 50, then 0 items. The result has 100 items, and the pages requested are `[0, 1, 2]`.
  - `test_fetch_all_stops_on_short_page`: 50, then 3 items gives 53, with pages `[0, 1]`.
  - `test_fetch_all_raises_on_result_false`: `{"result": False, "errorMessage": "x"}` raises `SyncError`.
  - `test_build_entries_newest_first`: items created 2026-11-01 and 2026-11-20 come out with 2026-11-20 first. A non-http item is dropped.
  - `test_render_stable_and_unicode`: `render(e) == render(e)`, it ends with `"\n"`, and `"Tiếng Việt"` appears unescaped.
  - `test_check_not_wiping`: `old='[{"title":"x"}]'` with `[]` raises `SyncError`. `old=None` or `'[]'` with `[]` doesn't raise.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `python3 -m unittest discover -s scripts -v`
Expected: an error, because `ModuleNotFoundError: No module named 'sync_raindrop'`.

- [ ] **Step 3: Implement `scripts/sync_raindrop.py`**
  - `fetch_all` loops until a page has fewer than 50 items. It raises `SyncError` if `result` isn't `True`.
  - The real `get_page` uses `urllib.request` with a 30 s timeout and `User-Agent: reading-sync/1.0`. It turns `HTTPError`, `URLError` and `JSONDecodeError` into `SyncError` with the status code, never the token.
  - `render` is `json.dumps(entries, ensure_ascii=False, indent=2) + "\n"`.
  - `main` reads both env vars and exits 2 with a message if either is missing. It reads the old file if there is one, calls `check_not_wiping`, writes only if the text differs, and prints `N bookmarks, changed` or `N bookmarks, unchanged`. On `SyncError` it prints to stderr and exits 1.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `python3 -m unittest discover -s scripts -v`
Expected: all 12 tests pass.

- [ ] **Step 5: Check failure handling against the real API.** This works with the current invalid token too.

Run: `set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py --output /tmp/claude-1000/-home-mr8-projects-mr4x2-blog/0b5a3eea-e686-4d17-b7d3-b1ec2ebc91b6/scratchpad/r.json; echo "exit=$?"`
Expected: with the bad token, `exit=1`, a message mentioning HTTP 401, no token in the output, and no file written. With `RAINDROP_TOKEN=` it gives `exit=2`.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync_raindrop.py scripts/test_sync_raindrop.py
git commit -m "feat(reading): add Raindrop sync script"
```

### Task 2: Reading page

**Files:**
- Create: `content/reading/index.md`, `layouts/_default/reading.html`
- Modify: `hugo.toml` (menus), `assets/css/output.css` (regenerated)
- Dev only, not committed in this task: `data/reading.json` fixture

**Interfaces:**
- Consumes: the `data/reading.json` entry shape from Task 1.
- Produces: the page at `/reading/`. Each `<li>` has `data-tags` (space-separated) and `data-search` (lowercased title, site, tags, note and excerpt). Month groups are `<section data-month>`.

- [ ] **Step 1: Write the dev fixture `data/reading.json`** with 4 entries:
  - two in November 2026, one of them with no tags;
  - one in October 2026 with the Note `<b>bold</b> & "quotes"`;
  - one with the title `Tiếng Việt`.

- [ ] **Step 2: Create `content/reading/index.md`.** Front matter: `title: "Reading"`, the summary from Global Constraints, `layout: "reading"`, `build: {list: never}`, a `date`, and no `tags`. The body is empty.

- [ ] **Step 3: Write `layouts/_default/reading.html`** (`define "main"`), matching the `list.html` container widths and gray/indigo palette.
  - Controls are rendered with the `hidden` attribute, and the JS removes it: a search `<input type="search">`, `All` plus one button per tag (by count descending, then alphabetical), and the `N of M` line.
  - Group by `.date` month, newest first. Each group is an `<h2>` with the `January 2006` format and a `<ul>` of rows:
    - the day;
    - the title as `<a href=url target="_blank" rel="noopener">`;
    - the site;
    - the tags as buttons;
    - the Note in `<p class="italic">` if it isn't empty.
  - Show `Nothing here yet.` when the data is missing or empty.
  - The inline JS:
    - Clicking a tag sets `location.hash = "tag=<t>"`, and the `All` button clears it.
    - It reads the hash on load and on `hashchange`.
    - A row shows if it has the tag (when one is set) and its `data-search` includes the trimmed, lowercased query.
    - It hides a section when all of its rows are hidden, and updates `N of M`.
  - Add the menu entry to `hugo.toml`: `Reading`, `/reading`, weight 3. About becomes weight 4.
  - Run `npm run build`.

- [ ] **Step 4: Build and check the output.** Use the local Hugo, then the server image's Hugo.

Run: `hugo --gc -d $S/b1 && docker run --rm --user "$(id -u):$(id -g)" -e HUGO_CACHEDIR=/tmp/hc -v "$PWD":/src -w /src hugomods/hugo:exts hugo --gc -d /tmp/b2`, running as your user so `resources/` doesn't end up owned by root, with `S=/tmp/claude-1000/-home-mr8-projects-mr4x2-blog/0b5a3eea-e686-4d17-b7d3-b1ec2ebc91b6/scratchpad`.
Expected: both builds succeed with no template errors. In `$S/b1/reading/index.html`:
  - `November 2026` appears before `October 2026`;
  - it contains `&lt;b&gt;bold&lt;/b&gt;` and not `<b>bold</b>`;
  - it contains `Tiếng Việt`;
  - it has 4 `<li` rows with `data-search`.

In `$S/b1/index.html`, `grep -c 'mr4x2.com/reading/'` is `0`, and the header has a `/reading` link. `$S/b1/tags/` has no Bookmark tags.

- [ ] **Step 5: Check the empty state.** Move the fixture aside, build, and check that `$S/b1/reading/index.html` contains `Nothing here yet.` Do the same with a file containing `[]`. Put the fixture back afterwards.

- [ ] **Step 6: Check the filter in a browser.** Run `hugo server` and open `/reading/`.
  - Clicking a tag filters the rows and changes the URL to `#tag=…`.
  - Reloading with that hash keeps the filter.
  - Typing `bluestore` filters by Note or Excerpt text.
  - The October heading hides when it has no matching rows.
  - With JS disabled, all rows show and the controls stay hidden.

- [ ] **Step 7: Commit, without the fixture**

```bash
git add content/reading/index.md layouts/_default/reading.html hugo.toml assets/css/output.css
git commit -m "feat(reading): add /reading page"
```

### Task 3: Scheduled sync, docs and hygiene

**Files:**
- Create: `.github/workflows/sync-reading.yml`, `.dockerignore`
- Modify: `CLAUDE.md`
- Also commit: `CONTEXT.md`, the spec and this plan

**Interfaces:**
- Consumes: `python3 scripts/sync_raindrop.py`, which exits 0 on success, and `data/reading.json`.

- [ ] **Step 1: Write `sync-reading.yml`**
  - Triggers: `schedule` with the cron from Global Constraints, plus `workflow_dispatch`.
  - `permissions: {contents: write, actions: write}`, and `concurrency: {group: sync-reading, cancel-in-progress: false}`.
  - Steps:
    1. `actions/checkout@v4`.
    2. `python3 -m unittest discover -s scripts`.
    3. Run the script with `env:` set from `secrets.RAINDROP_TOKEN` and `secrets.RAINDROP_COLLECTION_ID`.
    4. If `git status --porcelain data/reading.json` shows a change: commit as `github-actions[bot]` (`41898283+github-actions[bot]@users.noreply.github.com`) with the message `chore(reading): sync from Raindrop`, push, then run `gh workflow run hugo.yml --ref main` with `GH_TOKEN: ${{ github.token }}`.

- [ ] **Step 2: Lint the workflow**

Run: `docker run --rm -v "$PWD/.github:/repo/.github:ro" -w /repo rhysd/actionlint:1.7.7 -no-color`
Expected: no output, exit 0.

- [ ] **Step 3: Add `.dockerignore`** containing `.env`. Then update the CLAUDE.md Deploy section, or add a short "Reading page" section, covering:
  - the data flow (Raindrop → hourly Action → `data/reading.json` → `hugo.yml` → Watchtower);
  - that `data/reading.json` is generated and must not be edited by hand;
  - how to run the sync and the tests locally;
  - a pointer to `CONTEXT.md`.

- [ ] **Step 4: Run the check again.** `hugo --gc` succeeds.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/sync-reading.yml .dockerignore CLAUDE.md CONTEXT.md docs/superpowers/
git commit -m "feat(reading): sync Raindrop hourly via GitHub Actions"
```

### Task 4: First real sync. Blocked until the Test token in `.env` works.

- [ ] **Step 1: Check the token.** A `curl` to `/rest/v1/user` returns HTTP 200.
- [ ] **Step 2: Rename the env var.** In `.env`, change `RAINDROP_ID=` to `RAINDROP_COLLECTION_ID=`. Set the GitHub secret `RAINDROP_TOKEN` from `.env` through stdin (`gh secret set RAINDROP_TOKEN < <(…)`), without echoing it. `RAINDROP_COLLECTION_ID` is already set.
- [ ] **Step 3: Check for sub-collections.** Call `GET /rest/v1/collections/childrens` and look for collections whose `parent.$id == 77506144`. If there are any, stop and ask the author whether to include them. That's the spec's open item.
- [ ] **Step 4: Run the sync for real.** Delete the dev fixture first, then run `python3 scripts/sync_raindrop.py`. Expected: `N bookmarks, changed`, where N matches the collection's `count`. Check the file with Task 2, Step 4.
- [ ] **Step 5: Commit**

```bash
git add data/reading.json
git commit -m "chore(reading): initial sync from Raindrop"
```

### Task 5: PR and live check

- [ ] **Step 1: Push and open the PR.** Push over HTTPS with the `gh` credential helper and open a PR with `Fixes #15`. CI should pass.
- [ ] **Step 2: Clean up secrets.** After the author merges, delete the unused `RAINDROP_ID` GitHub secret, with the author's OK.
- [ ] **Step 3: Run the live sync and watch it.** Run `gh workflow run sync-reading.yml --ref main` and watch it. Expected: the tests pass and the sync reports `unchanged`, so there's no commit. Then save a test bookmark in Raindrop and dispatch again. Expected: a bot commit, a `hugo.yml` run, Watchtower's `updated=1`, and the new bookmark on https://mr4x2.com/reading/ within about 10 minutes.
