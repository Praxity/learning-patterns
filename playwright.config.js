import { defineConfig } from '@playwright/test';

const port = Number(process.env.LP_PORT ?? 4173);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }], ...(process.env.CI ? [['github']] : [])],
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: 'retain-on-failure' },
  projects: ['chromium', 'webkit', 'firefox'].map(browserName => ({ name: browserName, use: { browserName } })),
  webServer: { command: 'node scripts/serve-demo.mjs', url: `http://127.0.0.1:${port}/index.html`, reuseExistingServer: false }
});
