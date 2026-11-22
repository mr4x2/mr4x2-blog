# Reading page design

Issue: #15. Status: decisions settled (2026-11-22). Terms are defined in `CONTEXT.md`.

## Why

A personal reading log. When I finish a good technical article by someone else, I save it so I can find it again later. The page is public on mr4x2.com, but I'm its main user. Saving has to take one tap from both an iPhone and a laptop.

## Goals

- Save with Raindrop.io (iPhone share sheet, browser extension), with tags and a note added there.
- `/reading` lists every Bookmark in the Reading collection, as one flat list, newest first, with a tag filter and a text search.
- New Bookmarks go live without any manual step, within about an hour.
- A copy of every Bookmark is kept in git, so leaving Raindrop later loses nothing.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Does a saved bookmark mean "I read it"? | Yes. I only add to the Reading collection after reading. A read-later list lives in another collection. No `unread` filtering. |
| 2 | What happens when a bookmark is deleted in Raindrop? | The page mirrors the collection, so it disappears on the next sync. Old versions stay in git history only. |
| 3 | What text shows under each title? | The Note only, nothing when it's empty. The Excerpt is used for search but not shown. Notes are public. |
| 4 | Page name and menu | "Reading" at `/reading`, in the header between Tags and About. |
| 5 | How fast it updates | Hourly sync. |
| 6 | Build now or after the new theme (#16)? | Now. The layout is one self-contained file, to be ported when the theme changes. |
| 7 | List shape | One flat list, newest first, no pagination, like pliutau.com/reading-list. The author picked this from mockups on 2026-11-22, replacing the first answer (grouped by month). |

## Non-goals

- Saved copies of the articles (Linkwarden's strength). Not now.
- Raindrop tags as Hugo tags, an RSS feed for the page, or comments on the page.
- Any bookmark outside the chosen collection.

## Anti-goals (a failure even if it works)

- A private bookmark showing up on the site.
- A failed or empty API response wiping the page.
- The page showing up in "All Posts" or adding tags to the home sidebar.

## Approaches

- **Raindrop with an hourly sync (chosen).** Saving is one tap on both devices and Raindrop's tagging is good. The cost is a third-party account and a token in GitHub secrets.
- **Repo only** (edit a data file on the laptop, use an Apple Shortcut on the iPhone). There's no third party, but the Shortcut has to be built by hand, a GitHub token sits on the phone, and tagging is clumsy.
- **Linkwarden, self-hosted.** You own the data and get saved copies of each page. Rejected because it's another stack to run (app plus Postgres), and it would need to be exposed to the internet for phone saves and for the sync.

## Design

### Data: `data/reading.json`

A JSON array, newest first. Each entry:

```json
{ "title": "…", "url": "https://…", "site": "ceph.io", "date": "2026-11-21", "tags": ["ceph", "storage"], "note": "…", "excerpt": "…" }
```

- `date` is the Read date: the day the bookmark was created in Raindrop, in Asia/Ho_Chi_Minh time.
- `note` is Raindrop's note field, or `""`. `excerpt` is Raindrop's excerpt, or `""`. It is only used for search.
- Sub-collections: once the token works, check whether the Reading collection has child collections. If it does, decide whether their bookmarks are included. The API's `raindrops/{id}` may not return them.
- The output is deterministic (stable order, fixed formatting), so a commit only happens when something really changed.

### Sync: `scripts/sync_raindrop.py`

- Python with only the standard library. It reads `RAINDROP_TOKEN` (a Raindrop test token) and `RAINDROP_COLLECTION_ID` (the numeric collection ID) from the environment.
- It pages through `GET https://api.raindrop.io/rest/v1/raindrops/{RAINDROP_COLLECTION_ID}?perpage=50&page=N&sort=-created` with `Authorization: Bearer <token>`.
- It fails with a non-zero exit, and doesn't write the file, on any HTTP error, a `result: false` response, or malformed JSON.
- It refuses to replace a non-empty list with an empty one. That guards against a wrong collection ID or a bad response wiping the page.
- To run it locally: `set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py`.

### Workflow: `.github/workflows/sync-reading.yml`

- It runs hourly (`cron: '17 * * * *'`) and on `workflow_dispatch`. It needs the `contents: write` and `actions: write` permissions.
- Steps: check out, run the script with the two secrets, and if `data/reading.json` changed, commit it as `github-actions[bot]` and push to `main`.
- After a push it runs `gh workflow run hugo.yml --ref main`. This is needed because a push made with `GITHUB_TOKEN` doesn't trigger other workflows, but `workflow_dispatch` does. From there, the existing image build plus Watchtower deploy it.
- Known risk: GitHub disables scheduled workflows in public repos after 60 days with no repository activity, and sends an email. Re-enabling it is one click.

### Page

- `content/reading/index.md` sets `title: Reading`, a `summary` for the social preview, `layout: reading` and `build: { list: never }`, which keeps it out of "All Posts". It has no `tags`.
- `layouts/_default/reading.html` renders `site.Data.reading`:
  - A search box and tag buttons (all tags, most used first) at the top, then a "N of M" count. Search matches the title, site, tags, Note and Excerpt, ignoring case. One tag can be active at a time.
  - One flat list with a row per bookmark: the Read date (`2026-11-21`), the title linked with `target="_blank" rel="noopener"`, `- site`, and the Note in italics under it when there is one. Rows show no tags; the buttons above still filter by them.
  - The filter is about 30 lines of inline vanilla JS. Clicking a tag sets `#tag=<tag>` in the URL, so a filtered view can be linked. Without JS the full list still shows, and the filter controls stay hidden.
  - Empty state: "Nothing here yet."
- `hugo.toml` adds a menu entry, `Reading`, between Tags and About.
- `npm run build` regenerates `assets/css/output.css` for the new Tailwind classes.

### Also in this change

- A `.dockerignore` with `.env`, so a local image build can't bake in the Raindrop token.
- A CLAUDE.md section on how the Reading page is fed and how to run the sync locally.
- `CONTEXT.md`, the glossary: Post, Post tag, Reading page, Reading collection, Bookmark, Bookmark tag, Note, Excerpt, Read date.

## Verification

- Run the script locally against the real collection, and check the JSON and the guards (a bad token, and an empty result over a non-empty file).
- Run `hugo --gc` with the local Hugo (0.145) and with the server image's Hugo (0.154). Check `/reading` with `hugo server`: the filter, the search, the no-JS fallback, and that the page isn't in the home list.
- After merging, trigger the sync once by hand and watch it commit, start `hugo.yml`, and get picked up by Watchtower.

## Left to the builder

- The exact Tailwind styling, matching the existing pages.
- Tag-button order when tags are tied (alphabetical).
- The layout stays one self-contained file so it's easy to port if the theme changes (#16).
