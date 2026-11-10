import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "public-e2e",
  reporter: [
    ["list"],
    ["json", { outputFile: "../tests/public-browser-results.json" }],
  ],
});
