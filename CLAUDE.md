# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Hugo blog (mr4x2.com): travel and tech posts in English.

## Commands

- `hugo server -D`: local preview at http://localhost:1313.
- `hugo --gc`: build check. This is what CI gates on; there are no tests or linters.
- `hugo new content <slug>/index.md`: new post from `archetypes/default.md`. It sets title, summary, tags and date; add `image` yourself (see Posts).
- `npm install && npm run build`: regenerate Tailwind CSS. Run it after adding Tailwind classes that templates didn't use before.
- `npx prettier --write "layouts/**/*.html"`: format templates (the go-template plugin is set up in `.prettierrc`).

## Layout and theme

- The theme is vendored. `layouts/` holds the hugo-discaptive templates, edited in place, and `theme.toml` is that theme's metadata. There is no theme directory or submodule.
- `assets/css/output.css` is the compiled Tailwind file, committed to the repo. It is what `layouts/partials/head/css.html` loads, and both `npm run build` and `npm run watch` write to it.
- `public/` and `resources/` are generated build output.

## Posts

- Each post is `content/<slug>/index.md`. Its photos live in `static/trip-in-<place>/`, not in the post folder. Reference them as `![alt](trip-in-<place>/IMG.JPEG#center "Caption")`: `#center` centers the image and the title becomes the caption. The `hugomods/images` module renders these.
- The front-matter `image: ["trip-in-<place>/IMG.JPEG"]` sets the social preview. Give its path under `static/`, the same one the post's photos use. Without it, pages fall back to `static/images/og-image.png`.
- Links between posts use `{{< ref "/<slug>/index.md" >}}`. Raw HTML is allowed in Markdown (`markup.goldmark.renderer.unsafe = true`); posts use it for `target="_blank"` links and iframes.
- The author writes these posts partly to practice English. When editing a post, fix grammar and keep their wording and voice.

## Deploy

Pushes to `main` trigger `.github/workflows/hugo.yml`. It runs a `hugo` build check, then pushes a Docker image (`hugomods/hugo:exts` plus the repo source) to Docker Hub as `:latest`. On the server, `docker-compose.yaml` runs `hugo server -D` from that image behind Traefik, so the live site is built when the container starts and drafts are published. Watchtower, in the same compose file, checks for a new `:latest` every 5 minutes and recreates the blog container, so a merge to `main` goes live on its own. PRs run the build check and the Docker build but push nothing. Only `main` pushes, tagging each image `:latest` and `:<commit sha>`. Changes to `docker-compose.yaml` itself only apply after `git pull` and `docker compose up -d` in the server's checkout.

## Reading page

`/reading` lists the Bookmarks in the author's Raindrop Reading collection. Terms (Bookmark, Note, Excerpt, Read date) are defined in `CONTEXT.md`.

- Data flow: Raindrop → `.github/workflows/sync-reading.yml` (hourly) runs `scripts/sync_raindrop.py` → commits `data/reading.json` to `main` → dispatches `hugo.yml` → Docker Hub → Watchtower.
- `data/reading.json` is generated. Don't edit it by hand: the next sync overwrites it, and a Bookmark deleted in Raindrop disappears from the page.
- `layouts/_default/reading.html` renders it with `site.Data.reading` (`hugo.Data` doesn't exist in Hugo 0.145). The page builds and shows `Nothing here yet.` when the file is missing or `[]`.
- Run the sync locally with `set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py`. It needs `RAINDROP_TOKEN` (a Raindrop test token) and `RAINDROP_COLLECTION_ID`. Add `--output <file>` to write somewhere else.
- Run the sync tests with `python3 -m unittest discover -s scripts -v`.
