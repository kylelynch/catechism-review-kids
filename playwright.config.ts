import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command:
      "VITE_E2E=1 npm run dev -- --host 127.0.0.1 --port 5199 --strictPort",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: false,
  },
  use: { baseURL: "http://127.0.0.1:5199" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
