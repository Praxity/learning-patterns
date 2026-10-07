import { defineConfig } from '@playwright/test';

// Parallel worktrees on one machine each need their own port: LP_PORT=4174 npm run test:browser.
const port = Number(process.env.LP_PORT ?? 4173);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: 'retain-on-failure' },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: { command: 'node scripts/serve-demo.mjs', url: `http://127.0.0.1:${port}/index.html`, reuseExistingServer: false }
});
