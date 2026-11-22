# Reading page

The Reading page (`/reading/`, new in #15) lists every Bookmark from the Reading collection, grouped under month headings, newest first. Each row shows the day, the title (opens in a new tab), the site, the Bookmark tags and the author's Note if there is one. A search box and tag buttons narrow the list, and an "N of M" status shows how many rows match. Without JavaScript the full list still shows, and the filter controls stay hidden.

## Sub-features

- `reading-menu` links the header `Reading` item, between Tags and About, to `/reading/`.
- `reading-list` shows month headings (`November 2026`) newest first, and rows newest first within each month.
- `reading-row` gives a title link with `target="_blank"`, the site, tags, and the Note in italics when it isn't empty. The Excerpt is never shown.
- `reading-tag` filters to one Bookmark tag when its button is clicked. The URL becomes `#tag=<tag>`, the button shows as pressed, and empty month headings hide.
- `reading-tag-link` applies the filter when the page is opened at `/reading/#tag=<tag>`.
- `reading-all` shows every row again and clears the hash.
- `reading-search` matches the title, site, tags, Note and Excerpt, ignoring case, and combines with the active tag.
- `reading-count` shows `N of M`, updated after every filter change.
- `reading-escape` shows HTML in a title or Note as text, never as markup.
- `reading-nojs` shows the full list with no controls when JS is off.
- `reading-empty` shows `Nothing here yet.` when there's no data file or it is `[]`.

## How to get to it (user POV)

- Click `Reading` in the header menu on any page.
- Open `/reading/` directly, or a shared filtered link `/reading/#tag=<tag>`.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`, on a branch that contains #15.
- `data/reading.json` holds known Bookmarks. For a fixture run, use 4 entries:
  - two in November 2026, one of them untagged, and one tagged `ceph` with the Excerpt `about bluestore` and no `bluestore` in its title or Note;
  - one in October 2026 with the Note `<b>bold</b> & "quotes"`;
  - one titled `Tiếng Việt`.

  For a real-data run, read the expected values from the file.
- Handles: the search box is `{role: "searchbox", name: "Search bookmarks"}`. Tag buttons are `{role: "button", name: "<tag>"}` inside `{role: "group", name: "Filter by tag"}`, plus a button named `All`. The count is `{role: "status"}`. Rows are list items carrying `data-tags`, and month groups are `section[data-month]`.

- **Open from the menu.** `{"goto": "/"}`, `{"click": {"role": "link", "name": "Reading"}}`, `{"wait": "location.pathname === '/reading/'"}`, `{"shot": "reading"}`.
- **Months and order.** `{"expect": "$$('section[data-month] h2').map(h => h.textContent.trim())", "equals": ["November 2026", "October 2026"]}` with the fixture.
- **Row.** `{"expect": "$$('section[data-month] li a[target=_blank]').length", "equals": 4}`. Every title link has `rel` containing `noopener`.
- **Escaping.** `{"expect": "!$('section[data-month] b') && document.body.textContent.includes('<b>bold</b> & \"quotes\"')", "label": "note shown as text"}`.
- **Excerpt hidden.** `{"expect": "!document.body.innerText.includes('about bluestore')"}`.
- **Count.** `{"expect": "$({role:'status'}).textContent.trim()", "equals": "4 of 4"}`.
- **Tag click.** `{"shot": "before-tag"}`, `{"click": {"role": "button", "name": "ceph"}}`, `{"wait": "location.hash === '#tag=ceph'"}`. Then check:
  - `{"expect": "$$('section[data-month] li').filter(visible).every(li => li.dataset.tags.split(' ').includes('ceph'))"}` holds;
  - `{"expect": "$({role:'button', name:'ceph'}).getAttribute('aria-pressed')", "equals": "true"}`;
  - October's heading is not visible, and the status reads `1 of 4`;
  - `{"shot": "after-tag"}`.
- **Shared link.** `{"goto": "/reading/#tag=ceph"}` in a fresh journey gives the same visible rows and status as the click.
- **All.** `{"click": {"role": "button", "name": "All"}}`. The hash is empty, all 4 rows are visible, and the status reads `4 of 4`.
- **Search.** `{"fill": {"role": "searchbox", "name": "Search bookmarks"}, "value": "BlueStore"}`. Only the row whose Excerpt is `about bluestore` stays visible. Then search for `tiếng`, and the `Tiếng Việt` row is visible. Searching for `zzz-nothing` leaves 0 rows visible, every month heading hidden, and the status at `0 of 4`.
- **Search plus tag.** With `ceph` active, searching for `tiếng` gives `0 of 4`.
- **No JS.** Run with `--no-js`: `{"goto": "/reading/"}`. All 4 rows are visible, and `{"expect": "!visible($({role:'searchbox', hidden:true}))"}` holds.
- **Empty.** Move `data/reading.json` aside (or replace it with `[]`) and wait for the live reload. `{"expect": "document.body.innerText.includes('Nothing here yet.')"}`. Then restore the file.
- **Phone.** Repeat "Open" and "Tag click" with `--width 390`. Nothing should overflow: `{"expect": "document.documentElement.scrollWidth <= innerWidth"}`.
- **Proof.** Keep `before-tag` and `after-tag`, the search screenshots and the `--no-js` screenshot.

## Gotchas

- With live reload, editing `data/reading.json` re-renders the page, but an open journey keeps the old DOM. Run a new `goto` afterwards.
- A `goto` that changes only the hash (`/reading/` to `/reading/#tag=x`) doesn't reload the page, so the search box keeps its query, and search and tag combine (for example `0 of 4`). To prove a shared link, start a fresh journey or `goto` another page first.
- `#tag=` values are lowercase, because the sync lowercases Bookmark tags. `#tag=Ceph` matching nothing is expected behavior.
- The page must not appear in "All Posts" (`home.md`, `home-no-reading`) or add Bookmark tags to Tags (`tags.md`). Check both after any change here.
- A fixture `data/reading.json` must never be committed. Restore it with `git checkout -- data/reading.json`, or delete it if the file isn't tracked yet.
