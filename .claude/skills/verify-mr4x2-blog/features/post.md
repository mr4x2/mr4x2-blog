# Post page

A Post page shows the publish date, title, author, a collapsible "Table of Contents", the body with centered photos and their captions, the Post tags, a comments section (giscus) and "← Back to the list".

## Sub-features

- `post-header` shows the date and title, and the author `mr4x2` with their GitHub avatar.
- `post-toc` shows "Table of Contents", open by default, with links to the H2/H3 headings that jump to them.
- `post-figures` renders `![alt](path#center "Caption")` as a centered figure whose caption is the title text.
- `post-tags` shows each tag linking to `/tags/<tag>`.
- `post-comments` loads the giscus script for comments.
- `post-back` makes "← Back to the list" return to `/`.

## How to get to it (user POV)

- Click a Post title or "Read Article" on the home page.
- Click a Post title on a tag page.
- Follow a link to `/<slug>/` from outside.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.
- The Post `A great trip in Thailand` exists at `/a-great-trip-in-thailand/`.

- **Open from home.** `{"goto": "/"}`, `{"click": {"role": "link", "name": "A great trip in Thailand"}}`, `{"wait": "location.pathname === '/a-great-trip-in-thailand/'"}`, `{"shot": "post"}`.
- **Header.** `{"expect": "$('h1').textContent.trim()", "equals": "A great trip in Thailand"}`.
- **TOC.** `{"expect": "$('details').open && $$('details nav a').length > 0"}`. Clicking the first TOC link changes `location.hash` to that heading's id.
- **Figures.** `{"expect": "$$('figure figcaption').map(f => f.textContent.trim()).slice(0, 2)", "equals": ["Canals in Bangkok", "Pad Thai"]}`. Then check that a photo actually loads where a reader scrolls: `{"scroll": "img[title='Pad Thai']"}`, `{"wait": "(i => i.complete && i.naturalWidth > 0)($(\"img[title='Pad Thai']\"))", "timeout": 15000, "label": "photo loads"}`, `{"shot": "figure", "viewport": true}`.
- **Tags.** `{"expect": "$$('footer a[href^=\"/tags/\"]').map(a => a.textContent.trim().toLowerCase())"}` includes `travel` and `thailand`.
- **Comments.** `{"expect": "!!$('script[src=\"https://giscus.app/client.js\"]')"}`. Don't assert that the comment thread itself rendered (see Gotchas).
- **Back.** `{"click": {"role": "link", "name": "← Back to the list"}}`, `{"wait": "location.pathname === '/'"}`.
- **Proof.** `{"shot": "post-final"}` and `{"dom": "post"}`.

## Gotchas

- giscus loads from github.com/giscus.app and maps threads by pathname. On a `127.0.0.1` run, the thread doesn't match production, so only the script tag is proof.
- Photos come from `static/trip-in-<place>/`, are big (up to 1.6 MB) and use `loading="lazy"`. Photos below the fold never load until scrolled to, so `every(img.complete)` over the whole page is false by design. Scroll to the one you check.
- The Thailand post is about 10,900 px tall. A full-page `shot` stops at 4000 px. Use `scroll` plus a viewport shot for anything lower down.
- Image URLs carry a `?v=<hash>#center` suffix added by the `hugomods/images` module. Match on the path, not the full URL.
