import { defineConfig, devices } from "@playwright/test";

// Test-only values baked into the production build the suite starts. The
// .test TLD is reserved, so this address can never reach a real inbox.
const TEST_ENV = {
  NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
  NEXT_DIST_DIR: ".next-e2e",
};

const external = process.env.E2E_BASE_URL;
const baseURL = external ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL },
  webServer: external
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: false,
        timeout: 400_000,
        env: TEST_ENV,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
});
