# Tags

The Tags page lists every Post tag with its post count. Each tag opens a page listing the Posts that carry it. Bookmark tags from the Reading page never appear here.

## Sub-features

- `tags-index` lists all Post tags with counts at `/tags/`.
- `tags-page` lists the Posts with a given tag at `/tags/<tag>/`.
- `tags-no-bookmark-tags` keeps Bookmark tags off this page (after #15).

## How to get to it (user POV)

- Click `Tags` in the header menu.
- Click a tag under a Post, or in the home sidebar.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.

- **Open from the menu.** `{"goto": "/"}`, `{"click": {"role": "link", "name": "Tags"}}`, `{"wait": "location.pathname === '/tags/'"}`, `{"shot": "tags"}`.
- **Index contents.** `{"expect": "$$('main a').map(a => nameOf(a)).includes('Travel(2)')"}` holds.
- **Tag page.** `{"click": {"role": "link", "name": "Travel(2)"}}`, `{"wait": "location.pathname === '/tags/travel/'"}`, then `{"expect": "$$('main li h2 a').length", "equals": 2}`.
- **No Bookmark tags (after #15).** Take a tag that exists only on Bookmarks in `data/reading.json` (for example `ceph`). `{"expect": "!$$('main a').some(a => /^ceph\\b/i.test(a.textContent.trim()))"}` holds on `/tags/`, and `GET /tags/ceph/` returns 404.
- **Proof.** `{"shot": "tag-travel"}`.

## Gotchas

- A tag's link name is its title-cased page title plus the count, with no space (`Openinfra Submit(1)`). The URL is the urlized tag (`/tags/openinfra-submit/`). Match names with `nameOf`, and match URLs on the path.
- Hugo also builds an empty `/categories/`. Nothing links to it, so ignore it.
