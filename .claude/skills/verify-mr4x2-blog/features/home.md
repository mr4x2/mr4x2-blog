# Home page

The home page opens with `$ whoami` and one line about the author, then `$ ls -t ~/posts`, a line of tag links, and the Posts newest first. A row shows the date (`2026-02-17`), the title, the summary, the tags (`#travel`) and a thumbnail from the front-matter `image`. The header and footer are on every page and are checked here too: logo, menu (`reading/`, `tags/`, `about/`, `contact`), Search, theme toggle, and the footer line. On the first visit of a browser session `whoami` types itself out while the list fades in. Later visits in the session show everything at once.

## Sub-features

- `home-whoami` shows the line from `params.whoami` under the `$ whoami` prompt, with no accent border.
- `home-list` lists the Posts only, newest first. About and Reading never appear in it.
- `home-tags` shows one link per Post tag under `$ ls -t ~/posts`, most used first, each going to `/tags/<tag>/`.
- `home-thumb` shows a resized WebP thumbnail per row that has an `image`, never the original photo.
- `home-menu` shows the header links in order, with `contact` as a `mailto:` link.
- `home-intro` types `whoami` once per session at 65 ms per character after a 180 ms pause. The list fades in from load and does not wait for the typing.
- `home-reduced` types and moves nothing under `prefers-reduced-motion: reduce`, fades the content in over 200 ms, and cross-fades the theme toggle over 200 ms.
- `home-contrast` darkens the grays, the dashed lines and the light green under `prefers-contrast: more`, so muted text reaches 7:1, faint text and links 4.5:1 and lines 3:1. Dark keeps its green.
- `home-nojs` shows all text with JavaScript off. The Search and theme buttons stay hidden.
- `home-failsafe` shows the text after 2 seconds even when `main.js` never runs.

## How to get to it (user POV)

- Open the site root `/`.
- Click the logo in the header on any page.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.
- The working tree has the two travel Posts and the About page, and `data/reading.json` is the committed one.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name home $K/journeys/home.json
node $K/scripts/drive.mjs --run RUN_ID --name home-dark --dark $K/journeys/home.json
node $K/scripts/drive.mjs --run RUN_ID --name home-phone --width 390 --height 844 $K/journeys/home.json
node $K/scripts/drive.mjs --run RUN_ID --name home-intro $K/journeys/home-intro.json
node $K/scripts/drive.mjs --run RUN_ID --name home-intro-blocked $K/journeys/home-intro-blocked.json
node $K/scripts/drive.mjs --run RUN_ID --name home-reduced $K/journeys/home-reduced.json
node $K/scripts/drive.mjs --run RUN_ID --name home-contrast $K/journeys/home-contrast.json
node $K/scripts/drive.mjs --run RUN_ID --name home-nojs --no-js $K/journeys/home-nojs.json
```

- **`home.json`** waits for the intro to end, then checks the `whoami` prompt and line, the `ls` line, the tag links (`#travel`, `#fossasia`, `#france`, `#openinfra-submit`, `#thailand`), the titles and dates newest first, each row's tags, that About and Reading are not listed, that there is no pager, a loaded thumbnail per row under 30 KB, and no accent border on `whoami`. It saves a screenshot and the rendered text, then clicks `tags/`, `#travel`, a Post title and the logo. Run it with `--dark` and with `--width 390` too.
- **`home-intro.json`** samples the page every 50 ms during the first visit. `whoami` must grow one character at a time while the class on `<html>` is `intro-typing`, the answer line must stay hidden until the typing ends, and the list must already be fading in. It ends with no class and the key `mk-intro-seen` set. A second visit must show everything at once.
- **`home-intro-blocked.json`** blocks `main.*.js`. The page must keep the hidden state (`intro-pending`, every opacity 0), then show everything after the 2 second failsafe.
- **`home-reduced.json`** never types, never moves (`transform: none`), fades in over 0.2 s and keeps the logo cursor solid. Its theme toggle runs a 200 ms cross-fade (`theme-fade`), never the circle.
- **`home-contrast.json`** reads the four color tokens with no preference, then under `prefers-contrast: more` in light and in dark, and checks a summary, the header divider and a tag link. Its `media` steps set the color scheme too, so `--dark` changes nothing.
- **`home-nojs.json`** checks the text, the header links and the hidden buttons with JavaScript off.
- **Proof.** Keep `home`, `after-intro`, `hidden-state` and `failsafe`, at 1280 and 390, light and dark, plus `contrast-light` and `contrast-dark`.

## Gotchas

- Every journey starts with a fresh browser profile, so the intro plays on the first `goto`. A journey that does not care about it waits for `!document.documentElement.className.includes('intro')`.
- The thumbnail comes from `resources.Get "photos/<image>"`, where `static/trip-in-*` is mounted at `assets/photos` in `hugo.toml`. A Post whose `image` is not under `static/trip-in-*` gets a row with no thumbnail.
- Tag names come from the term key through `urlize`, so `openinfra submit` shows as `#openinfra-submit`.
- `pagerSize` is 5. The pager shows only with 6 or more listed Posts, and says `newer` and `older`.
- Headless Chromium draws nothing until its first capture. `drive.mjs` takes one at startup, so transitions and `requestAnimationFrame` run. Do not remove it.
- The Contact link is a `mailto:`. Don't click it in journeys.
