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

- The theme is vendored. `layouts/` holds the hugo-discaptive templates, edited in place, and `theme.toml` is that theme's metadata. There is no theme directory, and the submodule listed in `.gitmodules` is stale (it doesn't exist).
- `assets/css/output.css` is the compiled Tailwind file, committed to the repo. It is what `layouts/partials/head/css.html` loads. `npm run watch` writes to `static/css/`, which the site never reads. Use `npm run build`, or run the watch with `-o ./assets/css/output.css`.
- `public/` and `resources/` are generated build output.

## Posts

- Each post is `content/<slug>/index.md`. Its photos live in `static/trip-in-<place>/`, not in the post folder. Reference them as `![alt](trip-in-<place>/IMG.JPEG#center "Caption")`: `#center` centers the image and the title becomes the caption. The `hugomods/images` module renders these.
- The front-matter `image: ["file.JPEG"]` sets the social preview. `layouts/partials/head.html` looks for it only in `static/images/`, so copy the file there too.
- Links between posts use `{{< ref "/<slug>/index.md" >}}`. Raw HTML is allowed in Markdown (`markup.goldmark.renderer.unsafe = true`); posts use it for `target="_blank"` links and iframes.
- The author writes these posts partly to practice English. When editing a post, fix grammar and keep their wording and voice.

## Deploy

Pushes to `main` trigger `.github/workflows/hugo.yml`. It runs a `hugo` build check, then pushes a Docker image (`hugomods/hugo:exts` plus the repo source) to Docker Hub as `:latest`. On the server, `docker-compose.yaml` runs `hugo server -D` from that image behind Traefik, so the live site is built when the container starts and drafts are published. PRs run the same workflow and also push `:latest`.
