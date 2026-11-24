# Motion

The motion that isn't the home intro. The logo cursor blinks ten times, then stays solid. A whole Post row opens the Post, but its tag links still go to their tags. The theme button grows the next mode (dark, garden, light) as a circle from the button. Opening a Post from a list moves its title into place as the page changes. On a Post, a green bar along the bottom of the header fills as the reader moves through the article. Photos fade in once they have loaded, and the `$ cat toc` list fades when it opens or closes. With a mouse, the header buttons turn to ink on hover. The Reading chips change color and outline together.

## Sub-features

- `motion-cursor` stops the logo cursor after ten blinks.
- `motion-row-link` makes the summary and thumbnail part of the row's link, with the tag links above it.
- `motion-theme-reveal` grows the next mode from the button pressed, the header button or the footer bee, with a view transition and a `clip-path` circle, then removes the `theme-reveal` class. The header icon turns the same way on every click: the icon that leaves turns on, and the next one waits turned back. Under reduced motion it cross-fades over 200ms with `theme-fade` instead.
- `motion-title-morph` gives each Post title the same `view-transition-name` in the list and on the Post, so a page change morphs it on its own.
- `motion-progress` fills the bar under the header on Posts only, from empty at the top to full at the end of the article.
- `motion-photos` hides a photo that hasn't loaded yet, then fades it in.
- `motion-toc` fades the TOC in over 200ms and out over 150ms.
- `motion-hover` gives header buttons a hover color and border, for mouse pointers only, and makes the chip's fill and border follow its text color.
- `motion-bee-sign` puts a 14px bee after `built with hugo` in the footer. It sits still and flaps its wings twice on hover, for mouse pointers with full motion only. It is also the garden mode button (`garden.md`). The 404 bee is in `not-found.md`.

## How to get to it (user POV)

- Open `/`, click the theme button, then click a Post title.
- On the Post, scroll down, then close and open `$ cat toc`.
- Open `/reading/` and click a tag chip.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`. `prod` mode is closest to what readers get.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name motion $K/journeys/motion.json
node $K/scripts/drive.mjs --run RUN_ID --name motion-dark --dark $K/journeys/motion.json
```

- **`motion.json`** checks the cursor's iteration count, the title names, the footer bee's hover rule and size, what sits under the middle of a summary and of a tag link, and the hover rule. It steps the theme button and waits for the `theme-reveal` animation on `::view-transition-new(root)`, then checks that the next mode is applied and saved (light goes to dark, dark to the garden) and which way the hidden icons turned. Two more clicks 60ms apart must finish the cycle where it started. It opens the newest Post from the list three times and reads each `pagereveal` event, requiring at least one view transition with a group for that title. Then it checks the progress bar at the top, halfway and at the end, photos fading in, the TOC fade, that About has no bar, and the chip transition.
- **`home-reduced.json`** checks the 200ms cross-fade under reduced motion.
- **Proof.** Keep the `theme-reveal-mid` screenshot (the circle half grown) and `progress-half`.

## Gotchas

- Headless Chromium has no hover-capable pointer, so `(hover: hover) and (pointer: fine)` never matches. The journey reads the `.btn:hover` rule from the stylesheet instead of hovering.
- The theme changes one frame after the click, inside the view transition's update callback. A step that reads `data-theme` or `data-garden` right after a click must `wait` for it, as `chrome.json`, `theme-system.json` and `garden.json` do.
- The theme button's name says what the next click does (`Switch to garden mode`), so it changes on every click. Journeys click it as `"[data-theme-toggle]"`.
- Headless Chromium 130 on this machine skips the incoming side of a page transition about 1 time in 8, with or without a theme change before it: `pageswap` has a view transition and `pagereveal` has none, and the page loads normally. So the journey opens the Post three times and requires the title morph in at least one.
- A `view-transition-name` must be unique on a page, or the browser skips the whole transition. Titles use `post-` plus the anchorized permalink, and a list never shows a Post twice.
- A browser without `::details-content` opens the TOC instantly, and the journey skips those checks there.
- `chrome.json` asserts a light default, so it fails under `--dark` by design.
- The prod build's `--minify` drops the space after `)` in `var(--dur-flap) ease-in-out`. The browser still parses it, so the footer bee check puts the space back before comparing.
- `elementFromPoint` returns `null` below the fold. On a phone the Top tracks push the first Post row down, so the journey scrolls it into view first.
