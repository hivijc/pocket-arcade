# Pocket Arcade

A small arcade of pixel-art browser games, all playable from one link.

**[Play online →](https://hivijc.github.io/pocket-arcade/)**

Every push to `main` rebuilds and redeploys the site through GitHub Actions.

## Games

The site root is the hub, a page of game cards. Each game lives at its own path:

```
https://hivijc.github.io/pocket-arcade/                    hub (game cards)
https://hivijc.github.io/pocket-arcade/games/minigolf/     Backyard Mini-Golf
https://hivijc.github.io/pocket-arcade/games/paper-route/  Paper Route
```

- **Backyard Mini-Golf**: isometric pixel-art mini-golf, 2 courses and 12 holes.
  Entry: `games/minigolf/index.html`; code in `src/`, art in `assets/`.
  Add `?phase=night` (or `morning`, `day`, `dusk`) to force a time of day and
  `?course=boardwalk` to open a course, e.g. `/games/minigolf/?phase=night`.
- **Paper Route**: a daytime bike paper-delivery game, self-contained in
  `games/paper-route/`.
- **Bluebird Run**: a sunny-day downhill snowboard score run (gates, kickers,
  spins and grabs), keyboard or iPhone touch, self-contained in `games/bluebird-run/`.
  `npm run dev:bluebird-run` opens it.

The hub is a plain HTML page (`index.html` + `src/hub/hub.css`). Its card
thumbnails are real 320x200 captures of each game's first frame, kept in
`public/hub/` and copied into the build as-is. Every game page carries a small
"← Pocket Arcade" link back to the hub.

`debug.html` and `editor.html` are mini-golf dev tools; they run under
`npm run dev` and are left out of the build.

## Adding a game

1. Put it in `games/<id>/` with its own `index.html`.
2. Add that page to `build.rollupOptions.input` in `vite.config.ts`.
3. Add a card to the hub `index.html`, with a 320x200 thumbnail in `public/hub/`.
4. Add the `← Pocket Arcade` link (`href="../../"`) to the game page.

`vite.config.ts` uses a relative `base: './'`, so the build works under any
subpath. Load assets through Vite imports (`import` or `import.meta.glob` with
`?url`); a hard-coded absolute path like `/assets/...` breaks under the subpath.
To check the subpath locally:

```bash
npm run build
npx vite preview --base /pocket-arcade/
```

## Develop

Requires Node 22 (see `.nvmrc`).

```bash
nvm use
npm ci
npm run dev     # start the dev server
npm test        # unit tests (Vitest)
npm run e2e     # end-to-end tests (Playwright; starts its own server on port 5199, which must be free)
npm run build   # production build into dist/
```
