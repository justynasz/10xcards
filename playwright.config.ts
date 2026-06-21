import { defineConfig } from "@playwright/test";

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
