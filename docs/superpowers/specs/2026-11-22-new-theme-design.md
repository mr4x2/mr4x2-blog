# New theme for mr4x2.com: design

Issue: #16. Depends on #15 (Reading page) and #19 (static build with Pagefind).

## Intent

The author wants mr4x2.com to have its own style. The two sites they named as examples are [aleksagordic.com](https://www.aleksagordic.com/), a black terminal page, and [hoangndst.com](https://www.hoangndst.com/), a clean editorial blog. The new theme mixes the two. Pages read like a clean blog, and the parts about the author look like a shell session.

Today a visitor should see the writing first. Later, the author wants the home page to lead with who they are. The home page is built so that this switch is a small template edit.

The author also wants the site to feel more alive, like Hoang's. Three interactive features ship now: search, dark mode, and a typing intro. The motion follows Emil Kowalski's design-engineering rules (the `emil-design-eng` skill).

## Goals

- Restyle every page in style B, which is clean with a terminal flavor.
- Show the writing first on the home page, under a short `$ whoami` intro.
- Add a search popup that opens with ⌘K, Ctrl K, or `/`, backed by Pagefind.
- Add dark mode. It follows the system setting until the reader picks one, then remembers the pick.
- Add a typing intro on the home page that plays once per browser session.
- Keep every URL and feature on the must-keep list below.

## Non-goals

- The "who I am" home page. The blocks make it possible later, but this work does not build it.
- A Spotify "listening now" widget and Notion-backed notes. Both come later, in separate issues.
- Migrating to Next.js, React, or a theme module.
- Rewriting post content. A post edit is limited to front matter the theme needs.

## Anti-goals

These would make the work a failure even if every feature runs:

- Motion that slows the reader down. The post list never waits for the typing, and keyboard-opened UI never animates.
- Content hidden from search engines or no-JS readers. All text is in the HTML. JavaScript only delays its reveal.
- A flash of the wrong theme or of unstyled content on load.
- A broken link to any existing page or giscus thread.

## Constraints

- **Order of work.** #15 merges to `main` first. #19 ships to production before this theme merges. This branch, `new-ui-theme`, starts from `de8a77d` and must be rebased onto `main` after both land. It is already behind `main` by PR #18.
- **Hugo versions.** Local Hugo is 0.145.0. The server image runs Hugo 0.154.5. `hugo --gc` must pass on both.
- **CSS build.** Tailwind v4 stays. `assets/css/output.css` stays compiled and committed (`npm run build`).
- **JavaScript.** No runtime npm packages. Scripts are plain JavaScript, bundled with Hugo's built-in `js.Build`. Pagefind ships its own `pagefind.js`, which the site loads at runtime.
- **Pagefind version.** Pin `pagefind@1.5.0`. Version 1.6.0 crashes with `Illegal instruction` on the server's CPU, which has no AVX2 (measured 2026-11-22, see #19).
- **Production.** `docker compose` in `/home/mr8/projects/mr4x2-blog` is production. Never run it from this work without the author's go-ahead.

### Must keep working (from #16)

- [ ] Same URLs: `/<slug>/`, `/tags/<tag>/`, `/about/`, and `/reading/` from #15. giscus maps threads by pathname.
- [ ] Post images through the `hugomods/images` module. `#center` centers an image, and its title becomes the caption.
- [ ] Social preview from the front-matter `image`, with `static/images/og-image.png` as the fallback.
- [ ] giscus comments, configured in `[params.giscus]` in `hugo.toml`.
- [ ] A table of contents on posts.
- [ ] The tags page and the tag filter.
- [ ] Header menu: Contact, Tags, Reading, and About.
- [ ] Raw HTML in Markdown, such as `target="_blank"` links and iframes.
- [ ] `hugo --gc` passes, because CI gates on it.

## Approaches considered

The page templates and Tailwind are the same in every approach. The approaches differ in how the interactive parts are built.

| Approach | What it means | Trade-off |
| --- | --- | --- |
| 1. Plain JavaScript, bundled by Hugo | Three small scripts. Search filters a `/index.json` list that Hugo writes. | Works with the current deploy. Search matches titles, summaries, and tags well, but its full-text matching is basic. |
| 2. Alpine.js | Behavior lives in template attributes such as `x-data`. | Adds a library and a second style next to the Reading page's plain JavaScript. Too much for three features. |
| 3. Pagefind for search, plain JavaScript for the rest | Pagefind indexes the built HTML. The site's own popup calls Pagefind's JavaScript API. | Best search. It handles full text and word forms, and it scales. It needs finished HTML files, so production must build static files (#19). |

**Picked: 3.** The author chose it. The deploy change it needs also stops production from running a development server and from publishing drafts.

## Design decisions

### Look

- Fonts: Inter for text, JetBrains Mono for terminal parts. Self-host both as `woff2` files under `static/fonts/`. The site makes no request to Google Fonts.
- Turn off Inter's contextual alternates (`font-feature-settings: "calt" 0`) on the site name. Without it, Inter renders "mr4x2" as "mr4×2".
- Colors are CSS variables, switched by `data-theme` on `<html>`. These are the values from the approved prototype.

  | Token | Light | Dark |
  | --- | --- | --- |
  | `--bg` | `#fbfaf7` | `#0e100f` |
  | `--surface` | `#ffffff` | `#151817` |
  | `--ink` | `#1b1b1a` | `#e7e7e3` |
  | `--muted` | `#6b6a66` | `#959b97` |
  | `--faint` | `#9a978f` | `#6a706c` |
  | `--line` | `#e5e1d8` | `#262b29` |
  | `--accent` | `#0f8a5f` | `#3ddc97` |
  | `--accent-soft` | `rgba(15, 138, 95, 0.09)` | `rgba(61, 220, 151, 0.10)` |

- Dividers are dashed 1px lines in `--line`.
- Terminal elements are in monospace: the logo prompt, command lines such as `$ whoami` and `$ ls -t ~/posts`, dates as `YYYY-MM-DD`, and tags as `#tag`. Titles, summaries, and post text use Inter.
- Font weights are a closed set. Inter uses 400 for text and 600 for titles. JetBrains Mono uses 400, and 700 only for the logo.

The approved prototype is `docs/superpowers/specs/2026-11-22-new-theme-prototype.html`, which is v2 with the anti-slop changes below applied. It is the reference for spacing, sizes, and motion. It loads its photos from the brainstorm server, so they are missing when you open the file directly.

## Rules against UI slop

These rules come from the author's `lms-pages` project (`CLAUDE.md` sections "Visual rules you can spot in a diff" and "Avoid slop", and `docs/DESIGN.md` section "Luật cứng khi sinh code"). They are adapted to a personal blog. A reviewer can spot each violation in a diff.

### Visual rules

1. Colors, font sizes, durations, and easing curves are tokens in `assets/css/input.css`. Templates and scripts never declare a hex color, a font size in `px`, an `ms` duration, or a `cubic-bezier`. One exception is the typing speed, a named constant at the top of the intro script.
2. No gradients, no `backdrop-filter`, and no translucent "glass" surfaces. The sticky header is a flat `--bg` fill. The search popup's backdrop is a flat `--backdrop` color.
3. No emoji as icons. Icons are inline SVG with Lucide paths, `stroke-width` 1.5, at 14px, 16px, or 20px. Each context keeps one size on every page. Emoji may appear only in post content that the author wrote.
4. The font weights are the closed set from the Look section. Never use 500.
5. One accent color. Green marks a terminal element or a link, and nothing else. No second accent, no purple, and no decorative color.
6. No left-border accent blocks. The `whoami` line sits under its prompt with no border, like real terminal output.
7. No cards around static text. Post rows are separated by dashed dividers, not boxed. The search popup is the only raised surface.
8. The type scale is closed (`--fs-*` tokens). A new size is a new token.
9. Motion changes only `transform`, `opacity`, and color. Never animate `height`, `margin`, or position, and never use `blur` to bridge two states.
10. One focus ring, declared once: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.

Dark mode is a deliberate exception to the `lms-pages` rule "no dark mode unless asked". The author asked for it in this design.

Reduced motion follows the `emil-design-eng` rule instead of the `lms-pages` rule. Movement stops, but opacity fades of 200ms stay, because they help the reader see what changed.

### Writing rules for UI text, comments, and commits

1. No filler and no hedging. Open with the fact.
2. Comments say why, never what. Delete a comment that restates the next line.
3. No generic UI copy. A message says what happened and what to do next. No lorem ipsum, "Coming soon", or "Something went wrong".
4. No emoji in UI strings, comments, or commit messages.
5. No abstraction with one caller. Write it inline, and extract it when a second real use lands.

### The check

`CLAUDE.md` gets an "Avoid slop" section with these rules and a `grep` that must print nothing before any work is finished:

```sh
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]|[Ll]orem|Coming soon|Something went wrong|backdrop-filter|-gradient\(|font-medium|font-weight: ?500' layouts assets/js assets/css/input.css hugo.toml
```

The grep skips `content/`, because posts may hold the author's own emoji.

### Header (every page)

- On the left is the logo `mr4x2@blog:~$` with a blinking block cursor. It links to `/`.
- On the right are the menu links `reading/`, `tags/`, `about/`, and `contact`. Directories get a trailing slash. `contact` is the `mailto:` link, so it has none. The links come from `[[menus.main]]` in `hugo.toml`.
- Then come a **Search** button with a `⌘K` hint (`Ctrl K` on other systems) and the theme toggle.
- The header is sticky, with a flat `--bg` background and a dashed bottom border.
- Below 640px, the menu links move to a second row that scrolls sideways.

### Home page

`layouts/index.html` (new) renders two blocks, each a partial:

1. `partials/home/whoami.html` shows `$ whoami`, then one line about the author. The line comes from `params.whoami` in `hugo.toml`, so the author edits it without touching templates. The first value is the prototype's text: "mr8: Ceph object storage engineer, OpenInfra Europe 2025 speaker. I write about trips and tech, in English, to get better at it."
2. `partials/home/posts.html` shows `$ ls -t ~/posts`, then a line of tag links, then the posts, newest first, with the existing pagination. A row has the date, title, summary, tags, and a thumbnail from the front-matter `image`. A row without `image` has no thumbnail column.

The tag links under `$ ls -t ~/posts` replace the "Filter by tag" sidebar. Each link goes to `/tags/<tag>/`.

The About page leaves the post list. Set `build: { list: never }` in `content/about/index.md`, the same way #15 keeps `/reading/` out of the list.

### About page

- About renders as a plain page: title, text, and giscus. It has no date, reading time, tags, or older and newer links. Its giscus thread already has 2 comments, so the pathname mapping must not change.
- About stays in search. Its article element gets `data-pagefind-body`, like a post.
- Remove the `readme` and `info` tags from About's front matter. With `list: never`, those tags would show `(1)` in `.Site.Taxonomies` but link to empty pages. Only About used them, so `/tags/readme/` and `/tags/info/` stop existing. This is the one URL change in this work.

The later switch to "who I am" adds a `partials/home/profile.html` block and caps the post count. Nothing is built for it now.

### Post page

- At the top are the date and reading time in monospace (`2026-02-17 · 6 min read`), then the title, then the tags.
- The table of contents is a `<details open>` block above the text, with a monospace label `$ cat toc`.
- The text uses Tailwind Typography (`prose`), restyled with the color tokens and about 68 characters per line. `hugomods/images` keeps rendering images and captions.
- Code blocks use Chroma classes (`noClasses = false` is already set). There are two palettes, one under each `data-theme`, generated with `hugo gen chromastyles`.
- giscus loads with the current site theme. When the reader toggles the theme, the page sends giscus a `setConfig` message with the new theme.
- At the bottom are links to the older and the newer post, then `cd ~` back to the home page.
- The article element gets `data-pagefind-body`, so Pagefind indexes post text and nothing else.
- The JSON-LD block uses the post's own preview image instead of the hard-coded `/images/og-image.png`.

### Tag pages and the tags page

- `/tags/` lists every tag in monospace with its post count, such as `#travel (2)`.
- `/tags/<tag>/` shows `$ ls -t ~/posts --tag=<tag>`, then the same post rows as the home page. It reuses `partials/home/posts.html` or a shared row partial.

### Reading page

Port `layouts/_default/reading.html` from #15 to the new color tokens and fonts. Keep its own tag filter and text search. The site search popup does not search individual bookmarks.

### 404 page

The page shows `bash: cd: <path>: No such file or directory`, then a link to `/`. A small script fills in `<path>` from `location.pathname`. Without JavaScript, the line shows `/missing-page`.

### Footer

The footer is one monospace line: `© <year> mr4x2 · github · rss · built with hugo`. `github` links to `params.github`, which moves here from the header icon. `rss` links to `/index.xml`. The "Built with hugo-discaptive" credit goes away.

## Interactive features

### Typing intro (home page only)

- Only the word `whoami` types out, at 65ms per character after a 180ms pause. It takes about 0.6 seconds.
- The `whoami` line waits for the typing, then fades in and moves up 6px.
- The post list does not wait for the typing. At load, the `$ ls` line and each post row fade in and move up 6px, 60ms apart. With 5 rows, the last row is fully in at about 0.7 seconds.
- Each element uses a 320ms transition on `opacity` and `transform`, with `cubic-bezier(0.23, 1, 0.32, 1)`.
- It plays once per browser session. The key `mk-intro-seen` in `sessionStorage` marks it played. Later visits in the same session show everything at once.
- With `prefers-reduced-motion: reduce`, nothing types or moves. The content fades in over 200ms.
- An inline script in `<head>` adds the hidden-state class before first paint, so the final content never flashes before the typing.

### Dark mode

- An inline script in `<head>` sets `data-theme` before first paint. It uses the saved choice in `localStorage` (`mk-theme`) and otherwise the system setting.
- While the reader has no saved choice, the page follows changes to the system setting.
- The toggle button swaps a sun icon and a moon icon. Each icon changes `opacity` and `transform` (`scale(0.85) rotate(-25deg)`) over 200ms.
- The page colors switch at once. A `theme-swapping` class turns off transitions for one frame, except on the icons.
- `<meta name="color-scheme">` and `theme-color` follow the theme.

### Search popup

- ⌘K or Ctrl K toggles the popup. `/` opens it when focus is not in a text field. Esc closes it and returns focus to where it was.
- The popup opens and closes with no animation, because readers open it from the keyboard.
- The input row starts with `$ grep -i`. Up and down arrows move the selection, and Enter opens the selected post. Moving the mouse over a row selects it.
- On the first open, the script loads `/pagefind/pagefind.js` with a dynamic `import()`. It calls `pagefind.debouncedSearch()` and shows up to 8 results. A result shows the date, tags, title, and Pagefind's excerpt with its `<mark>` highlights.
- Posts declare `date` and `tags` as Pagefind metadata with `data-pagefind-meta`.
- With no match, the popup shows `grep: no posts match "<query>"`.
- If `/pagefind/pagefind.js` fails to load, the popup shows `grep: search index not found`. Locally, that means the index was not built, and `npm run search` builds it.
- The popup is a `role="dialog"` with `aria-modal="true"`. The input is a `combobox` that controls a `listbox`.

### Small touches

- Buttons scale to 0.97 while pressed (160ms).
- On devices with a fine pointer that can hover, the post title turns `--accent` (150ms) and the thumbnail scales to 1.03 (300ms). These effects sit behind `@media (hover: hover) and (pointer: fine)`.
- The logo cursor blinks with `steps(1)`. With reduced motion it stays solid.

## Files

| Action | Path |
| --- | --- |
| Create | `layouts/index.html`, `layouts/partials/home/whoami.html`, `layouts/partials/home/posts.html`, `layouts/partials/search.html` (popup markup) |
| Create | `assets/js/theme-init.js` (inlined in `<head>`), `assets/js/main.js` (theme toggle, intro, search) |
| Create | `static/fonts/` (Inter and JetBrains Mono `woff2`) |
| Rewrite | `layouts/_default/baseof.html`, `single.html`, `list.html`, `terms.html`, `layouts/tags/tag.html`, `layouts/404.html`, `layouts/partials/header.html`, `footer.html`, `head.html`, `head/css.html`, `pagination.html`, `post-summary.html` |
| Port | `layouts/_default/reading.html` (from #15) |
| Edit | `assets/css/input.css` (tokens, `@custom-variant dark`, Chroma palettes), `hugo.toml` (`params.whoami`, menu labels), `content/about/index.md` (`build.list`, drop `readme` and `info` tags), `package.json` (rename from `hugo-discaptive`, add a `search` script), `.gitignore` (`static/pagefind/`), `CLAUDE.md` |
| Edit | `.claude/skills/verify-mr4x2-blog/` (from #15): rewrite `features/home.md`, `post.md`, `tags.md`, and `reading.md`, and add `scripts/slop-check.sh` and the rendered-text check |
| Delete | `layouts/partials/sidebar.html`, `theme.toml` |

The `search` script in `package.json` builds the site, runs `npx -y pagefind@1.5.0 --site public --output-path static/pagefind`, and leaves `hugo server` to serve the index from `static/`. `CLAUDE.md` documents it.

## Verification

- `hugo --gc` passes with Hugo 0.145.0 and with a freshly pulled `hugomods/hugo:exts` image. CI uses Hugo `latest`, so the image that deploys may be newer than 0.154.5. Pinning versions belongs to #19.
- Update the `verify-mr4x2-blog` skill from #15 as part of this work. Its recipes `features/home.md`, `post.md`, and `tags.md` check old-theme markup, such as the "All Posts" heading and the "Read Article" links, so they fail by design. Rewrite them for the new pages. Add these parts, modeled on the `verify-lms-pages` skill in `lms-pages`:
  - `scripts/slop-check.sh` reads the `grep` line under "Avoid slop" in `CLAUDE.md` at run time and runs it. It never keeps its own copy of the rule. It exits 1 on a match, 0 on none, and 2 when it cannot find the rule.
  - A rendered-text check runs after each page state the journeys care about. It flags the same patterns in the visible text of the theme, meaning the header, footer, home intro, search popup, tag lists, and 404 page. It skips post bodies and Reading bookmarks, because those hold the author's and other people's text. A finding fails the step.
  - `VERIFY_PLANT_SLOP=1` injects "Coming soon" and an emoji into the header before the check, and the run must then fail. This proves the check still catches slop.
  - Each page state saves a screenshot and its rendered text as evidence.
- Run the updated skill against `hugo server` after `npm run search`. Check each item below in light and dark mode, at 1280px and 390px wide:
  - The home page plays the typing intro once per session, and not at all with reduced motion.
  - Search finds "Bangkok", which appears only in the Thailand post's body text. Arrow keys, Enter, and Esc work.
  - A post page shows the table of contents, centered captioned images, and giscus in the matching theme.
  - Every item on the must-keep list works.
- With JavaScript turned off, the home page shows all text, and the header links work.
- Reload in dark mode and confirm that no light frame shows.

## Left to the builder

- Exact Tailwind classes, spacing, and breakpoints, within the prototype's look.
- The icon SVGs and the Chroma palette names.
- How `main.js` splits into modules.
- How to compute reading time. Hugo's `.ReadingTime` is fine.

## Later, in separate issues

- The "who I am" home page.
- A Spotify "listening now" widget.
- Notion-backed notes.
