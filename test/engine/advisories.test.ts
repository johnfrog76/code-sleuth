import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CheckContext, Evidence, Need, Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { inRange, severityOf } from "../../src/engine/checks/deps.advisories.js";
import { advisoriesReasons, needReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher, weighFound } from "../../src/engine/engine.js";
import { findGh, findNpm } from "../../src/engine/npm.js";
import { sleuth } from "../helpers/cli.js";
import { investigate, investigateAsync } from "../helpers/investigate.js";
import { type GhScenario, type NpmScenario, stubGh, stubNpm } from "../helpers/npm.js";
import { withScratch } from "../helpers/scratch.js";

const advisories = CHECKS.find((c) => c.id === "deps.advisories")!;

const manifest = (deps: Record<string, string>) =>
  JSON.stringify({ name: "widget", version: "1.0.0", dependencies: deps }, null, 2) + "\n";
const lockfile = (packages: Record<string, string>) =>
  JSON.stringify(
    {
      name: "widget",
      lockfileVersion: 3,
      packages: {
        "": { name: "widget" },
        ...Object.fromEntries(Object.entries(packages).map(([key, version]) => [key, { version }])),
      },
    },
    null,
    2,
  ) + "\n";

const app = {
  "package.json": manifest({ minimist: "^1.2.0", lodash: "^4.17.0" }),
  "package-lock.json": lockfile({
    "node_modules/minimist": "1.2.0",
    "node_modules/lodash": "4.17.21",
    "node_modules/lodash/node_modules/minimist": "1.2.8",
  }),
};

/** npm audit's entry for a package that carries its own advisories. */
const vulnerable = (name: string, node: string, ...vias: { title: string; severity: string }[]) => ({
  [name]: {
    name,
    severity: vias[0]!.severity,
    isDirect: true,
    via: vias.map((v) => ({
      source: 1,
      name,
      dependency: name,
      url: "https://example.test",
      range: "<9",
      ...v,
    })),
    effects: [],
    range: "<9",
    nodes: [node],
    fixAvailable: true,
  },
});

/** A GitHub advisory, as `gh api /advisories --jq '.[]'` prints one. */
const ghAdvisory = (severity: string, summary: string, name: string, range: string, withdrawn = false) => ({
  ghsa_id: "GHSA-test-test-test",
  severity,
  summary,
  withdrawn_at: withdrawn ? "2026-01-01T00:00:00Z" : null,
  vulnerabilities: [
    { package: { ecosystem: "npm", name }, vulnerable_version_range: range },
    { package: { ecosystem: "npm", name: "unrelated" }, vulnerable_version_range: "< 9.0.0" },
  ],
});

interface Stubs {
  npm?: NpmScenario;
  gh?: GhScenario;
  needs?: Need[];
}

/** deps.advisories over a tree built in code, with stub tools, and the needs the run has. */
function run(files: Record<string, string>, stubs: Stubs = { npm: {} }) {
  return withScratch((scratch) => {
    const npm = stubs.npm === undefined ? undefined : stubNpm(scratch, stubs.npm);
    const gh = stubs.gh === undefined ? undefined : stubGh(scratch, stubs.gh);
    const context: CheckContext = {
      ...secretHasher(Buffer.alloc(32)),
      ...(npm === undefined ? {} : { npm: findNpm(npm.env)! }),
      ...(gh === undefined ? {} : { gh: findGh(gh.env)! }),
    };
    const needs = new Set<Need>(
      stubs.needs ?? ["network", ...(npm ? ["npm" as const] : []), ...(gh ? ["gh" as const] : [])],
    );
    let root = "";
    const result: Result = investigate({ name: "repo", files }, (repo) => {
      root = repo.root;
      return runCheck(advisories, repo, needs, context);
    });
    return { result, npmCalls: npm?.calls() ?? [], ghCalls: gh?.calls() ?? [], root };
  });
}

const evidenceOf = (result: Result): Evidence[] => (result.verdict === "found" ? result.evidence : []);

describe("deps.advisories through npm audit", () => {
  it("is clean, and makes no call, with no package.json or no dependencies", () => {
    for (const files of [{ "README.md": "x\n" }, { "package.json": manifest({}) }]) {
      const { result, npmCalls } = run(files, { npm: {}, gh: {} });
      expect(result).toEqual({ verdict: "clean" });
      expect(npmCalls).toEqual([]);
    }
  });

  it("is clean when the report finds nothing, after one npm audit --json on a copy of the project", () => {
    const { result, npmCalls } = run(app);
    expect(result).toEqual({ verdict: "clean" });
    expect(npmCalls).toHaveLength(1);
    expect(npmCalls[0]!.argv).toEqual(["audit", "--json"]);
  });

  it("finds each package with its own advisory, heaviest first, at its line in the lockfile", () => {
    const { result } = run(app, {
      npm: {
        audit: {
          vulnerabilities: {
            ...vulnerable("lodash", "node_modules/lodash", {
              title: "Command injection",
              severity: "moderate",
            }),
            ...vulnerable(
              "minimist",
              "node_modules/minimist",
              { title: "Prototype pollution", severity: "low" },
              { title: "Prototype pollution again", severity: "critical" },
            ),
            // Vulnerable only through minimist: listed there, not again here.
            parent: {
              name: "parent",
              severity: "critical",
              via: ["minimist"],
              nodes: ["node_modules/parent"],
            },
          },
        },
      },
    });
    expect(evidenceOf(result)).toEqual([
      {
        path: "package-lock.json",
        line: 8,
        excerpt: "minimist 1.2.0, critical: Prototype pollution again, and 1 more",
        rule: "advisory",
      },
      {
        path: "package-lock.json",
        line: 11,
        excerpt: "lodash 4.17.21, moderate: Command injection",
        rule: "advisory",
        weighed: "moderate",
      },
    ]);
  });

  it.each([
    ["exits with something other than 0 or 1", { auditStatus: 2 }],
    ["prints something that is not JSON", { audit: { raw: "npm ERR! oops" } }],
    ["answers with an error", { audit: { raw: JSON.stringify({ error: { code: "ENOLOCK" } }) } }],
  ])("is not investigated when npm audit %s", (_, scenario) => {
    expect(run(app, { npm: scenario }).result).toEqual({
      verdict: "not-investigated",
      reason: advisoriesReasons.npmFailed,
    });
  });

  it("asks npm, not gh, when it has both", () => {
    const { npmCalls, ghCalls } = run(app, { npm: {}, gh: {} });
    expect(npmCalls).toHaveLength(1);
    expect(ghCalls).toEqual([]);
  });
});

describe("deps.advisories through gh, with no npm", () => {
  it("asks GitHub about each locked name and version, and credits only the versions in range", () => {
    const { result, ghCalls } = run(app, {
      gh: {
        advisories: [
          ghAdvisory("critical", "Prototype pollution in minimist", "minimist", ">= 1.0.0, < 1.2.6"),
          ghAdvisory("high", "Withdrawn: not an advisory", "lodash", "< 5.0.0", true),
        ],
      },
    });
    expect(ghCalls).toHaveLength(1);
    expect(ghCalls[0]!.argv).toEqual([
      "api",
      "-X",
      "GET",
      "/advisories",
      "-f",
      "ecosystem=npm",
      "-f",
      "affects=minimist@1.2.0,minimist@1.2.8,lodash@4.17.21",
      "-f",
      "per_page=100",
      "--paginate",
      "--jq",
      ".[]",
    ]);
    expect(evidenceOf(result)).toEqual([
      {
        path: "package-lock.json",
        line: 8,
        excerpt: "minimist 1.2.0, critical: Prototype pollution in minimist",
        rule: "advisory",
      },
    ]);
  });

  it("reads GitHub's medium as moderate, a loose end in a smoking-gun goal", () => {
    const { result } = run(app, {
      gh: { advisories: [ghAdvisory("medium", "ReDoS", "lodash", "< 4.17.22")] },
    });
    expect(evidenceOf(result)[0]).toMatchObject({
      excerpt: "lodash 4.17.21, moderate: ReDoS",
      weighed: "moderate",
    });
    expect(weighFound("smoking-gun", evidenceOf(result))).toBe("loose-end");
  });

  it("asks in batches, so no query grows long", () => {
    const many = Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`node_modules/p${i}`, "1.0.0"]));
    const files = { "package.json": manifest({ p0: "1.0.0" }), "package-lock.json": lockfile(many) };
    const { result, ghCalls } = run(files, { gh: {} });
    expect(result).toEqual({ verdict: "clean" });
    expect(ghCalls).toHaveLength(3);
  });

  it.each([
    ["is not signed in", { status: 1 }],
    ["prints something that is not JSON", { raw: "<html>\n" }],
  ])("is not investigated when gh %s", (_, scenario) => {
    expect(run(app, { gh: scenario }).result).toEqual({
      verdict: "not-investigated",
      reason: advisoriesReasons.ghFailed,
    });
  });
});

describe("deps.advisories cannot look", () => {
  it.each([
    ["no lockfile", { "package.json": manifest({ a: "1" }) }, advisoriesReasons.noLockfile],
    [
      "another package manager's lockfile",
      { "package.json": manifest({ a: "1" }), "yarn.lock": "" },
      advisoriesReasons.otherLockfile,
    ],
    [
      "a lockfile that is not JSON",
      { "package.json": manifest({ a: "1" }), "package-lock.json": "{" },
      advisoriesReasons.unreadableLockfile("package-lock.json"),
    ],
  ])("with %s, and makes no call", (_, files, reason) => {
    const { result, npmCalls, ghCalls } = run(files, { npm: {}, gh: {} });
    expect(result).toEqual({ verdict: "not-investigated", reason });
    expect([...npmCalls, ...ghCalls]).toEqual([]);
  });

  it("with --offline, and makes no call", () => {
    const { result, npmCalls, ghCalls } = run(app, { npm: {}, gh: {}, needs: ["npm", "gh"] });
    expect(result).toEqual({ verdict: "not-investigated", reason: needReasons.network });
    expect([...npmCalls, ...ghCalls]).toEqual([]);
  });

  // #12: --offline is the reason only where a call would have been made; elsewhere the check reads as online.
  it.each([
    ["no package.json", { "README.md": "# a\n" }, { verdict: "clean" }],
    ["no dependencies", { "package.json": "{}" }, { verdict: "clean" }],
    [
      "dependencies and no lockfile",
      { "package.json": manifest({ a: "1" }) },
      { verdict: "not-investigated", reason: advisoriesReasons.noLockfile },
    ],
  ])("under --offline with %s, reads as it would online, and makes no call", (_, files, expected) => {
    const { result, npmCalls, ghCalls } = run(files, { npm: {}, gh: {}, needs: [] });
    expect(result).toEqual(expected);
    expect([...npmCalls, ...ghCalls]).toEqual([]);
  });

  it("with neither npm nor gh", () => {
    expect(run(app, { needs: ["network"] }).result).toEqual({
      verdict: "not-investigated",
      reason: advisoriesReasons.noTool,
    });
  });
});

describe("the advisory weights", () => {
  const piece = (weighed?: "moderate" | "low"): Evidence => ({ path: "p", ...(weighed ? { weighed } : {}) });

  it("keep critical and high at the goal's weight, step moderate down one and low two, the heaviest deciding", () => {
    expect(weighFound("smoking-gun", [piece()])).toBe("smoking-gun");
    expect(weighFound("smoking-gun", [piece("moderate")])).toBe("loose-end");
    expect(weighFound("smoking-gun", [piece("low")])).toBe("hunch");
    expect(weighFound("smoking-gun", [piece("low"), piece("moderate")])).toBe("loose-end");
    expect(weighFound("loose-end", [piece("low")])).toBe("hunch");
  });

  it("read npm's and GitHub's severities", () => {
    expect(["critical", "high", "moderate", "medium", "low", "info", "odd"].map(severityOf)).toEqual([
      "critical",
      "high",
      "moderate",
      "moderate",
      "low",
      "info",
      undefined,
    ]);
  });
});

describe("GitHub's version ranges", () => {
  it.each([
    ["1.2.0", ">= 1.0.0, < 1.2.6", true],
    ["1.2.6", ">= 1.0.0, < 1.2.6", false],
    ["0.9.0", ">= 1.0.0, < 1.2.6", false],
    ["1.2.6", "<= 1.2.6", true],
    ["2.0.0", "= 2.0.0", true],
    ["2.0.1", "= 2.0.0", false],
    ["2.0.0-beta.1", "< 2.0.0", true],
    ["2.0.0", "> 2.0.0-rc.1", true],
    ["1.0.0", "a range I cannot read", true],
  ])("%s in %s is %s", (version, range, inside) => {
    expect(inRange(version, range)).toBe(inside);
  });
});

describe("the run names the advisory lookup, and holds a vulnerable repository back", () => {
  const runCli = (stubs: { npm?: NpmScenario; gh?: GhScenario }, extra: string[] = []) =>
    withScratch((scratch) => {
      const npm = stubs.npm === undefined ? undefined : stubNpm(scratch, stubs.npm);
      const gh = stubs.gh === undefined ? undefined : stubGh(scratch, stubs.gh);
      const env = {
        ...npm?.env,
        ...gh?.env,
        PATH: [npm?.env.PATH, gh?.env.PATH].filter((p) => p !== undefined).join(":"),
      };
      return investigateAsync({ name: "widget", files: app }, async (root) => {
        const result = await sleuth([root, "--goal", "public", "--out", join(scratch, "cases"), ...extra], {
          casesFolder: join(scratch, "default"),
          env,
        });
        return { result, npmCalls: npm?.calls() ?? [], ghCalls: gh?.calls() ?? [] };
      });
    });

  it("names npm audit and npm's configured registry before the stakeout", async () => {
    const { result } = await runCli({ npm: {} });
    const out = result.stdout.indexOf(`${advisoriesReasons.outgoing.npm} (--offline skips it)\n`);
    expect(out).toBeGreaterThan(-1);
    expect(out).toBeLessThan(result.stdout.indexOf("Taking my time."));
  });

  it("names GitHub's advisory database when only gh is there, and nothing of npm", async () => {
    const { result, ghCalls } = await runCli({ gh: {} });
    expect(result.stdout).toContain(`${advisoriesReasons.outgoing.gh} (--offline skips it)\n`);
    expect(result.stdout).not.toContain("npm audit");
    expect(ghCalls).toHaveLength(1);
  });

  it("with --offline, names nothing and calls nothing", async () => {
    const { result, npmCalls, ghCalls } = await runCli({ npm: {}, gh: {} }, ["--offline"]);
    expect(result.stdout).toContain("  Out   nothing: this run makes no network calls\n");
    expect([...npmCalls, ...ghCalls]).toEqual([]);
  });

  it("does not read MET with a known high advisory, which is a smoking gun with a card", async () => {
    const { result } = await runCli(
      {
        npm: {
          audit: {
            vulnerabilities: vulnerable("minimist", "node_modules/minimist", {
              title: "Prototype pollution",
              severity: "high",
            }),
          },
        },
      },
      ["--json"],
    );
    const record = JSON.parse(result.stdout);
    expect(record.verdict).not.toBe("met");
    const check = record.checks.find((c: { id: string }) => c.id === "deps.advisories");
    expect(check).toMatchObject({ verdict: "found", weight: "smoking-gun" });
    expect(check.card).toBeDefined();
  });
});
