import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5199' },
  projects: [
    { name: 'minigolf', testDir: 'tests/e2e' },
    { name: 'paper-route', testDir: 'games/paper-route/tests/e2e' },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
