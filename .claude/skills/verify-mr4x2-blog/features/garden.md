# Garden mode

Garden is the third theme: the light page with a bed of twelve colored flowers along the bottom of the screen, behind a dashed line like the header's, and yellow bees. The theme button in the header steps dark → garden → light → dark and shows a moon, a flower or a sun for the mode the page is in. The bee after `built with hugo` in the footer is a button named `Garden mode`: it jumps to the garden from either theme, and a second press goes back to the theme the reader came from. The new mode grows as a circle from the button pressed. Three bees rest on the flowers, then fly between them and through the empty margins beside the text column, never over the text. A fourth bee follows the mouse, a little below and to the right of the pointer. On a touch screen a tap calls it to just above the finger. The 404 bee and the footer bee turn yellow too. Under reduced motion the garden is a still picture: three bees resting on flowers and no follower.

## Sub-features

- `garden-cycle` is the header button. Its name says what the next click does (`Switch to dark mode`, `Switch to garden mode`, `Switch to light mode`). Stepping to light or dark saves `mk-theme`. Stepping to the garden saves `mk-garden` = `on` and leaves `mk-theme` alone, so the theme the reader had is still known.
- `garden-toggle` is a 24px button around the 14px footer bee, with `aria-pressed`. A press from light or dark sets `mk-garden`. A press in the garden removes it, and the page goes back to `mk-theme`, or to the system's theme when there is none. Both buttons need JavaScript, so `.needs-js` hides them without it.
- `garden-first-frame` shows the garden on the first frame of every page, because `theme-init.js` sets `data-garden` and the light theme on `<html>` before first paint. A system theme change never leaves the garden.
- `garden-bed` is `display: block` only in the garden. The theme reveal brings it in, so it has no entrance of its own. It adds `padding-bottom: 4rem` to `body` and takes clicks itself, so a tap on a flower never reaches a link under it.
- `garden-wanderers` rest 1.5 to 4 seconds, then fly at about 120px a second on `--ease-in-out`, buzzing their wings. A bee going between a margin and anywhere else drops into the bed first, so its path never crosses the text column. Margins narrower than 64px are left out, so on a phone the bees stay in the bed.
- `garden-follower` is a spring (response 0.5s, damping 0.75) that reaches the point 18px right of and below the pointer. A new garden's follower starts there beside the button that turned it on. It turns to face where it flies, tilts with its climb, and buzzes only while moving. The next page starts it where it was (`mk-garden-bee` in sessionStorage).
- `garden-hidden` pauses every bee animation, its timers and the follower's frame loop while the tab is in the background, and resumes them when it comes back.
- `garden-reduced` places three bees on flowers with no animation and no follower, and a mode change cross-fades instead of growing a circle.

## How to get to it (user POV)

- Click the theme button in the header until it shows a flower: from light it takes two clicks, from dark one.
- Or scroll to the footer of any page and click the bee after `built with hugo`. Click it again to go back.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`. `prod` mode is closest to what readers get.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name garden $K/journeys/garden.json
node $K/scripts/drive.mjs --run RUN_ID --name garden-phone --width 390 --height 844 $K/journeys/garden.json
```

- **`garden.json`** starts light, whatever the driver emulates, since the garden has one look. It checks that the garden is off by default with a gray footer bee. It steps the header button light → dark → garden, checking at each step the saved keys, the button's name and its icon. In the garden it checks 12 flowers, 3 wanderers and 1 follower that starts beside the header button, the page padding and the yellow fill. For 8 seconds it samples the wanderers every 100ms and requires that they moved, that they flew, and that none was ever over the text column above the bed. It moves the mouse and waits for the follower beside the pointer, then fakes a tap and waits for the bee above it. It fakes a background tab, checks that nothing moves for 5 seconds, brings the tab back and checks that the bees fly again. It opens About and checks that the first frame has the garden and that the follower starts where it was. It steps to light and checks that the garden is gone. Then it presses the footer bee from light and from dark and checks that a second press goes back to that theme. Last, under reduced motion, it checks the still garden and that leaving it cross-fades.
- **`theme-system.json`** checks that the garden ignores a system theme change and that the footer bee leaves it for the system's theme when no theme is saved.
- **`not-found-nojs.json`** checks that the footer bee button hides without JavaScript and that the bed stays hidden.
- **Proof.** Keep `garden-reveal-mid`, `garden-on`, `garden-follower` and `garden-reduced`, at 1280px and at 390px.

## Gotchas

- Journey steps run in an isolated world, so redefining `document.hidden` in an `eval` does not reach the page's script. The journey's first step `inject`s a page-world `document.hidden` that reads the `data-test-hidden` attribute, which both worlds see.
- `pause()` takes effect on the next frame. Measure the frozen positions after two `requestAnimationFrame`s, or a bee mid-flight moves 1px.
- The mode changes one frame after a click, inside the view transition's update callback. Wait for `data-garden` and for `theme-reveal` (or `theme-fade` under reduced motion) to leave `<html>` before reading the page.
- The header button's name changes on every click, so the journeys click it as `"[data-theme-toggle]"`, and the footer bee as `"[data-garden-toggle]"`.
- The `theme-reveal` circle eases out, so past half its duration it already covers most of the screen. `garden-reveal-mid` shows the garden almost whole.
- `hover` points must be inside the viewport: x 300 works at both 1280 and 390.
- Headless Chromium has no hover, so the footer bee's hover flap is checked from the stylesheet in `motion.json`.
