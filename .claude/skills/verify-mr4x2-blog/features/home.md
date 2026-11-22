# Home post list

The home page shows "All Posts", newest first, each with its date, title, Post tags, summary and a "Read Article" link. Beside the list, on wide screens, it shows a "Filter by tag" sidebar with post counts. The header menu on every page links to Contact, Tags, About (and Reading after #15) and GitHub.

## Sub-features

- `home-list` lists every Post (and today also About), with a title link and "Read Article".
- `home-sidebar` lists every Post tag with its count (`Travel(2)`), on screens 768 px and wider.
- `home-menu` shows the header links in order, with GitHub opening in a new tab.
- `home-no-reading` shows that the Reading page is linked from the menu only, never in the list (after #15).

## How to get to it (user POV)

- Open the site root `/`.
- Click the site title or the logo in the header on any page.

## Driving it with drive.mjs

Preconditions:

- A run is healthy per `doctor`.
- The working tree has the two travel Posts and the About page.

- **Open home.** `{"goto": "/"}`, `{"shot": "home"}`. The `<h1>` reads `All Posts`.
- **List contents.** `{"expect": "$$('main li h2 a').map(a => a.textContent.trim())", "label": "post titles"}` returns titles that include `A great trip in Thailand` and `Memorable days in France`.
- **Read Article.** `{"expect": "$$({role:'link', name:'Read Article'}).length", "equals": 3}` holds on `main` today: two Posts plus About.
- **Sidebar.** `{"expect": "$$('aside nav a').map(a => nameOf(a)).includes('Travel(2)')"}` holds at width 1280. Names are the title-cased tag plus the count, with no space, such as `Travel(2)` or `Openinfra Submit(1)`. At `--width 390`, `{"expect": "!visible($('aside'))"}` holds.
- **Menu.** `{"expect": "$$('header a').map(a => a.textContent.trim()).filter(Boolean)"}` starts with `mr4x2 blog`, then `Contact, Tags, About`. After #15 it's `Contact, Tags, Reading, About`.
- **Reading not listed (after #15).** `{"expect": "!$$('main li a').some(a => a.href.endsWith('/reading/'))", "label": "reading not in All Posts"}`.
- **Proof.** `{"shot": "home-final"}` at 1280 and at 390.

## Gotchas

- About is built like a Post, so it appears in the list and adds the `readme` and `info` tags to the sidebar. That's today's behavior, not a bug introduced by your change.
- `pagerSize` is 5. The pager only appears with 6 or more listed pages.
- The Contact link is a `mailto:`. Don't click it in journeys.
