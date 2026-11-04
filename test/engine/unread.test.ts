import { describe, expect, it } from "vitest";
import type { Need, Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { denyReasons, ecosystemReasons, workflowReasons } from "../../src/engine/copy.js";
import { otherManifests } from "../../src/engine/ecosystems.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { findNpm } from "../../src/engine/npm.js";
import { type BuiltFixture, investigate, type InvestigateOptions } from "../helpers/investigate.js";
import { stubNpm } from "../helpers/npm.js";
import { withScratch } from "../helpers/scratch.js";

// AGENTS rule 3: a check that read nothing reads not investigated, with the reason. Clean means it looked.

const byId = (id: string) => CHECKS.find((c) => c.id === id)!;

/** Runs one check over a tree built in code, with a stub npm that finds nothing. */
function check(
  id: string,
  files: BuiltFixture["files"],
  options: InvestigateOptions & { denyList?: string[] } = {},
) {
  return withScratch((scratch) => {
    const npm = findNpm(stubNpm(scratch).env)!;
    const { denyList, ...investigateOptions } = options;
    const needs: Need[] = ["npm", "network", ...(denyList ? (["denyList"] as const) : [])];
    const context = { ...secretHasher(Buffer.alloc(32)), npm, ...(denyList ? { denyList } : {}) };
    return investigate(
      { name: "repo", files },
      (repo) => runCheck(byId(id), repo, new Set(needs), context),
      investigateOptions,
    ) as Result;
  });
}

const npmProject = {
  "package.json": JSON.stringify({ name: "w", version: "1.0.0", dependencies: { a: "^1.0.0" } }),
  "package-lock.json": JSON.stringify({
    name: "w",
    lockfileVersion: 3,
    packages: { "": { name: "w" }, "node_modules/a": { version: "1.0.0", license: "MIT" } },
  }),
};

describe("the deps checks read only npm, and say so", () => {
  const DEPS = ["deps.advisories", "deps.outdated", "license.deps"];

  it.each(DEPS)("%s is clean with no manifest of any known ecosystem", (id) => {
    expect(check(id, { "README.md": "# w\n" })).toEqual({ verdict: "clean" });
  });

  it.each(DEPS.flatMap((id) => ["requirements.txt", "go.mod", "Cargo.toml"].map((file) => [id, file])))(
    "%s is not investigated on a project with only %s, and names it",
    (id, file) => {
      const ecosystem = otherManifests({ textFiles: [file] })[0]!.ecosystem;
      expect(check(id, { [file]: "x\n" })).toEqual({
        verdict: "not-investigated",
        reason: ecosystemReasons.otherOnly(file, ecosystem),
      });
    },
  );

  it.each(DEPS)("%s checks the npm side, and says the other side was not read", (id) => {
    expect(check(id, { ...npmProject, "tools/pyproject.toml": "[project]\n" })).toEqual({
      verdict: "not-investigated",
      reason: ecosystemReasons.npmCleanOtherUnread("tools/pyproject.toml", "Python"),
    });
  });

  it.each(DEPS)("%s stays clean on an npm project alone", (id) => {
    expect(check(id, npmProject)).toEqual({ verdict: "clean" });
  });

  it("names each manifest's ecosystem from one list", () => {
    expect(otherManifests({ textFiles: ["b/go.mod", "a/Gemfile", "README.md"] })).toEqual([
      { path: "a/Gemfile", ecosystem: "Ruby" },
      { path: "b/go.mod", ecosystem: "Go" },
    ]);
  });
});

describe("names.deny reads the commit messages, or says it did not", () => {
  it("is not investigated outside git when the files are clean: the commit messages were not read", () => {
    expect(check("names.deny", { "a.txt": "nothing\n" }, { denyList: ["Globex"] })).toEqual({
      verdict: "not-investigated",
      reason: denyReasons.messagesUnread,
    });
  });

  it("is clean in a git repository when neither the files nor the messages hold a name", () => {
    expect(check("names.deny", { "a.txt": "nothing\n" }, { denyList: ["Globex"], git: true })).toEqual({
      verdict: "clean",
    });
  });

  it("still finds a name in the files outside git", () => {
    expect(check("names.deny", { "a.txt": "Globex\n" }, { denyList: ["Globex"] }).verdict).toBe("found");
  });
});

describe("a workflow that does not parse is never read as clean", () => {
  const broken = { ".github/workflows/ci.yml": "on: [push\njobs: {\n" };

  it.each(["workflows.permissions", "workflows.prtarget", "workflows.injection"])(
    "%s is not investigated, and names the workflow",
    (id) => {
      expect(check(id, broken)).toEqual({
        verdict: "not-investigated",
        reason: workflowReasons.unreadable(".github/workflows/ci.yml"),
      });
    },
  );

  it("still finds what a readable workflow beside it holds", () => {
    const files = {
      ...broken,
      ".github/workflows/ok.yml":
        "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n",
    };
    expect(check("workflows.permissions", files).verdict).toBe("found");
  });
});
