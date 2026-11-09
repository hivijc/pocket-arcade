# Pocket Arcade

A small arcade of pixel-art browser games, all playable from one link.

**[Play online →](https://hivijc.github.io/pocket-arcade/)**

Every push to `main` rebuilds and redeploys the site through GitHub Actions.

## Games

- **Backyard Mini-Golf**: isometric pixel-art mini-golf. Currently served at the site root.
- **Paper Route**: a daytime bike game. Coming soon.

## Plan: hub + games

The site root will become a hub page with a card for each game, and each game
will move to its own path:

```
https://hivijc.github.io/pocket-arcade/            hub (game cards)
https://hivijc.github.io/pocket-arcade/minigolf/   Backyard Mini-Golf
https://hivijc.github.io/pocket-arcade/paper-route/ Paper Route
```

The build is ready for this. `vite.config.ts` uses a relative `base: './'`, so
a game's build works under any subpath. The deploy workflow publishes whatever
ends up in `dist/`. The restructure (a hub page, each game built into
`dist/<game>/`) happens after the parallel feature branches are merged into
`main`. Until then, mini-golf stays at the root.

When adding a game, load assets through Vite imports (`import` or
`import.meta.glob` with `?url`). A hard-coded absolute path like `/assets/...`
breaks under the subpath.

## Develop

Requires Node 22 (see `.nvmrc`).

```bash
nvm use
npm ci
npm run dev     # start the dev server
npm test        # unit tests (Vitest)
npm run e2e     # end-to-end tests (Playwright)
npm run build   # production build into dist/
```
