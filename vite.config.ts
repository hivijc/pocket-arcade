import { defineConfig } from 'vite';

// Relative base so the build works under any subpath,
// e.g. https://<user>.github.io/backyard-minigolf/ on GitHub Pages.
export default defineConfig({
  base: './',
});
