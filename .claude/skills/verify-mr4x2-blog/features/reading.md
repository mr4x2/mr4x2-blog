# Reading page

The Reading page (`/reading/`, new in #15) lists every Bookmark from the Reading collection as one flat list, newest first, in the style of pliutau.com/reading-list. Each row shows the Read date (`2026-11-21`), the title (opens in a new tab), `- site`, and the author's Note under it if there is one. A search box and tag buttons above the list narrow it, and an "N of M" status shows how many rows match. Without JavaScript the full list still shows, and the filter controls stay hidden.

## Sub-features

- `reading-menu` links the header `Reading` item, between Tags and About, to `/reading/`.
- `reading-list` shows one flat list, newest first, with no month headings.
- `reading-row` gives the Read date, a title link with `target="_blank" rel="noopener"`, the site, and the Note in italics when it isn't empty, keeping its line breaks. Rows show no tags, and the Excerpt is never shown.
- `reading-tag` filters to one Bookmark tag when its button is clicked. The URL becomes `#tag=<key>` and the button shows as pressed. Buttons are ordered by count, then name, and show the tag as written (`machine learning`). The key replaces spaces with `-` (`#tag=machine-learning`).
- `reading-tag-link` applies the filter when the page is opened at `/reading/#tag=<key>`. A key with no button falls back to All.
- `reading-all` shows every row again and clears the hash.
- `reading-search` matches the title, site, tags, Note and Excerpt, ignoring case and outer spaces, and combines with the active tag.
- `reading-count` shows `N of M`, updated after every filter change.
- `reading-escape` shows HTML in a title or Note as text, never as markup.
- `reading-phone` wraps a long unbroken title (the URL the sync uses when a Bookmark has none) instead of widening the page.
- `reading-nojs` shows the full list with no controls when JS is off.
- `reading-empty` shows `Nothing here yet.` when there's no data file or it is `[]`.

## How to get to it (user POV)

- Click `Reading` in the header menu on any page.
- Open `/reading/` directly, or a shared filtered link `/reading/#tag=<key>`.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`, on a branch that contains #15.
- `data/reading.json` holds known Bookmarks. For a fixture run, copy the committed fixture over it: `cp .claude/skills/verify-mr4x2-blog/fixtures/reading.json data/reading.json`. It has 5 entries: one tagged `ceph` whose Excerpt alone says `bluestore`, one untagged, one titled with a long unbroken URL and tagged `machine learning` with a two-line Note, one with the Note `<b>bold</b> & "quotes"`, and one titled `Tiếng Việt`. For a real-data run, read the expected values from the file.
- Handles: the search box is `{role: "searchbox", name: "Search bookmarks"}`. Tag buttons are `{role: "button", name: "<tag>"}` inside `{role: "group", name: "Filter by tag"}`, plus a button named `All`. The count is `{role: "status"}`. Rows are `li[data-tags]`, each starting with a `<time>`.

The journeys are committed step files. Run each against the fixture, then restore the data file:

```bash
K=.claude/skills/verify-mr4x2-blog
node $K/scripts/drive.mjs --run RUN_ID --name reading $K/journeys/reading.json
node $K/scripts/drive.mjs --run RUN_ID --name reading-phone --width 390 --height 844 $K/journeys/reading-phone.json
node $K/scripts/drive.mjs --run RUN_ID --name reading-nojs --no-js $K/journeys/reading-nojs.json
git checkout -- data/reading.json
```

- **`reading.json`** opens the page from the menu, then checks the menu order, the row dates newest first, no month headings, title links with `noopener`, escaping, the two-line Note, the hidden Excerpt, button order and labels, and `5 of 5`. It clicks `ceph` (`1 of 5`, pressed), then `machine learning` (`#tag=machine-learning`), then All. It searches for `BlueStore` (Excerpt only), `  tiếng ` (trimmed) and `zzz-nothing` (`0 of 5`), and checks search plus tag. It leaves for `/` (Reading not in All Posts), opens `/reading/#tag=storage` (`2 of 5`), checks `/tags/` has no Bookmark tags, and opens `/reading/#tag=nope` (falls back to All).
- **`reading-phone.json`** at 390 px: no sideways scroll, then a tag click.
- **`reading-nojs.json`**: all 5 rows visible, controls hidden.
- **Empty.** Replace `data/reading.json` with `[]` (the committed state) or move it aside, then `{"goto": "/reading/"}` and `{"expect": "document.body.innerText.includes('Nothing here yet.')"}`.
- **Proof.** Keep `before-tag`, `after-tag`, `no-match`, the phone shots and the `--no-js` shot.

## Gotchas

- Check sideways scroll against `screen.width`, never `innerWidth`. In phone emulation, Chrome widens the layout viewport to fit content that overflows, so `scrollWidth <= innerWidth` holds even on a broken page.
- Browsers wrap long text at hyphens, so a hyphenated URL never proves the long-title fix. The fixture's long title has no hyphens on purpose.
- In `local` mode, live reload re-renders the page after you edit `data/reading.json` or the template, but an open journey keeps the old DOM. Run a new `goto` afterwards, and give the server a few seconds. `prod` mode is a static snapshot, so stop and relaunch it after every edit.
- A `goto` that changes only the hash (`/reading/` to `/reading/#tag=x`) doesn't reload the page, so the search box keeps its query, and search and tag combine (for example `0 of 5`). To prove a shared link, start a fresh journey or `goto` another page first.
- `#tag=` keys are lowercase, because the sync lowercases Bookmark tags. `#tag=Ceph` matches no button and falls back to All.
- The page must not appear in "All Posts" (`home.md`, `home-no-reading`) or add Bookmark tags to Tags (`tags.md`). Check both after any change here.
- A fixture `data/reading.json` must never be committed. Restore it with `git checkout -- data/reading.json`.
