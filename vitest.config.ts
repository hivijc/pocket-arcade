import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'games/*/tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/physics/**', 'src/world/**', 'src/game/**', 'games/paper-route/src/sim/**', 'games/paper-route/src/game/**', 'games/paper-route/src/world/**',
        'games/bluebird-run/src/sim/**', 'games/bluebird-run/src/game/**', 'games/bluebird-run/src/world/**',
        'games/bluebird-run/src/core/touch.ts', 'games/bluebird-run/src/render/tracks.ts', 'games/bluebird-run/src/render/particles.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
