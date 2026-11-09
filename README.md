# Backyard Mini-Golf

An isometric pixel-art mini-golf game for the browser.

**[Play online →](https://hivijc.github.io/backyard-minigolf/)**

Every push to `main` rebuilds and redeploys the site through GitHub Actions.

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
