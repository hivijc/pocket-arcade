import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: at('./index.html'),
        paperRoute: at('./games/paper-route/index.html'),
      },
    },
  },
});
