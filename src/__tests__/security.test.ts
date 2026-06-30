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
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Security invariants", () => {
  it("no API route imports createAdminClient", () => {
    const apiDir = join(process.cwd(), "src", "pages", "api", "flashcards");
    const files = collectTsFiles(apiDir);
    const violators = files.filter((f) => readFileSync(f, "utf-8").includes("createAdminClient"));
    expect(violators).toEqual([]);
  });
});
