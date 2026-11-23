# 404 page

A missing page types `$ cd <path>`, then answers with `bash: cd: <path>: No such file or directory` and a `cd ~` link to the home page, inside the normal header and footer. A small line-drawn bee flies in beside `cd ~` as that line appears, flapping its wings, and lands facing the link. A small script fills `<path>` from the address bar. The typing plays on every visit, takes at most 0.7 seconds however long the path is, and does not count as the home intro. Without JavaScript both lines show `/missing-page`.

## Sub-features

- `not-found-typing` types the `cd` command, keeps the error hidden until it ends, and leaves `mk-intro-seen` unset.
- `not-found-path` shows the requested path in the command and the error line.
- `not-found-home` links `cd ~` to `/`.
- `not-found-bee` waits while the command types, then flies in with the `cd ~` line (480ms, after the line's 60ms delay), flaps four times and lands to the right of the link. Under reduced motion it only fades in with the line.
- `not-found-nojs` shows `/missing-page` with JavaScript off.

## How to get to it (user POV)

- Open any URL that has no page, such as `/no-such-page/`.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name not-found $K/journeys/not-found.json
node $K/scripts/drive.mjs --run RUN_ID --name not-found-nojs --no-js $K/journeys/not-found-nojs.json
```

- **`not-found.json`** opens `/no-such-page/`, checks that the server answers 404, samples the typing every 50 ms, checks that the bee has no animation while typing and flies after, waits for it to land and checks where and how it landed, checks the lines `$ cd /no-such-page/` and `bash: cd: /no-such-page/: No such file or directory` and that `mk-intro-seen` stays unset, then the heading and the header, saves a screenshot and the rendered text, and follows `cd ~` to `/`. Then it reloads the page under reduced motion and checks that the bee doesn't fly.
- **`not-found-nojs.json`** checks the `/missing-page` fallback, that the link is still there, and that both bees are drawn.
- **Proof.** Keep `not-found` and `not-found-nojs`.

## Gotchas

- `hugo server` answers a missing path with this page and status 404, so a plain `goto` works. The static server in production is configured separately (`features/deploy.md`).
- The path is set with `textContent`, so a URL with markup in it shows as text.
- The 404 bee's flight ends about 0.55 s after the typing does, so the sampling step can end mid-flight. Wait for no running `bee-*` animation before checking where it landed. A finished flight reports `transform` as the identity matrix, not `none`.
