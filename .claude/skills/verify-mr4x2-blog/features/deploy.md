# Deploy chain

A merge to `main`, or a sync commit, reaches https://mr4x2.com with no manual step. `hugo.yml` builds and pushes `mr4x2/hugo-blog:latest` and `:<sha>` from `main` only. Watchtower on this server checks every 5 minutes and recreates `mr4x2-blog-hugo-blog-1`. The hourly `sync-reading.yml` commits `data/reading.json`, and the daily `sync-top-tracks.yml` commits `data/top_tracks.json`. Each dispatches `hugo.yml` when it pushed a change.

## Sub-features

- `deploy-pr-no-push`: a PR run skips "Docker Login" and builds with `push: false`.
- `deploy-main-push`: a `main` run pushes `:latest` and `:<sha>`.
- `deploy-watchtower`: Watchtower logs `Found new image` and `updated=1`, and the blog container runs the new image ID.
- `deploy-static`: the image serves the Pagefind index and the site's 404 page. `/pagefind/pagefind.js` returns 200, and `/no-such-page/` returns 404 with the site's 404 page.
- `deploy-live`: https://mr4x2.com returns 200 and serves the change.
- `deploy-sync-dispatch`: a run of either sync that changed the data commits as `github-actions[bot]` and starts a `workflow_dispatch` run of `hugo.yml`.

## How to get to it (user POV)

- Merge a PR on GitHub, or wait for the hourly sync.
- Actions → "Deploy Hugo site to Pages", "Sync reading" or "Sync top tracks" → Run workflow. That's a production action, so only do it when the author asked for it in this conversation.

## Driving it with read-only commands

Preconditions:

- `gh auth status` is logged in as `mr4x2`. This machine is the production server.
- `E=.verify/runs/$RUN_ID/deploy`, created with `mkdir -p`.

- **CI run.** `gh run list --repo mr4x2/mr4x2-blog --limit 5 --json databaseId,event,headBranch,headSha,status,conclusion`. Find the run for the merge commit or the dispatch. Then `gh run view <id> --repo mr4x2/mr4x2-blog --json jobs -q '.jobs[].steps[] | "\(.name)\t\(.conclusion)"' >$E/steps.txt`. On `main`, "Docker Login" shows `success`. On a PR it shows `skipped`, and `gh run view <id> --log | grep 'push:'` shows `push: false`.
- **Registry.** `curl -s "https://hub.docker.com/v2/repositories/mr4x2/hugo-blog/tags?page_size=3&ordering=last_updated" | jq -r '.results[] | "\(.name) \(.last_updated)"' >$E/tags.txt`. `latest` and the full commit SHA are both newer than the run's start.
- **Watchtower.** `docker inspect mr4x2-blog-hugo-blog-1 --format '{{.Image}}' >$E/image-before.txt` before the push. Then wait for the next 5-minute check. `docker logs --since <run start> mr4x2-blog-watchtower-1 2>&1 | grep -E 'Found new image|Update session|level=(warn|error)' >$E/watchtower.txt` shows `updated=1 failed=0`. Run `docker inspect … --format '{{.Image}}' >$E/image-after.txt` again: it differs from before.
- **Static image.** Run `$V/verify.sh launch prod` and use its `URL`. `curl -s -o /dev/null -w '%{http_code}' $URL/pagefind/pagefind.js` prints `200`. `curl -s -o /dev/null -w '%{http_code}' $URL/no-such-page/` prints `404`, and the body is the page from `layouts/404.html`. Then `$V/verify.sh stop RUN_ID`. This builds the repo's `Dockerfile` locally and touches no production container.
- **Live.** `curl -s -o /dev/null -w '%{http_code}' https://mr4x2.com/` prints `200`. `curl -s https://mr4x2.com/<changed path>` contains the change. For a Reading sync that's `/reading/`, with a Bookmark title just saved in Raindrop. For a Top tracks sync it's `/`, the block under `whoami`.
- **Sync dispatch.** `gh run list --workflow sync-reading.yml --limit 1` (or `sync-top-tracks.yml`) shows success. If the data changed, `git log origin/main --author=github-actions -2 --format='%h %an %s' -- data/reading.json data/top_tracks.json` shows the bot's `chore(reading): sync from Raindrop` or `chore(music): sync top tracks` commit, and a `workflow_dispatch` run of `hugo.yml` for that commit's SHA started after it. Don't read only `git log origin/main -1`: a later merge sits on top of the sync commit.
- **Proof.** Keep the files in `$E`.

## Gotchas

- Watchtower polls every 300 s, so a deploy lands up to 5 minutes after the push. Wait by polling its log, never by a fixed sleep.
- An unchanged build can still produce a new image digest (build metadata), so `updated=1` alone doesn't prove new content. Check the live page for the change.
- A commit pushed with `GITHUB_TOKEN` never triggers `hugo.yml` by itself. If the sync committed but no build followed, the dispatch step failed.
- Never restart, stop or `docker compose up` the production stack as part of a verification. Ask the author first.
- GitHub turns off scheduled workflows after 60 days with no repository activity. If the sync stops running, check the Actions tab for a "disabled" banner.
