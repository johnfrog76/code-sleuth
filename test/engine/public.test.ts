import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { identifyLicense, isStrongCopyleft } from "../../src/engine/licenses.js";
import { readWorkflow } from "../../src/engine/workflows.js";
import { investigate } from "../helpers/investigate.js";

const context = secretHasher(Buffer.alloc(32));

function check(id: string, files: Record<string, string>): Result {
  const found = CHECKS.find((c) => c.id === id)!;
  return investigate({ name: "repo", files }, (repo, capabilities) =>
    runCheck(found, repo, capabilities, context),
  );
}

const rules = (result: Result) =>
  result.verdict === "found" ? result.evidence.map((e) => e.rule) : result.verdict;

const LICENSES = {
  MIT: "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software ...",
  Apache: "Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/",
  GPL3: "GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n",
  LGPL3: "GNU LESSER GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n... the GNU General Public License ...",
  AGPL3: "GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 19 November 2007\n",
};
const pkg = (fields: Record<string, unknown>) =>
  JSON.stringify({ name: "widget", version: "1.0.0", ...fields }, null, 2);

describe("license.file", () => {
  it.each([
    ["no license", { "README.md": "x" }, ["found"]],
    ["a license file", { LICENSE: LICENSES.MIT }, "clean"],
    ["LICENCE.txt", { "LICENCE.txt": LICENSES.MIT }, "clean"],
    ["COPYING", { COPYING: LICENSES.GPL3 }, "clean"],
    ["only a nested license", { "docs/LICENSE": LICENSES.MIT }, ["found"]],
    ["a manifest that agrees", { LICENSE: LICENSES.MIT, "package.json": pkg({ license: "MIT" }) }, "clean"],
    [
      "an expression with the file's license",
      { LICENSE: LICENSES.Apache, "package.json": pkg({ license: "(MIT OR Apache-2.0)" }) },
      "clean",
    ],
    [
      "-or-later against the file",
      { LICENSE: LICENSES.GPL3, "package.json": pkg({ license: "GPL-3.0-or-later" }) },
      "clean",
    ],
    [
      "a file it cannot identify",
      { LICENSE: "All rights reserved.", "package.json": pkg({ license: "MIT" }) },
      "clean",
    ],
    [
      "SEE LICENSE IN",
      { LICENSE: LICENSES.MIT, "package.json": pkg({ license: "SEE LICENSE IN LICENSE" }) },
      "clean",
    ],
  ])("%s", (_, files, expected) => {
    const result = check("license.file", files);
    if (expected === "clean") expect(result.verdict).toBe("clean");
    else expect(result).toEqual({ verdict: "found", evidence: [] });
  });

  it("finds a manifest that disagrees with the file, and names both", () => {
    const result = check("license.file", {
      LICENSE: LICENSES.Apache,
      "package.json": pkg({ license: "MIT" }),
    });
    expect(result).toEqual({
      verdict: "found",
      evidence: [
        { path: "package.json", line: 4, excerpt: '"license": "MIT"', rule: "manifest-disagrees" },
        { path: "LICENSE", excerpt: "Apache License, Version 2.0", rule: "reads-as-Apache-2.0" },
      ],
    });
  });

  it.each([
    [LICENSES.MIT, "MIT"],
    [LICENSES.Apache, "Apache-2.0"],
    [LICENSES.GPL3, "GPL-3.0"],
    [LICENSES.LGPL3, "LGPL-3.0"],
    [LICENSES.AGPL3, "AGPL-3.0"],
    ["Redistribution and use in source and binary forms ... Neither the name of", "BSD-3-Clause"],
    ["Redistribution  and use in\nsource and binary forms", "BSD-2-Clause"],
  ])("identifies %j as %s", (text, id) => expect(identifyLicense(text)?.id).toBe(id));
});

describe("license.deps", () => {
  const lock = (packages: Record<string, unknown>, version = 3) =>
    JSON.stringify(
      { name: "widget", lockfileVersion: version, packages: { "": { name: "widget" }, ...packages } },
      null,
      2,
    );

  it.each([
    ["no dependencies at all", { "README.md": "x" }, "clean"],
    [
      "permissive dependencies",
      { "package.json": pkg({}), "package-lock.json": lock({ "node_modules/a": { license: "MIT" } }) },
      "clean",
    ],
    [
      "a copyleft dependency only for development",
      {
        "package.json": pkg({}),
        "package-lock.json": lock({ "node_modules/a": { license: "GPL-3.0", dev: true } }),
      },
      "clean",
    ],
    [
      "a dual license with a way out",
      {
        "package.json": pkg({}),
        "package-lock.json": lock({ "node_modules/a": { license: "(MIT OR GPL-3.0)" } }),
      },
      "clean",
    ],
    [
      "the lesser GPL",
      { "package.json": pkg({}), "package-lock.json": lock({ "node_modules/a": { license: "LGPL-3.0" } }) },
      "clean",
    ],
    [
      "a project that is itself GPL",
      {
        "package.json": pkg({ license: "GPL-3.0" }),
        "package-lock.json": lock({ "node_modules/a": { license: "GPL-3.0" } }),
      },
      "clean",
    ],
    [
      "a linked local package",
      {
        "package.json": pkg({}),
        "package-lock.json": lock({ "node_modules/a": { link: true, resolved: "packages/a" } }),
      },
      "clean",
    ],
  ])("is clean with %s", (_, files, verdict) => expect(check("license.deps", files).verdict).toBe(verdict));

  it("finds a strong copyleft dependency and one with no license, with their lines", () => {
    const result = check("license.deps", {
      "package.json": pkg({}),
      "package-lock.json": lock({
        "node_modules/a": { license: "AGPL-3.0-only" },
        "node_modules/b": { version: "1.0.0" },
        "node_modules/a/node_modules/c": { license: "SSPL-1.0" },
      }),
    });
    if (result.verdict !== "found") throw new Error("expected found");
    expect(result.evidence.map((e) => [e.excerpt, e.rule, typeof e.line])).toEqual([
      ["a: AGPL-3.0-only", "strong-copyleft", "number"],
      ["b", "no-license-stated", "number"],
      ["c: SSPL-1.0", "strong-copyleft", "number"],
    ]);
  });

  it.each([
    ["a package.json with no lockfile", { "package.json": pkg({}) }, /no package-lock\.json/],
    ["another ecosystem", { "requirements.txt": "requests\n" }, /requirements\.txt/],
    [
      "an old lockfile",
      {
        "package.json": pkg({}),
        "package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: {} }),
      },
      /npm 7 or later/,
    ],
    ["a lockfile that is not JSON", { "package.json": pkg({}), "package-lock.json": "{" }, /not JSON/],
  ])("is not investigated with %s, and says why", (_, files, reason) => {
    const result = check("license.deps", files);
    expect(result.verdict).toBe("not-investigated");
    if (result.verdict === "not-investigated") expect(result.reason).toMatch(reason);
  });

  it.each([
    ["GPL-3.0", true],
    ["GPL-2.0+", true],
    ["(MIT OR GPL-3.0)", false],
    ["MIT AND GPL-3.0", true],
    ["GPL-2.0 WITH Classpath-exception-2.0", true],
    ["LGPL-2.1-or-later", false],
    ["MIT", false],
  ])("reads %s as strong copyleft: %s", (expression, expected) =>
    expect(isStrongCopyleft(expression)).toBe(expected),
  );
});

describe("docs.readme", () => {
  const long = (heading: string) => `# Widget\n\nWhat it is.\n\n${heading}\n\n${"More words.\n".repeat(8)}`;

  it.each([
    ["no README", { "a.txt": "x" }, ["found"]],
    ["a short one", { "README.md": "# Widget\n\n## Install\n" }, ["under-10-lines"]],
    ["an empty one", { "README.md": "" }, ["under-10-lines"]],
    ["no heading that says how to start", { "README.md": long("## About") }, ["no-start-heading"]],
    ["## Install", { "README.md": long("## Install") }, "clean"],
    ["## Quick start", { "README.md": long("## Quick start") }, "clean"],
    ["a setext Getting started", { "README.md": long("Getting started\n---------------") }, "clean"],
    ["an HTML Usage heading", { "README.md": long("<h2 align=center>Usage</h2>") }, "clean"],
    ["a README.rst", { "README.rst": long("Installation\n============") }, "clean"],
    ["a lowercase readme.md", { "readme.md": long("## Setup") }, "clean"],
  ])("%s", (_, files, expected) => {
    const result = check("docs.readme", files);
    expect(result.verdict === "found" && result.evidence.length === 0 ? ["found"] : rules(result)).toEqual(
      expected,
    );
  });
});

describe.each([
  ["docs.contributing", "CONTRIBUTING.md"],
  ["docs.security", "SECURITY.md"],
])("%s", (id, name) => {
  it.each(["", ".github/", "docs/"])(`is clean with ${name} in %j`, (folder) =>
    expect(check(id, { [`${folder}${name}`]: "x" }).verdict).toBe("clean"),
  );

  it("is found with none, or one somewhere GitHub does not look", () => {
    expect(check(id, { "a.txt": "x" })).toEqual({ verdict: "found", evidence: [] });
    expect(check(id, { [`notes/${name}`]: "x" }).verdict).toBe("found");
  });
});

describe("github.templates", () => {
  it.each([
    [{ ".github/ISSUE_TEMPLATE/bug.md": "x", ".github/pull_request_template.md": "x" }, "clean"],
    [{ ".github/ISSUE_TEMPLATE.md": "x", ".github/PULL_REQUEST_TEMPLATE.md": "x" }, "clean"],
    [{ ".github/ISSUE_TEMPLATE/config.yml": "x", "docs/pull_request_template.md": "x" }, "clean"],
    [{ ".github/ISSUE_TEMPLATE/bug.yml": "x", ".github/PULL_REQUEST_TEMPLATE/feature.md": "x" }, "clean"],
    [{ "pull_request_template.md": "x", ".github/ISSUE_TEMPLATE/a.md": "x" }, "clean"],
    [{ ".github/ISSUE_TEMPLATE/bug.md": "x" }, ["no-pull-request-template"]],
    [{ ".github/pull_request_template.md": "x" }, ["no-issue-template"]],
    [{ "a.txt": "x" }, ["no-issue-template", "no-pull-request-template"]],
  ])("reads %j as %j", (files, expected) =>
    expect(rules(check("github.templates", files))).toEqual(expected),
  );
});

describe("ci.present", () => {
  const wf = (on: string) => ({ ".github/workflows/ci.yml": `name: CI\n${on}\njobs: {}\n` });

  it.each([
    ["on: push", "clean"],
    ["on: [push, pull_request]", "clean"],
    ["on:\n  pull_request:\n    branches: [main]", "clean"],
    ["on:\n  - pull_request", "clean"],
    ['"on": push', "clean"],
    ["on: schedule", ["no-push-or-pull-request"]],
    ["on:\n  workflow_dispatch:", ["no-push-or-pull-request"]],
    ["on: [push", ["not-yaml"]],
  ])("%j", (on, expected) => expect(rules(check("ci.present", wf(on)))).toEqual(expected));

  it("is found with no workflows, and does not read a workflow outside .github/workflows/", () => {
    expect(check("ci.present", { "a.txt": "x" })).toEqual({ verdict: "found", evidence: [] });
    expect(check("ci.present", { ".github/workflows/old/ci.yml": "on: push\n" }).verdict).toBe("found");
    expect(check("ci.present", { ".github/workflows/ci.yaml": "on: push\n" }).verdict).toBe("clean");
  });
});

describe("ci.tests", () => {
  const wf = (steps: string) => `on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`;

  it.each([
    ["npm test", "      - run: npm test\n", {}, "clean"],
    ["npm run test:unit", "      - run: npm run test:unit\n", {}, "clean"],
    [
      "pytest in a block",
      "      - name: Test\n        run: |\n          pip install .\n          pytest -q\n",
      {},
      "clean",
    ],
    ["the test script itself", "      - run: npx vitest run\n", { test: "vitest run" }, "clean"],
    ["only a build", "      - run: npm run build\n", {}, ["no-test-step"]],
    [
      "npm's placeholder script",
      "      - run: echo no test specified\n",
      { test: 'echo "Error: no test specified" && exit 1' },
      ["no-test-step"],
    ],
  ])("%s", (_, steps, scripts, expected) => {
    const files = { ".github/workflows/ci.yml": wf(steps), "package.json": pkg({ scripts }) };
    expect(rules(check("ci.tests", files))).toEqual(expected);
  });

  it("is found with no workflows at all", () => {
    expect(check("ci.tests", { "a.txt": "x" })).toEqual({ verdict: "found", evidence: [] });
  });
});

describe("the workflow reader", () => {
  it("finds the line each run starts on, in file order, repeated runs included", () => {
    const text =
      "on: push\njobs:\n  a:\n    steps:\n      - run: npm test\n  b:\n    steps:\n      - run: npm test\n      - run: |\n          echo hi\n";
    expect(readWorkflow("ci.yml", text).runs).toEqual([
      { line: 5, text: "npm test" },
      { line: 8, text: "npm test" },
      { line: 9, text: "echo hi\n" },
    ]);
  });

  it("reads custom tags as plain values, never as code", () => {
    const warn = vi.spyOn(process, "emitWarning");
    const wf = readWorkflow("ci.yml", "on: !!js/function 'function(){}'\njobs: {}\n");
    expect(wf.events.every((e) => typeof e === "string")).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
