import { describe, expect, it } from "vitest";
import type { CheckContext, Need, Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { licenseDepsReasons, outdatedReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { isStrongCopyleft } from "../../src/engine/licenses.js";
import { findGh, findNpm } from "../../src/engine/npm.js";
import { investigate } from "../helpers/investigate.js";
import { type GhScenario, type NpmScenario, stubGh, stubNpm } from "../helpers/npm.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's medium finding 15: checks that read clean, or a confident found, on what they had not read.

function check(
  id: string,
  files: Record<string, string>,
  stubs: { npm?: NpmScenario; gh?: GhScenario } = {},
) {
  return withScratch((scratch) => {
    const npm = stubs.npm === undefined ? undefined : stubNpm(scratch, stubs.npm);
    const gh = stubs.gh === undefined ? undefined : stubGh(scratch, stubs.gh);
    const context: CheckContext = {
      ...secretHasher(Buffer.alloc(32)),
      ...(npm === undefined ? {} : { npm: findNpm(npm.env)! }),
      ...(gh === undefined ? {} : { gh: findGh(gh.env)! }),
    };
    const needs = new Set<Need>([
      "network",
      ...(npm ? ["npm" as const] : []),
      ...(gh ? ["gh" as const] : []),
    ]);
    const result: Result = investigate({ name: "repo", files }, (repo) =>
      runCheck(
        CHECKS.find((c) => c.id === id)!,
        repo,
        needs,
        context,
      ),
    );
    return { result, npmCalls: npm?.calls() ?? [], ghCalls: gh?.calls() ?? [] };
  });
}

const workflow = (body: string) => ({ ".github/workflows/w.yml": body });
const v1 = JSON.stringify({ name: "w", lockfileVersion: 1, dependencies: { leftpad: { version: "1.0.0" } } });
const manifest = JSON.stringify({ name: "w", version: "1.0.0", dependencies: { leftpad: "^1.0.0" } });

describe("a check that has not read something says so", () => {
  it("finds a pull_request_target workflow that checks out merge_commit_sha", () => {
    const wf = workflow(
      "on: pull_request_target\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.merge_commit_sha }}\n      - run: npm ci && npm test\n",
    );
    expect(check("workflows.prtarget", wf).result.verdict).toBe("found");
  });

  it("finds a stranger's field written in index syntax", () => {
    const wf = workflow(
      'on: issues\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "${{ github.event[\'issue\']["title"] }}"\n',
    );
    expect(check("workflows.injection", wf).result.verdict).toBe("found");
  });

  it.each(["ci.tests", "ci.present"])(
    "reads %s not investigated when the only workflow does not parse",
    (id) => {
      expect(check(id, workflow("on: [push\n  bad: :\n")).result.verdict).toBe("not-investigated");
    },
  );

  it("keeps a copyleft finding beside a lockfile it cannot read, and leaves an example's out", () => {
    const gpl = JSON.stringify({
      lockfileVersion: 3,
      packages: { "": {}, "node_modules/g": { version: "1.0.0", license: "GPL-3.0" } },
    });
    const files = {
      "a/package.json": "{}",
      "a/package-lock.json": gpl,
      "test/fixtures/bad/package-lock.json": "{",
    };
    expect(check("license.deps", files).result).toMatchObject({
      verdict: "found",
      evidence: [{ rule: "strong-copyleft" }],
    });
  });

  it("names a lockfile it cannot read when nothing else is found", () => {
    const clean = JSON.stringify({
      lockfileVersion: 3,
      packages: { "": {}, "node_modules/m": { version: "1.0.0", license: "MIT" } },
    });
    const files = {
      "a/package.json": "{}",
      "a/package-lock.json": clean,
      "b/package.json": "{}",
      "b/package-lock.json": "{",
    };
    expect(check("license.deps", files).result).toEqual({
      verdict: "not-investigated",
      reason: licenseDepsReasons.unreadable("b/package-lock.json"),
    });
  });

  it.each([
    ["GPL-3.0 AND (MIT OR Apache-2.0)", true],
    ["(MIT OR GPL-3.0) AND GPL-2.0", true],
    ["GPL-3.0-only WITH Classpath-exception-2.0", true],
    ["GPL-2.0 OR GPL-3.0", true],
    ["MIT OR GPL-3.0", false],
    ["(MIT)", false],
    ["MIT AND (Apache-2.0 OR BSD-3-Clause)", false],
  ])("reads %j as strong copyleft: %s", (expression, bound) => {
    expect(isStrongCopyleft(expression)).toBe(bound);
  });

  it("does not take license-checker.json for a license", () => {
    expect(check("license.file", { "license-checker.json": "{}", "README.md": "# r\n" }).result.verdict).toBe(
      "found",
    );
  });

  // #12: an npm project below the root is looked up in its own folder, never left out and never read clean.
  it("looks up an npm project below the root, in its own folder, and names its file", () => {
    const files = { "app/package.json": manifest, "app/package-lock.json": v1 };
    const { result, npmCalls } = check("deps.outdated", files, {
      npm: { outdated: { leftpad: { latest: "9.0.0" } } },
    });
    expect(result).toMatchObject({
      verdict: "found",
      evidence: [{ path: "app/package.json", excerpt: "leftpad 1.0.0, latest 9.0.0" }],
    });
    expect(npmCalls.filter((c) => c.argv[0] === "outdated")).toHaveLength(1);
  });

  it("reads npm outdated's exit 1 with nothing printed as a failure", () => {
    const files = { "package.json": manifest, "package-lock.json": v1 };
    expect(check("deps.outdated", files, { npm: { raw: "", status: 1 } }).result).toEqual({
      verdict: "not-investigated",
      reason: outdatedReasons.failed,
    });
  });

  it("reads a v1 lockfile's versions: a dependency eight majors behind is found", () => {
    const files = { "package.json": manifest, "package-lock.json": v1 };
    const { result } = check("deps.outdated", files, { npm: { outdated: { leftpad: { latest: "9.0.0" } } } });
    expect(result).toMatchObject({
      verdict: "found",
      evidence: [{ excerpt: "leftpad 1.0.0, latest 9.0.0" }],
    });
  });

  it("asks GitHub about a v1 lockfile's packages, rather than nothing", () => {
    const files = { "package.json": manifest, "package-lock.json": v1 };
    const { ghCalls } = check("deps.advisories", files, { gh: {} });
    expect(ghCalls.length).toBeGreaterThan(0);
    expect(ghCalls[0]!.argv.join(" ")).toContain("leftpad");
  });
});
