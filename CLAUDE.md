# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal Hugo blog (mr4x2.com): travel and tech posts in English.

## Commands

- `hugo server -D`: local preview at http://localhost:1313.
- `npm run search`: builds the site into `public/` and writes the Pagefind index to `static/pagefind/` (gitignored). The search popup needs it. Without it the popup says `grep: search index not found`. Run it again after changing a post.
- `hugo --gc`: build check. This is what CI gates on; there are no tests or linters.
- `hugo new content <slug>/index.md`: new post from `archetypes/default.md`. It sets title, summary, tags and date; add `image` yourself (see Posts).
- `npm install && npm run build`: regenerate Tailwind CSS. Run it after adding Tailwind classes that templates didn't use before.
- `npx prettier --write "layouts/**/*.html"`: format templates (the go-template plugin is set up in `.prettierrc`).

## Layout and theme

- The theme lives in this repo. `layouts/` holds the templates, edited in place. There is no theme directory or submodule.
- `assets/css/output.css` is the compiled Tailwind file, committed to the repo. It is what `layouts/partials/head/css.html` loads, and both `npm run build` and `npm run watch` write to it.
- `public/` and `resources/` are generated build output. Here `hugo server` also writes into `public/` and can serve a page that an earlier run left there, so delete `public/` before a verification run.
- The home page is `layouts/index.html`, which renders `partials/home/whoami.html` and `partials/home/posts.html`. The `whoami` line is `params.whoami` in `hugo.toml`. A "who I am" version is one more block, not a rewrite. On the first visit of a session `whoami` types out, driven by classes on `<html>` that `theme-init.js` sets before first paint. The 404 page types its `cd` command the same way on every visit, marked by `data-intro="always"`.
- Thumbnails on post rows come from the front-matter `image`. `hugo.toml` mounts `static/trip-in-*` at `assets/photos`, so Hugo can resize them to small WebP files. A mount you define replaces Hugo's default mounts for that component, so the defaults are listed again there.
- Search is Pagefind, pinned to 1.5.0, because 1.6.0 dies with `Illegal instruction` on the server's CPU (no AVX2). `assets/js/search.js` loads `/pagefind/pagefind.js` with a dynamic `import()` on the first open. Only pages with `data-pagefind-body` are indexed: posts and About.
- The Search and theme buttons need JavaScript, so `.needs-js` hides them until `theme-init.js` has set `data-theme`.
- Colors, type sizes, durations and easing are tokens at the top of `assets/css/input.css`. `data-theme` on `<html>` switches the color set. `assets/js/theme-init.js` is inlined in `<head>` so the theme is set before first paint, and `assets/js/main.js` is bundled with Hugo's `js.Build`.
- Code blocks use Chroma classes with two palettes at the end of `assets/css/input.css`, one per `data-theme`. They come from `hugo gen chromastyles --style=github` (light) and `--style=github-dark` (dark), with each selector prefixed by `:root[data-theme="light"]` or `"dark"` and the `.bg`, `.chroma`, line-number and `.hl` rules and `font-weight:bold` dropped.
- The typography plugin declares `.prose` in `@layer utilities`, so every `.prose` override in `input.css` lives in that layer too.
- `About` uses `layout: "plain"` (`layouts/_default/plain.html`), a plain page with no date, tags or older and newer links. Posts use `single.html`. Never name a layout `page.html`: Hugo 0.146 and later treat it as the template for every page, so it would replace `single.html` on the server's Hugo 0.154.5 and not on this machine's 0.145.
- Fonts are self-hosted in `static/fonts/`: Inter 400 and 600 and JetBrains Mono 400 and 700, in the `latin` and `vietnamese` subsets, with their OFL licences beside them. To refresh them, run `npm pack @fontsource/inter@5.3.0 @fontsource/jetbrains-mono@5.3.0` in an empty directory, unpack both, and copy `files/<family>-<subset>-<weight>-normal.woff2` from each. Keep the total under 200 KB.

## Posts

- Each post is `content/<slug>/index.md`. Its photos live in `static/trip-in-<place>/`, not in the post folder. Reference them as `![alt](trip-in-<place>/IMG.JPEG#center "Caption")`: `#center` centers the image and the title becomes the caption. The `hugomods/images` module renders these.
- The front-matter `image: ["trip-in-<place>/IMG.JPEG"]` sets the social preview. Give its path under `static/`, the same one the post's photos use. Without it, pages fall back to `static/images/og-image.png`.
- Links between posts use `{{< ref "/<slug>/index.md" >}}`. Raw HTML is allowed in Markdown (`markup.goldmark.renderer.unsafe = true`); posts use it for `target="_blank"` links and iframes.
- The author writes these posts partly to practice English. When editing a post, fix grammar and keep their wording and voice.

## Deploy

Pushes to `main` trigger `.github/workflows/hugo.yml`. It runs a `hugo` build check on Hugo 0.154.5, then builds the Docker image and pushes it to Docker Hub as `:latest` and `:<commit sha>`. PRs run the same build check and image build but push nothing.

The `Dockerfile` has two stages. The build stage runs `hugo --gc --minify` on `hugomods/hugo:exts-0.154.5`, then `npx -y pagefind@1.5.0 --site public` to write the search index to `public/pagefind/`. The serve stage is `nginx:alpine` with `nginx.conf`, and it holds only `public/`. Keep Hugo in the `Dockerfile` and in the CI matrix on the same version. Keep Pagefind on 1.5.0, because 1.6.0 dies with `Illegal instruction` on the server's CPU (Xeon E5-2696 v2, no AVX2).

The site is static, so drafts never go live. The Hugo `baseURL` comes from `hugo.toml`. The `Dockerfile` takes a `BASE_URL` build arg that overrides it and defaults to `https://mr4x2.com/`, so CI and the live site build with the default. The verify skill's `prod` mode sets it to a local preview URL.

On the server, `docker-compose.yaml` runs the image behind Traefik on port 80. Watchtower, in the same compose file, checks for a new `:latest` every 5 minutes and recreates the blog container with the old container's command and labels. It swaps only the image. A change to `docker-compose.yaml` applies only after `git pull && docker compose up -d` in the server's checkout.

The first rollout of the nginx image needs one extra step. Run `docker compose stop watchtower` before you merge, so Watchtower cannot start nginx with the old `server -D` command and the old port 1313 label. After CI pushes the new `:latest`, run `git pull && docker compose pull && docker compose up -d`, check the site, then confirm that Watchtower runs again.

## Reading page

`/reading` lists the Bookmarks in the author's Raindrop Reading collection. Terms (Bookmark, Note, Excerpt, Read date) are defined in `CONTEXT.md`.

- Data flow: Raindrop → `.github/workflows/sync-reading.yml` (hourly) runs `scripts/sync_raindrop.py` → commits `data/reading.json` to `main` → dispatches `hugo.yml` → Docker Hub → Watchtower.
- `data/reading.json` is generated. Don't edit it by hand: the next sync overwrites it, and a Bookmark deleted in Raindrop disappears from the page.
- `layouts/_default/reading.html` renders it with `site.Data.reading` (`hugo.Data` doesn't exist in Hugo 0.145). The page builds and shows `Nothing here yet.` when the file is missing or `[]`.
- Run the sync locally with `set -a; . ./.env; set +a; python3 scripts/sync_raindrop.py`. It needs `RAINDROP_TOKEN` (a Raindrop test token) and `RAINDROP_COLLECTION_ID`. Add `--output <file>` to write somewhere else.
- Run the sync tests with `python3 -m unittest discover -s scripts -v`.

## Visual rules you can spot in a diff

The look is style B, a clean blog with a terminal flavor. Full spec: `docs/superpowers/specs/2026-11-22-new-theme-design.md`. Each rule is one a reviewer can catch in a diff.

1. **Tokens only.** Colors, font sizes, durations and easing curves are tokens in `assets/css/input.css`. Templates and scripts never declare a hex color, a `px` font size, an `ms` duration or a `cubic-bezier`. The one exception is the typing speed, a named constant at the top of the intro script.
2. **No gradients, no `backdrop-filter`, no glass.** The sticky header is a flat `--bg` fill. The search popup's backdrop is a flat `--backdrop` color.
3. **No emoji as icons.** Icons are inline SVG with Lucide paths, `stroke-width` 1.5, at 14px, 16px or 20px, one size per context. Emoji may appear only in post content the author wrote.
4. **Two weights.** Inter uses 400 for text and 600 for titles. JetBrains Mono uses 400, and 700 only for the logo. Never 500.
5. **One accent color.** Green marks a terminal element or a link, and nothing else. No second accent, no decorative color.
6. **No left-border accent blocks.** The `whoami` line sits under its prompt with no border.
7. **No cards around static text.** Post rows are separated by dashed dividers. The search popup is the only raised surface.
8. **The type scale is closed** (`--fs-*`). A new size is a new token.
9. **Motion changes only `transform`, `opacity` and color.** Never animate `height`, `margin` or position, and never use `blur` to bridge two states. View transitions are the one exception: the theme toggle grows the new theme as a `clip-path` circle, and the browser morphs a Post title between a list and the Post.
10. **One focus ring**, declared once in `assets/css/input.css`: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.

Dark mode is on purpose. Under `prefers-reduced-motion: reduce`, movement stops but opacity fades of 200ms stay.

## Avoid slop

These cover what you write: UI text, comments, commits and the shape of the code.

1. **No filler, no hedging.** Open with the fact. Say what you ran and what it showed.
2. **Comments say why, never what.** Delete a comment that restates the next line or a name.
3. **No generic UI copy.** A message says what happened and what to do next. No lorem ipsum, "Coming soon" or "Something went wrong".
4. **No emoji in UI strings, comments or commit messages.** Only post content the author wrote may hold one.
5. **No abstraction with one caller.** Write it inline, and extract it when a second real use lands.

Before you finish, run this from the repo root. It must print nothing:

```sh
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]|[Ll]orem|Coming soon|Something went wrong|backdrop-filter|-gradient\(|font-medium|font-weight: ?500' layouts assets/js assets/css/input.css hugo.toml
```

`.claude/skills/verify-mr4x2-blog/scripts/slop-check.sh` runs the line above, read from this file. The grep skips `content/`, because posts may hold the author's own emoji. Then reread your `git diff` and delete every added comment or string whose removal loses nothing.
