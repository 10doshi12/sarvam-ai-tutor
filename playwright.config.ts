import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const MINUTE = 60_000;

// WebKit only: it is the browser project standard on macOS.
export default defineConfig({
  testDir: "./e2e",
  timeout: 8 * MINUTE,
  expect: { timeout: MINUTE },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Trace recording can freeze WebKit when a test closes after a long lesson.
    trace: "off",
  },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 2 * MINUTE,
  },
});
