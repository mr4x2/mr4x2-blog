# Post page

A Post page shows the date and reading time in monospace (`2025-03-29 · 3 min read`), the title, the tags (`#travel`), a `$ cat toc` table of contents that is open by default, the body with centered photos and their captions, links to the older and the newer Post, `cd ~`, and comments (giscus) in the site theme. About is a plain page: title, text and comments, with no date, tags, table of contents or older and newer links.

## Sub-features

- `post-header` shows `YYYY-MM-DD · N min read`, the title and the tags, each tag linking to `/tags/<tag>/`.
- `post-toc` shows `$ cat toc`, open by default, with links that jump to the headings. A heading stops below the sticky header.
- `post-figures` renders `![alt](path#center "Caption")` as a centered figure whose caption is the title text.
- `post-code` colors code blocks with the Chroma palette of the active theme.
- `post-nav` links to the older and the newer Post, and `cd ~` returns to `/`.
- `post-comments` loads giscus with the site theme, maps the thread by pathname, and sends giscus the new theme when the reader toggles it.
- `post-preview` uses the front-matter `image` for the social preview and the JSON-LD `image`, and falls back to `images/og-image.png`.
- `about-page` renders About as a plain page that keeps its giscus thread (`/about/`, 2 comments today).

## How to get to it (user POV)

- Click a Post title on the home page or a tag page.
- Click `newer` or `older` at the bottom of a Post.
- Follow a link to `/<slug>/` from outside.
- Click `about/` in the header for About.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.
- The Posts `A great trip in Thailand` (`/a-great-trip-in-thailand/`) and `Memorable days in France` exist.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name post $K/journeys/post.json
node $K/scripts/drive.mjs --run RUN_ID --name post-dark --dark $K/journeys/post.json
node $K/scripts/drive.mjs --run RUN_ID --name post-phone --width 390 --height 844 $K/journeys/post.json
node $K/scripts/drive.mjs --run RUN_ID --name about $K/journeys/about.json
node $K/scripts/drive.mjs --run RUN_ID --name post-giscus $K/journeys/post-giscus.json
```

- **`post.json`** opens the Thailand Post from the list and checks the date and reading time, title, tags, the open `$ cat toc`, and that the first TOC link lands the heading below the header. It checks the two captions (`Canals in Bangkok`, `Pad Thai`), that a `#center` image is centered, that a photo loads where the reader scrolls, that the page does not scroll sideways (the YouTube iframe is 560 px wide in the Markdown), the JSON-LD and `og:image` image, and the giscus script's theme, mapping and repo. It injects a code block to check both Chroma palettes, then follows `newer`, `older` and `cd ~`. Run it with `--dark` and `--width 390` too.
- **`about.json`** opens About from the menu, checks that it has no date, TOC, tags or older and newer links, that the text renders, and that giscus keeps the pathname mapping.
- **`post-giscus.json`** needs the network. It waits for the real giscus iframe, checks that its `theme` query is the site theme, toggles the theme, and checks that the page posted `{giscus: {setConfig: {theme}}}` to `https://giscus.app`. Its two screenshots show the comments before and after. Report it as skipped, with the reason, when giscus.app is unreachable.
- **Proof.** Keep `post-top`, `post-figure`, `post-code`, `giscus-before` and `giscus-after`.

## Gotchas

- giscus maps threads by pathname, so a `127.0.0.1` run shows the real thread of the same path.
- Photos come from `static/trip-in-<place>/`, are big (up to 1.6 MB) and use `loading="lazy"`. Photos below the fold never load until scrolled to, so `every(img.complete)` over the whole page is false by design. Scroll to the one you check.
- Image URLs carry a `?v=<hash>#center` suffix added by the `hugomods/images` module. Match on the path, not the full URL. The module's own classes (`figure`, `d-block`) have no CSS here, so `.prose figure` in `input.css` does the centering. Do not rely on a Tailwind class for it.
- The Markdown has no code block, so `post.json` injects one. A real code block uses the same `.chroma` classes.
- Check sideways scroll against `VW`, the width the driver emulates, never `screen.width` at desktop width.
- The `.prose` overrides live in `@layer utilities` in `input.css`, because the typography plugin declares `.prose` there. A `.prose` rule in `components` is silently ignored.
- A full-page `shot` of the Thailand Post stops at 4000 px. Use `scroll` plus a viewport shot for anything lower.
