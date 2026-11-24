# mr4x2 blog verification map

This directory is the maintained source for verifying what readers and the author can do with the blog. Read this index before driving the site, then use the matching feature file as the recipe.

## Baseline preconditions

- Work from the repo root, with `V=.claude/skills/verify-mr4x2-blog/scripts`.
- Launch a disposable instance with `$V/verify.sh launch local` or `$V/verify.sh launch prod`, and note its `RUN_ID` and `URL`. `prod` is the static nginx image that production serves, so it has no drafts and no live reload. Relaunch it after every change.
- `$V/verify.sh doctor RUN_ID` reports `doctor: healthy` before any journey.
- The content is whatever is in the working tree. On `main` today that's two Posts (`A great trip in Thailand`, `Memorable days in France`) and the About page.
- Never drive https://mr4x2.com or the `mr4x2-blog-hugo-blog-1` container, except for the read-only checks in `deploy.md`.

## Driving conventions

- Each journey is a JSON array of `drive.mjs` steps, run with `--name <feature-id>` so its evidence lands in its own folder.
- Use roles and accessible names (`{"role": "link", "name": "Reading"}`) or ARIA labels, never Tailwind classes.
- Start every journey with a `goto`. Don't rely on the state a previous journey left behind.
- Run a phone-width pass (`--width 390`) and a dark pass (`--dark`) for any layout change. The theme follows `prefers-color-scheme` when the reader has not picked one, so `--dark` needs no saved choice.
- Terms (Post, Bookmark, Note, Excerpt, Read date…) are defined in the repo's `CONTEXT.md`.

## Proof and skip reporting

- UI proof is a before-and-after screenshot pair, plus `expect` steps on the resulting DOM, all in `.verify/runs/RUN_ID/<feature-id>/`.
- CLI proof is the command, stdout, stderr and exit code, plus the file it wrote or a check that it wrote nothing.
- Deploy proof is the run or commit IDs, the image IDs before and after, and Watchtower's log lines.
- Record the feature ID and the entry point you used with each artifact.
- An entry point you couldn't reach is reported as skipped, with the command you tried and the precondition that wasn't met.

## Feature entry contract

Each feature file starts with an H1 title and a paragraph describing the behavior the user sees. Then come exactly four H2 sections, in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with drive.mjs` (or with the CLI or with read-only commands), and `Gotchas`.

## Features

- [Home page](./home.md) covers the header and footer, the `whoami` intro and its typing, the Top tracks, the tag line, the Post rows, reduced motion and high contrast.
- [Post page](./post.md) covers the date and reading time, tags, the `$ cat toc` table of contents, centered photos with captions, code colors, older and newer links, giscus in the site theme, and About as a plain page.
- [Tags](./tags.md) covers `/tags/`, each tag page, the removed `readme` and `info` tags, and that Bookmark tags stay off it.
- [Search popup](./search.md) covers Ctrl K, `/`, Pagefind results for `Bangkok`, the keys, focus return and the missing-index message.
- [404 page](./not-found.md) covers the typed `cd` command, the `bash: cd:` line, its path from the address bar, the bee that flies in beside `cd ~`, and the no-JavaScript fallback.
- [Motion](./motion.md) covers the theme reveal, the title morph between pages, the reading bar, photo and TOC fades, the row link, the logo cursor, hover states and the footer bee.
- [Garden mode](./garden.md) covers the third theme: the theme button's dark → garden → light cycle, the footer bee's jump there and back, the flower bed, the wandering bees, the bee that follows the pointer, a tap on a touch screen, a background tab, the next page and reduced motion.
- [Reading page](./reading.md) covers the `/reading` Bookmark list, the tag filter, search, the no-JS fallback and the empty state. It's **new in #15**.
- [Raindrop sync](./sync.md) covers the author's sync command: the happy path, a bad token, missing settings, and leaving the file alone when nothing changed.
- [Deploy chain](./deploy.md) covers the read-only checks that a merge or sync reached the live site.
