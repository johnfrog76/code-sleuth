import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Check } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { needReasons } from "../../src/engine/copy.js";
import { runGoal } from "../../src/engine/engine.js";
import { findGoal, GOALS, type Goal } from "../../src/engine/goals.js";
import { investigate } from "../helpers/investigate.js";

/** A check that exists only here, to prove the needs path without shipping an invented id. */
function needsGit(): Check & { run: ReturnType<typeof vi.fn> } {
  return {
    id: "test.needs-git",
    title: "A check that needs git",
    booksName: "test",
    needs: ["git"],
    voice: { clean: "clean", found: "found" },
    card: { title: "A test card", fix: "Nothing to fix." },
    run: vi.fn(() => ({ verdict: "clean" as const })),
  };
}

const goalOf = (id: string): Goal => ({ id: "public", checks: [{ id, weight: "hunch" }] });

describe("the needs path", () => {
  it("is not-investigated, with the reason, and never runs the rule when git is missing", () => {
    const check = needsGit();
    const [outcome] = investigate("reader/plain", (repo, capabilities) =>
      runGoal(goalOf(check.id), repo, capabilities, { table: [check] }),
    );
    expect(outcome!.result).toEqual({ verdict: "not-investigated", reason: needReasons.git });
    expect(check.run).not.toHaveBeenCalled();
  });

  it("runs the rule when git is there", () => {
    const check = needsGit();
    const [outcome] = investigate(
      "reader/plain",
      (repo, capabilities) => runGoal(goalOf(check.id), repo, capabilities, { table: [check] }),
      { git: true },
    );
    expect(outcome!.result).toEqual({ verdict: "clean" });
    expect(check.run).toHaveBeenCalledOnce();
  });

  it("has a reason for every need", () => {
    for (const reason of Object.values(needReasons)) expect(reason).toMatch(/\S/);
  });
});

describe("a goal", () => {
  it("runs its checks in its own order, each with the goal's weight", () => {
    const outcomes = investigate("docs.changelog/found", (repo, capabilities) =>
      runGoal(findGoal("public")!, repo, capabilities),
    );
    expect(outcomes.map((o) => [o.check.id, o.weight, o.result.verdict])).toEqual([
      ["secrets.tree", "smoking-gun", "clean"],
      ["secrets.history", "smoking-gun", "not-investigated"],
      ["files.sensitive", "smoking-gun", "clean"],
      ["license.file", "smoking-gun", "found"],
      ["license.deps", "loose-end", "clean"],
      ["paths.machine", "loose-end", "clean"],
      ["names.deny", "smoking-gun", "not-investigated"],
      ["files.large", "loose-end", "clean"],
      ["docs.readme", "loose-end", "found"],
      ["docs.contributing", "loose-end", "found"],
      ["docs.conduct", "loose-end", "found"],
      ["docs.security", "loose-end", "found"],
      ["docs.changelog", "hunch", "found"],
      ["github.templates", "loose-end", "found"],
      ["ci.present", "loose-end", "found"],
      ["ci.tests", "hunch", "found"],
      ["workflows.permissions", "hunch", "clean"],
      ["workflows.prtarget", "loose-end", "clean"],
      ["workflows.injection", "loose-end", "clean"],
      ["deps.lockfile", "hunch", "clean"],
      ["deps.advisories", "smoking-gun", "not-investigated"],
      ["deps.updates", "hunch", "found"],
      ["deps.outdated", "loose-end", "not-investigated"],
      ["quality.markers", "hunch", "clean"],
    ]);
  });

  it("refuses to run a check that is not in the table", () => {
    investigate("reader/plain", (repo, capabilities) => {
      expect(() => runGoal(goalOf("no.such-check"), repo, capabilities)).toThrow(/no\.such-check/);
    });
  });
});

describe("the check table", () => {
  it("has goal-free, dotted, unique ids, each with its words and voice", () => {
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CHECKS) {
      expect(check.id).toMatch(/^[a-z]+(\.[a-z][a-zA-Z]*)+$/);
      // Goal-free (D-CS24): no goal used as a namespace in front of a check, as `public.secrets.tree` would.
      // The spec's own `quality.*` checks are a family name, not a goal's copy of another check.
      const [head, ...rest] = check.id.split(".");
      if (GOALS.some((g) => g.id === head)) expect(CHECKS.map((c) => c.id)).not.toContain(rest.join("."));
      for (const words of [check.title, check.booksName, check.voice.clean, check.voice.found]) {
        expect(words).toMatch(/\S/);
      }
    }
  });

  it("is what every goal picks from, once per check", () => {
    for (const goal of GOALS) {
      const ids = goal.checks.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(CHECKS.map((c) => c.id)).toContain(id);
    }
  });

  it("holds the three goals", () => {
    expect(GOALS.map((g) => g.id)).toEqual(["public", "security", "quality"]);
  });
});

describe("the read-only helper", () => {
  it("fails a run that writes into the tree", () => {
    expect(() =>
      investigate("reader/plain", (repo) => writeFileSync(join(repo.root, "case.json"), "{}")),
    ).toThrow(/changed the tree/);
  });

  it("fails a run that changes git status and leaves every file alone", () => {
    // Untracking a file changes only the index, inside .git, so only the status check can see it.
    expect(() =>
      investigate(
        "reader/plain",
        (repo) => spawnSync("git", ["rm", "-q", "--cached", "a.txt"], { cwd: repo.root }),
        {
          git: true,
        },
      ),
    ).toThrow(/changed git status/);
  });
});
