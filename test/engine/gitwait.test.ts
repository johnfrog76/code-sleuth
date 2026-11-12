import { describe, expect, it } from "vitest";
import { copy } from "../../src/case/copy.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { gitTimedOutReason, needReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { GIT_TIMEOUT_MS, timedOut } from "../../src/engine/repo.js";
import { investigate } from "../helpers/investigate.js";

// When git is there and does not answer in time (a setting that never ends, a folder far too large), the run
// says so: "git did not answer in time", never "not a git repository" or "install git". Not investigated, never
// clean, either way. A real stall costs GIT_TIMEOUT_MS per call, so the decisions are held here, and a run over a
// stalled repository is the decoy case's (scripts/make-decoy-case.mjs, slowgit).

const check = (id: string) => CHECKS.find((c) => c.id === id)!;

describe("a git that did not answer in time", () => {
  it("is a call stopped at its timeout, not one that failed", () => {
    const stopped = Object.assign(new Error("spawnSync git ETIMEDOUT"), { code: "ETIMEDOUT" });
    const failed = Object.assign(new Error("spawnSync git ENOENT"), { code: "ENOENT" });
    expect(timedOut({ error: stopped })).toBe(true);
    expect(timedOut({ error: failed })).toBe(false);
    expect(timedOut({})).toBe(false);
    expect(GIT_TIMEOUT_MS).toBe(60_000);
  });

  it("is what the repo line says, in place of not a git repository", () => {
    expect(copy.repoLine("widget", null, null, null, false, true)).toBe(
      "widget (git did not answer in time)",
    );
    expect(copy.repoLine("widget", null, null, null)).toBe("widget (not a git repository)");
  });

  it("is the reason a check that needs git gives, and a check that read nothing never reads clean", () => {
    const results = investigate(
      { name: "widget", files: { "README.md": "# widget\n" } },
      (repo, capabilities) => {
        const stalled = { ...repo, isGitRepository: false, gitTimedOut: () => true };
        const noGit = { ...repo, isGitRepository: false, gitTimedOut: () => false };
        const without = new Set([...capabilities].filter((need) => need !== "git"));
        const run = (reader: typeof repo, id: string) =>
          runCheck(check(id), reader, without, secretHasher(Buffer.alloc(32)));
        return { stalled: run(stalled, "secrets.history"), noGit: run(noGit, "secrets.history") };
      },
    );
    expect(results.stalled).toEqual({ verdict: "not-investigated", reason: gitTimedOutReason });
    expect(results.noGit).toEqual({ verdict: "not-investigated", reason: needReasons.git });
  });
});
