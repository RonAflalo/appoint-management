const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Start the server automatically during E2E tests
  webServer: {
    command: 'node server/index.js',
    port: 3001,
    timeout: 15_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'e2e-test-secret',
      PORT: '3001',
    },
  },
});
