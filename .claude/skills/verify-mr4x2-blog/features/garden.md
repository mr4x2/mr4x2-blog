# Garden mode

The bee after `built with hugo` in the footer is a button named `Garden mode`. Pressing it turns on a garden that stays on, on every page, until the reader presses it again. A bed of twelve colored flowers slides up along the bottom of the screen, behind a dashed line like the header's, and the page gets room for it at the end. Three yellow bees rest on the flowers, then fly between them and through the empty margins beside the text column, never over the text. A fourth bee follows the mouse, a little below and to the right of the pointer. On a touch screen a tap calls it to just above the finger. The 404 bee and the footer bee turn yellow too. Under reduced motion the garden is a still picture: three bees resting on flowers and no follower.

## Sub-features

- `garden-toggle` is a 24px button around the 14px footer bee, with `aria-pressed`. It needs JavaScript, so `.needs-js` hides it without. `mk-garden` = `on` in localStorage remembers the choice, and turning it off removes the key.
- `garden-first-frame` shows the bed on the first frame of every page while the garden is on, because `theme-init.js` sets `data-garden` on `<html>` before first paint.
- `garden-bed` slides up over 320ms when turned on and down when turned off, adds `padding-bottom: 4rem` to `body` and takes clicks itself, so a tap on a flower never reaches a link under it.
- `garden-wanderers` rest 1.5 to 4 seconds, then fly at about 120px a second on `--ease-in-out`, buzzing their wings. A bee going between a margin and anywhere else drops into the bed first, so its path never crosses the text column. Margins narrower than 64px are left out, so on a phone the bees stay in the bed.
- `garden-follower` is a spring (response 0.5s, damping 0.75) that reaches the point 18px right of and below the pointer. It turns to face where it flies, tilts with its climb, and buzzes only while moving. The next page starts it where it was (`mk-garden-bee` in sessionStorage).
- `garden-hidden` pauses every bee animation, its timers and the follower's frame loop while the tab is in the background, and resumes them when it comes back.
- `garden-reduced` places three bees on flowers with no animation and no follower, and the bed fades instead of sliding.

## How to get to it (user POV)

- Scroll to the footer of any page and click the bee after `built with hugo`. Click it again to turn the garden off.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`. `prod` mode is closest to what readers get.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name garden $K/journeys/garden.json
node $K/scripts/drive.mjs --run RUN_ID --name garden-dark --dark $K/journeys/garden.json
node $K/scripts/drive.mjs --run RUN_ID --name garden-phone --width 390 --height 844 $K/journeys/garden.json
```

- **`garden.json`** checks that the garden is off by default with a gray footer bee, then turns it on and checks the button state, the key, 12 flowers, 3 wanderers and 1 follower, the bed in place, the page padding and the yellow fill. For 8 seconds it samples the wanderers every 100ms and requires that they moved, that they flew, and that none was ever over the text column above the bed. It moves the mouse and waits for the follower beside the pointer, then fakes a tap and waits for the bee above it. It fakes a background tab, checks that nothing moves for 5 seconds, brings the tab back and checks that the bees fly again. It opens About and checks that the first frame has the garden and that the follower starts where it was. It turns the garden off and checks the button, the key, the bed and bees hidden, the padding gone and the footer bee gray. Last, under reduced motion, it checks the still garden.
- **`not-found-nojs.json`** checks that the footer bee button hides without JavaScript and that the bed stays hidden.
- **Proof.** Keep `garden-on`, `garden-follower` and `garden-reduced`, in light, dark and at 390px.

## Gotchas

- Journey steps run in an isolated world, so redefining `document.hidden` in an `eval` does not reach the page's script. The journey's first step `inject`s a page-world `document.hidden` that reads the `data-test-hidden` attribute, which both worlds see.
- `pause()` takes effect on the next frame. Measure the frozen positions after two `requestAnimationFrame`s, or a bee mid-flight moves 1px.
- The layer that holds the bees has its own opacity and visibility transition. Pause only the bees' animations (`[...air.children]`), never `air.getAnimations({subtree: true})`, or the layer freezes visible when the garden turns off.
- Right after turning on, the bed is still `translateY(100%)`. `garden.js` measures flowers from where the bed rests; a check that reads flower rects in that moment sees them below the screen.
- `hover` points must be inside the viewport: x 300 works at both 1280 and 390.
- Headless Chromium has no hover, so the footer bee's hover flap is checked from the stylesheet in `motion.json`.
