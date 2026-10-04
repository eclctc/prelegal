import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3100", acceptDownloads: true },
  webServer: {
    command: "npm run build && uv run --directory ../backend uvicorn app.main:app --port 3100",
    url: "http://localhost:3100",
    env: { STATIC_DIR: "../frontend/out" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
