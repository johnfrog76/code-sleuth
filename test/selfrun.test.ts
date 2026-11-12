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
  it("finds no secret, machine path or note-to-self that is not marked as an example, and no history secret but the one accepted", () =>
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
        checks: {
          id: string;
          verdict: string;
          reason?: string;
          evidence?: { path: string; line?: number; rule?: string; commit?: string }[];
        }[];
      };
      for (const id of ["secrets.tree", "paths.machine", "quality.markers", "files.sensitive"]) {
        const check = record.checks.find((c) => c.id === id)!;
        expect(check.verdict, `${id}: ${JSON.stringify(check.evidence)}`).toBe("clean");
      }
      // One finding is accepted, and only that one: made-up test data in #44's commit, kept in the history on
      // purpose (docs/KNOWN-GAPS.md). Any other secret in the history, a new one in the same file included, fails.
      const history = record.checks.find((c) => c.id === "secrets.history")!;
      // A shallow clone stops the history at its cut and reads not investigated: this test needs a full clone.
      expect(history.verdict, `secrets.history: ${history.reason ?? ""}`).toBe("found");
      expect(
        history.evidence?.map(({ path, rule, commit }) => ({ path, rule, commit })),
        JSON.stringify(history.evidence),
      ).toEqual([
        {
          path: "test/engine/npmcopy.test.ts",
          rule: "assigned-secret",
          commit: "cf90958c7df7c84c8cfa3c4deb885adc23ffaed3",
        },
      ]);
    }));
});
