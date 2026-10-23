import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.LIFEHQ_BASE_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_EXTERNAL
    ? undefined
    : [
        {
          command: "npm run dev",
          url: "http://localhost:3000/demo",
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: "npm run dev:vault",
          url: "http://localhost:3001",
          reuseExistingServer: true,
          timeout: 120000,
        },
      ],
});
