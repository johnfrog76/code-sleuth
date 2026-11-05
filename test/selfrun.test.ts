import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withScratch } from "./helpers/scratch.js";

// Code Sleuth on its own repository, offline: a test's bait that lacks its code-sleuth:example marker shows up
// here as a finding, as it did once in a real self-run. Read-only: --out goes to scratch, and offline runs no npm.

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const MAIN = join(ROOT, "dist", "cli", "main.js");

describe("Code Sleuth on its own repository", () => {
  it("finds no secret, machine path or note-to-self in the tree that is not marked as an example", () =>
    withScratch((scratch) => {
      const out = join(scratch, "cases");
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      const result = spawnSync(
        process.execPath,
        [MAIN, ROOT, "--goal", "public", "--offline", "--out", out],
        {
          env,
          encoding: "utf8",
        },
      );
      expect(result.status).toBe(0);
      const file = (readdirSync(out, { recursive: true }) as string[]).find((name) =>
        name.endsWith("case.json"),
      )!;
      const record = JSON.parse(readFileSync(join(out, file), "utf8")) as {
        checks: { id: string; verdict: string; evidence?: { path: string; line?: number }[] }[];
      };
      for (const id of ["secrets.tree", "paths.machine", "quality.markers", "files.sensitive"]) {
        const check = record.checks.find((c) => c.id === id)!;
        expect(check.verdict, `${id}: ${JSON.stringify(check.evidence)}`).toBe("clean");
      }
    }));
});
