# Motion

The motion that isn't the home intro. The logo cursor blinks ten times, then stays solid. A whole Post row opens the Post, but its tag links still go to their tags. The theme toggle grows the new theme as a circle from the button. Opening a Post from a list moves its title into place as the page changes. On a Post, a green bar along the bottom of the header fills as the reader moves through the article. Photos fade in once they have loaded, and the `$ cat toc` list fades when it opens or closes. With a mouse, the header buttons turn to ink on hover. The Reading chips change color and outline together.

## Sub-features

- `motion-cursor` stops the logo cursor after ten blinks.
- `motion-row-link` makes the summary and thumbnail part of the row's link, with the tag links above it.
- `motion-theme-reveal` grows the new theme from the toggle with a view transition and a `clip-path` circle, then removes the `theme-reveal` class. Under reduced motion the swap is instant.
- `motion-title-morph` gives each Post title the same `view-transition-name` in the list and on the Post, so a page change morphs it on its own.
- `motion-progress` fills the bar under the header on Posts only, from empty at the top to full at the end of the article.
- `motion-photos` hides a photo that hasn't loaded yet, then fades it in.
- `motion-toc` fades the TOC in over 200ms and out over 150ms.
- `motion-hover` gives header buttons a hover color and border, for mouse pointers only, and makes the chip's fill and border follow its text color.

## How to get to it (user POV)

- Open `/`, click the theme toggle, then click a Post title.
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

- **`motion.json`** checks the cursor's iteration count, the title names, what sits under the middle of a summary and of a tag link, and the hover rule. It toggles the theme and waits for the `theme-reveal` animation on `::view-transition-new(root)`, then checks that the other theme is applied and saved and which way the hidden icon turned. It opens the newest Post from the list three times and reads each `pagereveal` event, requiring at least one view transition with a group for that title. Then it checks the progress bar at the top, halfway and at the end, photos fading in, the TOC fade, that About has no bar, and the chip transition.
- **`home-reduced.json`** checks that the theme swaps at once under reduced motion.
- **Proof.** Keep the `theme-reveal-mid` screenshot (the circle half grown) and `progress-half`.

## Gotchas

- Headless Chromium has no hover-capable pointer, so `(hover: hover) and (pointer: fine)` never matches. The journey reads the `.btn:hover` rule from the stylesheet instead of hovering.
- The theme changes one frame after the click, inside the view transition's update callback. A step that reads `data-theme` right after a click must `wait` for it, as `chrome.json` and `theme-system.json` do.
- Headless Chromium 130 on this machine skips the incoming side of a page transition about 1 time in 8, with or without a theme change before it: `pageswap` has a view transition and `pagereveal` has none, and the page loads normally. So the journey opens the Post three times and requires the title morph in at least one.
- A `view-transition-name` must be unique on a page, or the browser skips the whole transition. Titles use `post-` plus the anchorized permalink, and a list never shows a Post twice.
- A browser without `::details-content` opens the TOC instantly, and the journey skips those checks there.
- `chrome.json` asserts a light default, so it fails under `--dark` by design.
