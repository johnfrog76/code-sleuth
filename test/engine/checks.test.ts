import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { investigate } from "../helpers/investigate.js";

function verdictOf(checkId: string, fixture: string, git = false) {
  const check = CHECKS.find((c) => c.id === checkId)!;
  return investigate(
    fixture,
    (repo, capabilities) => runCheck(check, repo, capabilities, secretHasher(Buffer.alloc(32))),
    { git },
  );
}

// One row per input each rule distinguishes. Both checks need nothing, so they have no not-investigated row.
describe.each([
  ["docs.changelog", "clean", "clean"],
  ["docs.changelog", "clean-any-case", "clean"],
  ["docs.changelog", "found", "found"],
  ["docs.changelog", "found-not-at-root", "found"],
  ["docs.conduct", "clean-root", "clean"],
  ["docs.conduct", "clean-github", "clean"],
  ["docs.conduct", "clean-docs", "clean"],
  ["docs.conduct", "found", "found"],
  ["docs.conduct", "found-elsewhere", "found"],
])("%s over %s", (checkId, row, verdict) => {
  it(`is ${verdict}, outside a repository`, () => {
    expect(verdictOf(checkId, `${checkId}/${row}`).verdict).toBe(verdict);
  });

  it(`is ${verdict}, inside one`, () => {
    expect(verdictOf(checkId, `${checkId}/${row}`, true).verdict).toBe(verdict);
  });
});
