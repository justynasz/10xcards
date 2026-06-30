// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      files.push(...collectTsFiles(full));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".spec.ts")
    ) {
      files.push(full);
    }
  }
  return files;
}

const ALLOWLISTED_DIRS = ["auth"];

describe("Security invariants", () => {
  it("no API route imports createAdminClient", () => {
    const apiDir = join(process.cwd(), "src", "pages", "api");
    const files = collectTsFiles(apiDir).filter((f) => {
      const rel = f.replace(apiDir, "").replace(/\\/g, "/");
      return !ALLOWLISTED_DIRS.some((d) => rel.startsWith(`/${d}/`));
    });
    const violators = files.filter((f) => readFileSync(f, "utf-8").includes("createAdminClient"));
    expect(violators).toEqual([]);
  });
});
