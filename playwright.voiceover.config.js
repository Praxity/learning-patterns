import { defineConfig } from '@playwright/test';

const port = Number(process.env.LP_PORT ?? 4187);
export default defineConfig({
  testDir: './tests/voiceover',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 20 * 60 * 1000,
  outputDir: `test-results/voiceover-${process.env.VO_PHASE ?? 'journeys'}`,
  reporter: [['list']],
  use: { browserName: 'webkit', headless: false, baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 900 } },
  webServer: { command: 'node scripts/serve-demo.mjs', url: `http://127.0.0.1:${port}/index.html`, reuseExistingServer: false, env: { LP_PORT: String(port) } }
});
