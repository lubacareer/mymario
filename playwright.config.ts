import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:4180/mymario/',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/mymario/',
    reuseExistingServer: !process.env.CI,
  },
})
