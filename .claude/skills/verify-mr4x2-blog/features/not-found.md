# 404 page

A missing page shows `bash: cd: <path>: No such file or directory` and a `cd ~` link to the home page, inside the normal header and footer. A small script fills `<path>` from the address bar. Without JavaScript the line shows `/missing-page`.

## Sub-features

- `not-found-path` shows the requested path in the error line.
- `not-found-home` links `cd ~` to `/`.
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

- **`not-found.json`** opens `/no-such-page/`, checks that the server answers 404, that the line reads `bash: cd: /no-such-page/: No such file or directory`, the heading and the header, saves a screenshot and the rendered text, and follows `cd ~` to `/`.
- **`not-found-nojs.json`** checks the `/missing-page` fallback and that the link is still there.
- **Proof.** Keep `not-found` and `not-found-nojs`.

## Gotchas

- `hugo server` answers a missing path with this page and status 404, so a plain `goto` works. The static server in production is configured separately (`features/deploy.md`).
- The path is set with `textContent`, so a URL with markup in it shows as text.
