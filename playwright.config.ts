import { defineConfig, devices } from "@playwright/test";

// Test-only values baked into the production build the suite starts. The
// .test TLD is reserved, so this address can never reach a real inbox.
const TEST_ENV = {
  NEXT_PUBLIC_GA_ID: "G-TEST000000",
  NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test",
};

const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL: external ?? "http://localhost:3100" },
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
