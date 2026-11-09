import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Relative base so the build works under any subpath (GitHub Pages serves it at /pocket-arcade/).
// debug.html and editor.html are dev-only and deliberately left out of the inputs.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        minigolf: at('./games/minigolf/index.html'),
        paperRoute: at('./games/paper-route/index.html'),
      },
    },
  },
});
