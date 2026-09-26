import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.DEMO_PORT ?? 4173);

export default defineConfig({
  testDir: `${root}/tests/e2e`,
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['json', { outputFile: `${root}/test-results/e2e.json` }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx tsx ${root}/src/main.ts`,
    url: `http://localhost:${port}/health`,
    env: { PORT: String(port) },
    reuseExistingServer: false,
  },
});
