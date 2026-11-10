import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "hosted-e2e",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL:
      process.env.ROCKET_PAGES_TEST_URL || "http://127.0.0.1:4173/Hoshi/",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "../tests/hosted-browser-results.json" }],
  ],
});
