# Top tracks design

Status: decisions settled (2026-11-23). Terms are defined in `CONTEXT.md`: a **Top track** is one of the five songs I played most on Spotify over about the last four weeks.

## Why

I want my music on the home page, so a visitor gets a little more of who I am than the `whoami` line. I don't want visitors to know what I'm playing right now or when I last listened. So the home page shows what I have on repeat lately, with no live data and no times.

## Goals

- The home page shows my 5 Top tracks under `whoami`, in Spotify's ranking, each linking to the song on Spotify.
- The list updates once a day without any manual step.
- Nothing on the site, in the data, or in the repo history tells when I listen.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Live "now playing", or not? | Not live. A live line, a progress bar or a "2h ago" shows when I'm awake and listening, and I don't want that. |
| 2 | What the list shows | My Top tracks: Spotify's top tracks for `time_range=short_term` (about 4 weeks), 5 of them. Not recently played (a list that changes as I listen gives me away), not top artists. |
| 3 | How fresh | Once a day, at a fixed time, 03:00 Vietnam time. |
| 4 | Where it runs | A daily GitHub Action, like the Reading sync. No new container. The data changes daily, so a server process isn't needed. |
| 5 | Look | Text only: rank, song, artists. No album cover (it would bring color into a one-accent theme), no progress bar, no icons. |
| 6 | Songs only? | Yes. The top-tracks endpoint returns only songs. |
| 7 | When the Spotify login expires | Keep showing the last list. The failed run turns red, GitHub emails me, and I log in again. |
| 8 | Motion | The block joins the existing home entrance as one step. Song links get the post-title hover color. Nothing else. |

Spotify's refresh tokens last 6 months from the login, and refreshing doesn't extend them ([Spotify](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)). So decision 7 happens about twice a year.

Personal Spotify apps (Development Mode) need the owner to have Premium, and stop working if it lapses ([Spotify](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)). I have Premium. `GET /me/top/tracks` is still open to these apps ([changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)).

## Non-goals

- Now playing, recently played, listening history, play counts, top artists, podcasts.
- Album covers, a separate music page, the list on any page but home.
- Warning me before the 6-month login runs out.

## Anti-goals (a failure even if it works)

- Anything that tells when I listened: a timestamp or "updated at" in the data or the page, a list that changes while I listen, a commit made at a time that depends on my listening, motion that implies playback (like moving equalizer bars).
- A Spotify secret (client secret, refresh token, access token) in a workflow log, in the data file, or in the Docker image.
- A failed or empty Spotify response wiping the list.
- The block noticeably delaying the Posts, which are the home page's main content.

## Approaches

- **A daily GitHub Action with the list built into the page (chosen).** It reuses the Reading pipeline, which is already tested and running. The list is in the HTML, so it shows instantly and works without JavaScript. The costs: Spotify secrets live in GitHub secrets, and the list is up to a day old.
- **A live "now playing" container on the server.** The first plan. Rejected by decision 1: live data shows when I listen. It would also add an image, a Traefik route and a Spotify token on the server.
- **A container serving the daily list.** Rejected: two moving parts (container plus refresh logic) for data that changes once a day.
- **Last.fm scrobbling.** No Spotify login, no Premium, no server code. Rejected: it's another account, its data is live by nature, and I have Premium, so Spotify's own API works.

## Design

### Data: `data/top_tracks.json`

A JSON array in Spotify's ranking order, at most 5 entries:

```json
[{ "title": "Holocene", "artists": ["Bon Iver"], "url": "https://open.spotify.com/track/…" }]
```

- `title` is the track name as Spotify gives it. `artists` lists every artist name in Spotify's order.
- `url` is the track's `external_urls.spotify`. A track without one (a local file, for example) is skipped, so the list can be shorter than 5. *(Claude's call, not discussed.)*
- No other fields. In particular, no time of any kind, no play counts, no fetch date.
- The output is deterministic (fixed order and formatting), so a commit happens only when the list really changed.
- It is generated: never edited by hand, like `data/reading.json`.

### Sync: `scripts/sync_top_tracks.py`

Python standard library only, like `scripts/sync_raindrop.py`, with `unittest` tests beside it in `scripts/`.

- Reads `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REFRESH_TOKEN`. Exits 2 with the missing names if any is unset.
- Gets an access token: `POST https://accounts.spotify.com/api/token` with `grant_type=refresh_token`, authenticated with HTTP Basic `client_id:client_secret`.
- Fetches `GET https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5`.
- On success, writes the file atomically (temp file plus `os.replace`, as the Reading sync does). `--output <file>` writes somewhere else.
- On any failure, it exits non-zero and leaves the file untouched (decision 7). The messages say what happened and what to do:
  - `invalid_grant` from the token endpoint: the login expired or was revoked. Run `scripts/spotify_auth.py` and update the `SPOTIFY_REFRESH_TOKEN` secret.
  - HTTP 403 from the API: check that the app owner still has Premium and that the account is allowed in the app's User Management.
  - Other HTTP errors, network errors or malformed JSON: report the status or reason.
- An empty result never replaces a non-empty file (the Reading sync's `check_not_wiping` rule). An empty result over a missing or empty file writes `[]`.
- It never prints a token. If the token response carries a new `refresh_token`, it prints a notice that one was issued, without the value. The current token keeps working, as Spotify's docs say to keep using it when none is returned.

### One-time login: `scripts/spotify_auth.py`

Gets the refresh token, now and every 6 months. It must work on the server, which has no browser.

- Reads `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the environment.
- Prints the authorize URL: scope `user-top-read`, redirect `http://127.0.0.1:8888/callback`, and a random `state`. Spotify doesn't allow `localhost` as a redirect ([Spotify](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)).
- I open the URL in any browser and log in. The browser lands on a `127.0.0.1` page that may fail to load. I paste that page's full address back into the script. *(Claude's call, not discussed: pasting works from any machine. A local listener doesn't, when the browser is on my laptop.)*
- The script checks `state`, exchanges the code for tokens, and prints the refresh token once with the command to store it: `gh secret set SPOTIFY_REFRESH_TOKEN`.

### Workflow: `.github/workflows/sync-top-tracks.yml`

- `schedule: cron '0 20 * * *'` (03:00 Vietnam time) and `workflow_dispatch`.
- Same shape as `sync-reading.yml`: run the tests, run the sync with the three secrets, then commit `data/top_tracks.json` only if it changed, as `chore(music): sync top tracks`, with the same fetch, reset and retry loop. Then dispatch `hugo.yml`, because a push made with `GITHUB_TOKEN` doesn't trigger it.
- The commit-and-dispatch step now has two callers, so it moves into one script, `scripts/commit_data.sh <path> <message>`, used by both workflows. *(Claude's call, not discussed, from the CLAUDE.md rule "extract it when a second real use lands".)*

### Home page

- A new partial, `layouts/partials/home/top-tracks.html`, rendered in `layouts/index.html` between `whoami` and `posts`. It renders nothing when `site.Data.top_tracks` is missing or empty, and the build still passes.

```
$ top --tracks --last 4w
  01  Holocene — Bon Iver
  02  Motion Sickness — Phoebe Bridgers
  03  Re: Stacks — Bon Iver
  04  …
  05  …
```

- Markup: a `.sec` section with `.cmd` for the prompt (`top --tracks --last 4w` in the `<b>`), then an `<ol>` of rows. The rank is two digits (`01`), in mono and `--faint`. The song is the link, in `--ink`, opening `open.spotify.com` in a new tab (`target="_blank" rel="noopener"`). The artists come after ` — `, joined with `, `, in `--muted`.
- Long titles wrap. Nothing is truncated.
- Styling follows the CLAUDE.md visual rules: tokens only, no new accent, no icons, no card around the list.

### Motion

From the `/find-animation-opportunities` pass:

1. **Entrance.** The section carries `.reveal` with `--i: 1`, so on the first visit of a session it fades and rises in with the rest of the home page: opacity plus `translateY(0.375rem)`, `var(--dur-reveal)`, `var(--ease-strong)`, 60 ms after `whoami`. The `ls -t ~/posts` section moves from `--i: 1` to `--i: 2`, and the post rows from `add $i 2` to `add $i 3`. This shift applies even when the block isn't rendered. The 60 ms cost is too small to be worth a condition. Reduced motion and the 2-second failsafe already apply through `.reveal`.
2. **Hover.** Song links change color to `--accent` over `var(--dur-hover)`, inside `@media (hover: hover) and (pointer: fine)`, like `.post:hover .post-title a`.

Rejected: equalizer bars (they imply live playback, decision 1), typing the `top` command (doubles the intro), a stagger for each row (adds 300 ms before the Posts), animating ranking changes (the list changes at build time, so no visitor sees the change happen).

### Setup only I can do

1. In the Spotify Developer Dashboard, create an app with the Web API, and add the redirect URI `http://127.0.0.1:8888/callback` exactly.
2. Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env` (for local runs) and in the repo's GitHub secrets.
3. Run `scripts/spotify_auth.py`, then store the refresh token in `.env` and in GitHub secrets as `SPOTIFY_REFRESH_TOKEN`.
4. If the API answers 403 for my own account, add it under the app's User Management.

Do steps 1 to 3 before merging. Otherwise the first scheduled run fails red, and the block stays hidden until it succeeds. *(Claude's call, from the builder check.)*

### Also in this change

- `CONTEXT.md`: the Top track term (already added on this branch).
- CLAUDE.md: a "Top tracks" section next to "Reading page", covering the data flow, the generated file, how to run the sync and its tests locally, and the 6-month re-login.
- The verify skill: a `home-tracks` sub-feature in `features/home.md`, a fixture `fixtures/top_tracks.json`, and checks in the home journeys. The checks cover: the block sits between `whoami` and `ls`, the rows are in order, the links go to `open.spotify.com` in a new tab, the block contains no times, it is absent when the data is `[]`, and it shows with JavaScript off and under reduced motion.

## Verification

- Unit tests cover the sync: mapping, skipping a track with no URL, the empty-result guard, error messages for `invalid_grant` and 403, the file untouched on failure, and no token in output. They also cover the login script's URL parsing and `state` check.
- Run the sync locally against my real account and check the JSON.
- `hugo --gc` passes with the local Hugo (0.145) and the server's (0.154.5), with the file present, `[]`, and missing.
- The verify skill's home journeys pass in light, dark, phone width, intro, reduced motion and no-JS, and `slop-check.sh` prints nothing.
- After merging, dispatch `sync-top-tracks.yml` once by hand. Watch it commit, start `hugo.yml`, and get picked up by Watchtower, then check mr4x2.com. Dispatch `sync-reading.yml` once too, since its commit step moved into `commit_data.sh`.

## Left to the builder

- Exact spacing and the row layout (grid or inline), within the tokens.
- Test structure and exact error wording, within the CLAUDE.md rules on UI copy.
- Whether the new tab gets a screen-reader hint.
