import { defineConfig } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

// Local dev convenience: load .dev.vars into process.env so Playwright (a plain
// Node process, not the Worker runtime) can see E2E_TEST_EMAIL/PASSWORD. In CI
// these are provided directly as environment variables — .dev.vars won't exist there.
if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

export default defineConfig({
  testDir: "./tests",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        baseURL: "http://localhost:8787",
      },
    },
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        headless: true,
        storageState: "playwright/.auth/user.json",
        baseURL: "http://localhost:8787",
      },
      dependencies: ["setup"],
    },
  ],
});
