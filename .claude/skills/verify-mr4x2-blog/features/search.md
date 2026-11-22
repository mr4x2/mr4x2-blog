# Search popup

Ctrl K (⌘K on a Mac) toggles a search popup on every page, and `/` opens it when focus is not in a text field. The input row starts with `$ grep -i`. Results come from Pagefind and show up to 8 Posts, each with its date, tags, title and an excerpt with the match highlighted. Arrow keys move the selection, Enter opens it, Esc closes the popup and returns focus to where it was. The popup opens and closes with no animation. About is searchable too. Reading bookmarks are not.

## Sub-features

- `search-open` opens with Ctrl K, ⌘K, `/` outside a text field, and the header Search button, and closes with Esc, Ctrl K again, or a click on the backdrop.
- `search-results` shows Posts matching the query, with the date, tags, title and `<mark>` excerpt. `Bangkok` finds only the Thailand Post.
- `search-keys` moves the selection with the arrow keys or the mouse, and Enter opens the selected Post.
- `search-focus` returns focus to the element that had it before the popup opened.
- `search-empty` shows `grep: no posts match "<query>"` for a query with no match.
- `search-noindex` shows `grep: search index not found` when `/pagefind/pagefind.js` fails to load, and retries on the next open.
- `search-a11y` makes the popup a `role="dialog"` with `aria-modal`, the input a `combobox` that controls a `listbox`, and keeps `aria-activedescendant` on the selected option.

## How to get to it (user POV)

- Press Ctrl K or ⌘K on any page, or press `/` when no field has focus.
- Click `Search` in the header.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.
- For the results journey, the index exists. Stop any run, then `npm run search` builds the site into `public/` and writes `static/pagefind/` (gitignored). Delete `public/`, and launch.
- For the missing-index journey, `static/pagefind/` does not exist. Move it aside first.

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name search $K/journeys/search.json
node $K/scripts/drive.mjs --run RUN_ID --name search-dark --dark $K/journeys/search.json
node $K/scripts/drive.mjs --run RUN_ID --name search-phone --width 390 --height 844 $K/journeys/search.json
node $K/scripts/drive.mjs --run RUN_ID --name search-noindex $K/journeys/search-noindex.json
```

- **`search.json`** presses the keys through the browser's input path. It checks the closed dialog and its ARIA wiring, opens with Ctrl K from a focused menu link, types `Bangkok`, and checks that only the Thailand Post is found, with its date and tags, a highlighted match and a selected first row. It closes with Esc and checks that focus is back on the menu link, opens with `/`, types `trip`, and moves the selection with the arrows and with the mouse. It presses Enter and checks that the opened page is the selected Post. It checks the no-match message, Ctrl K closing the popup, the header button, `passionate` finding About, a click on the backdrop, and `Paris` finding only the France Post.
- **`search-noindex.json`** opens the popup without an index and checks the message, that typing changes nothing, and Esc.
- **Proof.** Keep `search-bangkok`, `search-trip`, `search-empty` and `search-noindex`, in both themes and at both widths.

## Gotchas

- Pagefind is pinned to 1.5.0. Version 1.6.0 dies with `Illegal instruction` on the server's CPU, which has no AVX2.
- Pagefind indexes only pages with `data-pagefind-body`: Posts and About. The header line, the tags and the table of contents carry `data-pagefind-ignore`, so they stay out of excerpts. The date and tags travel in two hidden elements with `data-pagefind-meta`, one key per attribute. A single attribute with a comma-separated list is read as one value.
- Typing goes through `Input.insertText`, so it triggers a real `input` event. Pagefind's `debouncedSearch` waits 300 ms, so wait for results instead of reading at once.
- The popup is built from one state object and one render function. A journey must not set `state` or call a page function. Drive keys, text and the mouse.
- The index is built from `hugo --gc` output, so it is only as new as the last `npm run search`. Rebuild it after changing a Post or the article templates.
