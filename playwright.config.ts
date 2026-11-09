import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5199' },
  projects: [
    { name: 'hub', testDir: 'tests/e2e', testMatch: 'hub.spec.ts' },
    { name: 'minigolf', testDir: 'tests/e2e', testIgnore: 'hub.spec.ts' },
    { name: 'paper-route', testDir: 'games/paper-route/tests/e2e' },
    { name: 'bluebird-run', testDir: 'games/bluebird-run/tests/e2e', testIgnore: 'hook.ts' },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
  },
});
