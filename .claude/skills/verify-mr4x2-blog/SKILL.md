---
name: verify-mr4x2-blog
description: Drive the mr4x2.com Hugo blog the way a reader or the author would, and capture proof. Covers the web pages (home, posts, tags, the Reading page and its filter), the Raindrop sync CLI, and the production deploy chain (GitHub Actions → Docker Hub → Watchtower). Use it to verify a template, content, CSS, sync or deploy change before you claim it works.
---

# Verify the mr4x2 blog

The site is a Hugo blog. Readers touch **web pages**, and the author also runs a **sync CLI** (`scripts/sync_raindrop.py`) and a **deploy chain**. Start with the feature map: `features/README.md` lists every feature and its recipe file.

Helpers live in this skill's `scripts/`, so call them by repo-relative path from the repo root:

- `scripts/verify.sh` launches, checks and stops disposable preview instances.
- `scripts/drive.mjs` drives one page in headless Chromium with a JSON list of steps, and saves screenshots, DOM dumps and results.

In the commands below, `V=.claude/skills/verify-mr4x2-blog/scripts`.

## Launch

```bash
$V/verify.sh launch local   # the repo's own `hugo server -D` (this machine: Hugo 0.145)
$V/verify.sh launch prod    # the repo's own static image (Hugo 0.154.5, Pagefind, nginx), built from this working tree
```

- Each launch takes a free port on 127.0.0.1 and prints `RUN_ID=…`, `URL=…`, `MODE=…` and `EVIDENCE=…`. Copy the RUN_ID, since every later command needs it.
- `local` serves drafts (`-D`) and live-reloads. `prod` builds the repo's `Dockerfile` into the image `mr4x2-blog-verify:RUN_ID`, with `BASE_URL` set to the run's URL so links stay on the preview. It runs that image on nginx. The build log is `$RUN_DIR/build.log`.
- **Ready** for `local` means the log contains `Web Server is available at` *and* `GET /` returns 200. **Ready** for `prod` means `GET /` returns 200. `launch` waits up to 60 s, or prints the log tail and cleans up after itself.
- Use `prod` before claiming a change works on the live site. It is what production serves: Hugo 0.154.5, the Pagefind index, `nginx.conf`, and no drafts. This machine's own Hugo is 0.145, and template behavior differs between versions.
- `prod` is a static snapshot of the working tree. It does not live-reload, so relaunch after every change, including `npm run build`. `local` live-reloads, so you can edit and re-drive without relaunching.
- **Isolation:** two runs can be up at once, because each has its own port and run directory. Never drive the production container (`mr4x2-blog-hugo-blog-1`) or https://mr4x2.com for UI journeys. The live site is only for the deploy feature's read-only checks.

## Doctor

```bash
$V/verify.sh doctor RUN_ID
```

This is read-only. It checks that the process or container belongs to this run, that `GET /` returns 200, and that the home page `<title>` is `mr4x2 blog`. It also prints the Hugo version (for `prod`, the version in the `Dockerfile`, since the nginx image has no Hugo), the git branch and commit, whether there are uncommitted changes, and any `ERROR`/`WARN` lines in the server log. Run it first, and again whenever a result looks wrong. If it says `NOT healthy`, stop the run and relaunch. Don't drive a broken instance.

## Drive

Pages are driven with `drive.mjs`. Steps are JSON objects, and the run stops at nothing: every step is recorded.

```bash
node $V/drive.mjs --run RUN_ID --name JOURNEY [--no-js] [--width 390] steps.json   # or `-` to read the steps from stdin
```

| Step | Effect |
|------|--------|
| `{"goto": "/reading/#tag=ceph"}` | Navigate, with the path relative to the run's URL. Waits for load, or for the in-document navigation when only the hash changes. |
| `{"click": {"role": "button", "name": "ceph"}}` | Click the first *visible* element with that role and accessible name. A CSS selector string also works. |
| `{"fill": {"role": "searchbox", "name": "Search bookmarks"}, "value": "bluestore"}` | Set the value and fire `input`. |
| `{"wait": "<js expr>", "timeout": 5000}` | Poll until the expression is truthy. |
| `{"expect": "<js expr>", "equals": <json>, "label": "…"}` | Assert. Without `equals` the value only has to be truthy. A failure fails the journey. |
| `{"eval": "<js expr>"}` | Record a value. |
| `{"scroll": {"role": "heading", "name": "…"}}` | Scroll the target into the middle of the viewport, which also triggers lazy images there. |
| `{"shot": "label"}` / `{"shot": "label", "viewport": true}` / `{"dom": "label"}` | Save a full-page PNG (capped at 4000 px, with `truncatedAt` recorded in `results.json`), a PNG of the viewport only, or the current DOM as HTML. |

- Expressions run in an isolated world, so they also work with `--no-js`. They can use `$(target)` and `$$(target)`, where a target is a selector string or `{role, name}`, plus `visible(el)` and `nameOf(el)`. The roles are `button`, `link`, `searchbox`, `heading`, `status`, `group` and `listitem`.
- Prefer `{role, name}` and ARIA labels over classes. The Tailwind classes change with the theme (#16).
- Any uncaught page exception fails the journey and goes to `console.log`.
- A click that navigates is fine: the next step re-attaches to the new page. Follow it with a `wait` on `location.pathname`.
- Pass steps from a quoted heredoc (`<<'EOF'`) or a file. `printf` and `echo -e` eat the backslashes in the JSON. In expressions, prefer single quotes for JS strings.
- Chromium comes from `~/.cache/ms-playwright/chromium-*`. Set `CHROME=` to use another binary.
- **For the CLI** (sync feature), run the command directly and capture the command, stdout, stderr and exit code into the run directory. See `features/sync.md`.
- **For the deploy chain**, the checks are read-only `gh`, `curl` and `docker logs` commands. See `features/deploy.md`.

## Evidence

- Everything for a run goes to `.verify/runs/RUN_ID/` (gitignored). That includes `server.log` and one folder per journey, each holding the numbered PNG and HTML files, `results.json` (every step and its value) and `console.log`.
- **A proof captures the action and the resulting state**: a screenshot before and after the action, and an `expect` on the resulting DOM, not only the final screen.
- **Drive the real user path**: a click on the tag button, typing in the search box, or the link in the header menu. Don't call page functions or set the hash to stand in for a click, unless the feature file names the hash as an entry point of its own.
- **Check side effects too**. For the sync, that means the written `data/reading.json` (its content and `git diff`), not just the printed summary. For a deploy, it means the new image ID in the running container, not just a green CI run.
- Mocks are only acceptable at the Raindrop API boundary, through the unit tests. Journeys use the real API, or skip and say so.
- Report a skipped or unreachable entry point as **skipped, with the reason**. Never report it as verified through some other path.

## Cleanup

```bash
$V/verify.sh stop RUN_ID    # kills only this run's PID, or removes its container and image, deletes its Chromium profile, keeps the evidence
$V/verify.sh list           # shows any runs still up
```

- Never kill by process name. A `hugo server` and a container named `mr4x2-blog-*` are production, and stay untouched.
- Clean up after every failed attempt too. Evidence stays in `.verify/runs/RUN_ID/` until you delete it on purpose.
- Restore anything a journey changed in the working tree, such as a fixture `data/reading.json` or a temporary content file, with `git checkout -- <path>` or `git stash`, before you report.

## Helpers

- `scripts/verify.sh launch [local|prod] | doctor RUN_ID | stop RUN_ID | list`
- `scripts/drive.mjs --run RUN_ID --name JOURNEY [--no-js] [--width N] [--height N] STEPS.json|-`

Both are executable and dependency-free: bash, curl, python3, Node ≥ 22 for the built-in WebSocket, Docker for `prod` mode, and a cached Playwright Chromium.
