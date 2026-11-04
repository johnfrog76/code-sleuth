import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Need, Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { breakingPart, majorBehind } from "../../src/engine/checks/deps.outdated.js";
import { needReasons, outdatedReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { findNpm } from "../../src/engine/npm.js";
import { sleuth } from "../helpers/cli.js";
import { investigate, investigateAsync } from "../helpers/investigate.js";
import { type NpmScenario, stubNpm } from "../helpers/npm.js";
import { withScratch } from "../helpers/scratch.js";

const outdated = CHECKS.find((c) => c.id === "deps.outdated")!;

const manifest = (deps: Record<string, string>, dev: Record<string, string> = {}) =>
  JSON.stringify({ name: "widget", version: "1.0.0", dependencies: deps, devDependencies: dev }, null, 2) +
  "\n";
const lockfile = (versions: Record<string, string>) =>
  JSON.stringify({
    name: "widget",
    lockfileVersion: 3,
    packages: {
      "": { name: "widget" },
      ...Object.fromEntries(Object.entries(versions).map(([n, v]) => [`node_modules/${n}`, { version: v }])),
    },
  }) + "\n";

/** deps.outdated over a tree built in code, with a stub npm, and the needs the run has. */
function run(files: Record<string, string>, scenario: NpmScenario = {}, needs: Need[] = ["npm", "network"]) {
  return withScratch((scratch) => {
    const npm = stubNpm(scratch, scenario);
    const runner = findNpm(npm.env)!;
    const result: Result = investigate({ name: "repo", files }, (repo) =>
      runCheck(outdated, repo, new Set(needs), { ...secretHasher(Buffer.alloc(32)), npm: runner }),
    );
    return { result, calls: npm.calls().filter((c) => c.argv[0] === "outdated") };
  });
}

const app = {
  "package.json": manifest({ react: "^17.0.2", tiny: "^0.3.1", lodash: "^4.17.0" }, { vitest: "^4.0.0" }),
  "package-lock.json": lockfile({ react: "17.0.2", tiny: "0.3.1", lodash: "4.17.21", vitest: "4.1.0" }),
};

describe("deps.outdated", () => {
  it("is clean, and makes no call, with no package.json", () => {
    const { result, calls } = run({ "README.md": "x\n" });
    expect(result).toEqual({ verdict: "clean" });
    expect(calls).toEqual([]);
  });

  it("is clean, and makes no call, with no dependencies", () => {
    expect(run({ "package.json": manifest({}) }).calls).toEqual([]);
  });

  it("is clean when nothing is a major version behind", () => {
    const { result, calls } = run(app, {
      outdated: { lodash: { latest: "4.17.23" }, react: { latest: "17.0.5" } },
    });
    expect(result).toEqual({ verdict: "clean" });
    expect(calls).toHaveLength(1);
  });

  it("finds each direct dependency a major version behind, with the line it is declared on", () => {
    const { result } = run(app, {
      outdated: {
        react: { latest: "19.3.1" },
        tiny: { latest: "0.4.0" },
        lodash: { latest: "4.17.23" },
        vitest: { latest: "5.1.0" },
      },
    });
    expect(result).toEqual({
      verdict: "found",
      evidence: [
        { path: "package.json", line: 5, excerpt: "react 17.0.2, latest 19.3.1", rule: "major-behind" },
        { path: "package.json", line: 6, excerpt: "tiny 0.3.1, latest 0.4.0", rule: "major-behind" },
        { path: "package.json", line: 10, excerpt: "vitest 4.1.0, latest 5.1.0 (dev)", rule: "major-behind" },
      ],
    });
  });

  it("asks npm once, on a copy of the project, with names only: no path, no file, no URL in its arguments", () => {
    const { calls } = run(app, { outdated: {} });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.argv).toEqual(["outdated", "--json", "--long"]);
  });

  it.each([
    ["no lockfile", { "package.json": manifest({ react: "^17.0.2" }) }, outdatedReasons.noLockfile],
    [
      "another package manager's lockfile",
      { "package.json": manifest({ react: "^17.0.2" }), "yarn.lock": "x\n" },
      outdatedReasons.otherLockfile,
    ],
  ])("is not investigated with %s, and makes no call", (_, files, reason) => {
    const { result, calls } = run(files);
    expect(result).toEqual({ verdict: "not-investigated", reason });
    expect(calls).toEqual([]);
  });

  it.each([
    ["no npm", ["network"] as Need[], needReasons.npm],
    ["--offline", ["npm"] as Need[], needReasons.network],
  ])("is not investigated with %s, and makes no call", (_, needs, reason) => {
    const { result, calls } = run(app, { outdated: {} }, needs);
    expect(result).toEqual({ verdict: "not-investigated", reason });
    expect(calls).toEqual([]);
  });

  it("says --offline when that is why", () => {
    expect(needReasons.network).toContain("--offline");
  });

  it.each([
    ["npm fails", { status: 2, raw: "" }],
    ["npm answers with an error", { status: 1, raw: JSON.stringify({ error: { code: "E404" } }) }],
    ["npm answers with something that is not JSON", { status: 0, raw: "npm WARN something" }],
  ])("is not investigated when %s", (_, scenario) => {
    expect(run(app, scenario).result).toEqual({
      verdict: "not-investigated",
      reason: outdatedReasons.failed,
    });
  });
});

describe("a major version behind", () => {
  it.each([
    ["17.0.2", "19.3.1", true],
    ["4.17.21", "4.18.0", false],
    ["0.3.1", "0.4.0", true],
    ["0.3.1", "0.3.9", false],
    ["0.9.0", "1.0.0", true],
    ["1.0.0", "1.0.0-rc.1", false],
    ["not-a-version", "2.0.0", false],
  ])("%s against %s: %s", (current, latest, expected) => expect(majorBehind(current, latest)).toBe(expected));

  it("reads 0.x by its minor, as npm's caret does", () => {
    expect(breakingPart("0.3.1")).toBe("0.3");
    expect(breakingPart("2.1.0")).toBe("2");
  });
});

describe("finding npm", () => {
  it("is the npm on the PATH, outside Windows", () => {
    withScratch((scratch) => {
      expect(findNpm(stubNpm(scratch).env, "darwin")).toBeDefined();
      expect(findNpm({ PATH: join(scratch, "nowhere") }, "linux")).toBeUndefined();
    });
  });

  it("is npm-cli.js beside node on Windows, and nothing without it", () => {
    withScratch((scratch) => {
      const node = join(scratch, "node.exe");
      expect(findNpm({}, "win32", node)).toBeUndefined();
      mkdirSync(join(scratch, "node_modules", "npm", "bin"), { recursive: true });
      writeFileSync(join(scratch, "node_modules", "npm", "bin", "npm-cli.js"), "");
      expect(findNpm({}, "win32", node)).toBeDefined();
    });
  });
});

describe("the run names what leaves the machine", () => {
  const files = { ...app };
  const runCli = (extra: string[], scenario: NpmScenario = { outdated: {} }) =>
    withScratch((scratch) => {
      const npm = stubNpm(scratch, scenario);
      return investigateAsync({ name: "widget", files }, async (root) => {
        const result = await sleuth([root, "--goal", "public", "--out", join(scratch, "cases"), ...extra], {
          casesFolder: join(scratch, "default"),
          env: npm.env,
        });
        const calls = npm.calls().filter((c) => c.argv[0] === "outdated");
        return { result, calls, all: npm.calls(), root: realpathSync(root) };
      });
    });

  it("names npm outdated and npm's configured registry among the Out lines, before the stakeout, then calls it once", async () => {
    const { result, calls } = await runCli([]);
    const out = result.stdout.indexOf("npm outdated asks npm's configured registry");
    expect(out).toBeGreaterThan(-1);
    expect(out).toBeLessThan(result.stdout.indexOf("Taking my time."));
    expect(result.stdout).toContain(
      "for each direct dependency's latest version (names only) (--offline skips it)\n",
    );
    expect(calls).toHaveLength(1);
  });

  it("with --offline, names nothing, calls nothing, and says why the check did not run", async () => {
    const { result, all } = await runCli(["--offline", "--json"]);
    expect(result.stderr).toContain("  Out   nothing: this run makes no network calls\n");
    expect(all).toEqual([]);
    const check = JSON.parse(result.stdout).checks.find((c: { id: string }) => c.id === "deps.outdated");
    expect(check).toMatchObject({ verdict: "not-investigated", reason: needReasons.network });
  });

  it("finds a major version behind through the whole run, as a loose end with a card", async () => {
    const { result } = await runCli(["--json"], { outdated: { react: { latest: "19.3.1" } } });
    const record = JSON.parse(result.stdout);
    const check = record.checks.find((c: { id: string }) => c.id === "deps.outdated");
    expect(check).toMatchObject({ verdict: "found", weight: "loose-end" });
    expect(check.card).toBeDefined();
  });
});
