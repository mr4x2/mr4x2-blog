# Tags

`/tags/` shows `$ ls ~/tags` and every Post tag in monospace with its Post count (`#travel (2)`), most used first. Each tag opens `/tags/<tag>/`, which shows `$ ls -t ~/posts --tag=<tag>` and the same rows as the home page. Tags from About and Bookmark tags from the Reading page never appear here.

## Sub-features

- `tags-index` lists all Post tags with counts at `/tags/`.
- `tags-page` lists the Posts with a given tag at `/tags/<tag>/`, newest first.
- `tags-line` links the same tags under `$ ls -t ~/posts` on the home page.
- `tags-removed` gives `/tags/readme/` and `/tags/info/` no page. They came from About, which no longer has tags. This is the one URL change in the new theme.
- `tags-no-bookmark-tags` keeps Bookmark tags off this page. A Bookmark tag that no Post uses gets no tag link and no page.

## How to get to it (user POV)

- Click `tags/` in the header menu.
- Click a tag under a Post, in a post row, or in the home page tag line.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name tags $K/journeys/tags.json
node $K/scripts/drive.mjs --run RUN_ID --name tags-dark --dark $K/journeys/tags.json
node $K/scripts/drive.mjs --run RUN_ID --name tags-phone --width 390 --height 844 $K/journeys/tags.json
```

- **`tags.json`** opens `tags/` from the menu and checks the command line, the five tags with their counts in order (`#travel (2)`, `#fossasia (1)`, `#france (1)`, `#openinfra-submit (1)`, `#thailand (1)`), that the About tags are absent, and the heading. It reads the Bookmark tags from `/reading/` and fetches `/tags/<tag>/` for each one that no Post uses, which must be 404, so it tests whatever Reading data is in the tree (`technology` and `productive` today, `ceph`, `storage`, `linux` and `machine-learning` with the Reading fixture). It saves a screenshot and the rendered text, opens `#travel (2)` and checks the command line and the two Posts newest first, opens `/tags/thailand/` and the `#france` link on the home page, and fetches `/tags/readme/` and `/tags/info/`, which must be 404.
- **Proof.** Keep `tags` and `tag-travel`.

## Gotchas

- A tag's link name is `#` plus its `urlize`d term plus the count (`#openinfra-submit (1)`). The URL is `/tags/openinfra-submit/`. Match names with `nameOf`, and match URLs on the path.
- The Bookmark-tag check fails when the Reading page has no tag that a Post doesn't also use, because then it has nothing to test. Run it with the Reading fixture in that case.
- Hugo also builds an empty `/categories/`. Nothing links to it. It uses the same template and shows `$ ls ~/categories` with no tags.
- The local server renders to `public/` and serves a file from an earlier run when the page no longer exists, so `/tags/readme/` can answer 200 on a stale tree. Delete `public/` before launching.
