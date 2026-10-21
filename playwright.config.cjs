const { defineConfig } = require("@playwright/test");
const external = process.env.DILUTION_BASE_URL;
module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  use: {
    baseURL: external || "http://127.0.0.1:4173",
    browserName: "chromium",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: external
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
