import { describe, expect, it } from "vitest";
import type { Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { denyPatterns } from "../../src/engine/checks/names.deny.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { type BuiltFixture, investigate, type InvestigateOptions } from "../helpers/investigate.js";

function check(
  id: string,
  files: BuiltFixture["files"],
  options: InvestigateOptions & { denyList?: string[] } = {},
): Result {
  const found = CHECKS.find((c) => c.id === id)!;
  const { denyList, ...investigateOptions } = options;
  const context = { ...secretHasher(Buffer.alloc(32)), ...(denyList ? { denyList } : {}) };
  return investigate(
    { name: "repo", files },
    (repo, capabilities) => {
      const can = denyList ? new Set([...capabilities, "denyList" as const]) : capabilities;
      return runCheck(found, repo, can, context);
    },
    investigateOptions,
  );
}

const evidence = (result: Result) => {
  if (result.verdict !== "found") throw new Error(`expected found, got ${result.verdict}`);
  return result.evidence;
};

// Home folders are built from pieces, so this file holds no path from anybody's machine.
const mac = ["/Us", "ers/"].join("");
const linux = ["/ho", "me/"].join("");
const windows = ["C:\\", "Users\\"].join("");

describe("paths.machine", () => {
  it.each([
    [`cp out ${mac}alice/backup/`],
    [`cd ${linux}bob.smith/src/`],
    [`"path": "${windows}carol\\\\AppData\\\\"`],
    [`${["D:/Us", "ers/"].join("")}dave/notes/`],
    // The same shapes, with a real name in them, are still found.
    [`'${windows}erin\\AppData\\Roaming\\npm\\python.bat'`],
    [`${windows}a.b\\AppData\\`],
  ])("finds %s", (line) => {
    expect(evidence(check("paths.machine", { "build.sh": `#!/bin/sh\n${line}\n` }))).toEqual([
      { path: "build.sh", line: 2, excerpt: line },
    ]);
  });

  it.each([
    [`${mac}<name>/`],
    [`${mac}Shared/`],
    [`${linux}runner/work/`],
    [`${linux}linuxbrew/.linuxbrew/bin`],
    [`#   ${windows}...\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe`],
    [`'${windows}runneradmin\\AppData\\Roaming\\npm\\python.bat'`],
    [`${mac}.../Library/`],
    [`$HOME/projects/`],
    [`~/Library/`],
  ])("lets %s through", (line) =>
    expect(check("paths.machine", { "a.sh": `${line}\n` }).verdict).toBe("clean"),
  );

  it("marks a line that carries the example marker", () => {
    expect(
      evidence(check("paths.machine", { "a.sh": `${mac}alice/x/ # code-sleuth:example\n` }))[0]!.marked,
    ).toBe(true);
  });
});

describe("names.deny", () => {
  it("is not investigated with no list, and names --deny", () => {
    const result = check("names.deny", { "a.txt": "Globex\n" });
    expect(result.verdict).toBe("not-investigated");
    if (result.verdict === "not-investigated") expect(result.reason).toContain("--deny");
  });

  it("finds a match in a file, whole-word and ignoring case, and never shows the word", () => {
    const result = check(
      "names.deny",
      { "src/a.ts": "// for GLOBEX only\n", "src/b.ts": "const globexample = 1;\n" },
      { denyList: ["# private", "", "Globex"] },
    );
    expect(evidence(result)).toEqual([{ path: "src/a.ts", line: 1, rule: "deny-list-line-3" }]);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("globex");
  });

  it("finds a match in a commit message", () => {
    const result = check(
      "names.deny",
      { "a.txt": "nothing here\n" },
      {
        git: true,
        denyList: ["Initech"],
        commits: [{ message: "Fix it\n\nAsked for by Initech.", files: { "b.txt": "x\n" } }],
      },
    );
    const [piece, ...rest] = evidence(result);
    expect(rest).toEqual([]);
    expect(piece).toMatchObject({ path: "commit message", line: 3, rule: "deny-list-line-1" });
    expect(piece!.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is clean when nothing on the list is there", () => {
    expect(check("names.deny", { "a.txt": "widget\n" }, { git: true, denyList: ["Globex"] }).verdict).toBe(
      "clean",
    );
  });

  it("matches entries with punctuation literally, and words in any script", () => {
    const [dotted, accented] = denyPatterns(["acme.corp", "Zoë"]);
    expect(dotted!.pattern.test("acme.corp")).toBe(true);
    expect(dotted!.pattern.test("acmeXcorp")).toBe(false);
    expect(accented!.pattern.test("ask zoë")).toBe(true);
    expect(accented!.pattern.test("zoëy")).toBe(false);
  });
});

describe("files.large", () => {
  const big = (mb: number, text = false) =>
    text ? "a".repeat(mb * 1024 * 1024) : `\0${"b".repeat(mb * 1024 * 1024)}`;

  it.each([
    ["a text file over 5 MB", "data.csv", big(6, true), ["over-5-mb", "6.0 MB"]],
    ["a binary over 1 MB", "tool.bin", big(2), ["binary-over-1-mb", "2.0 MB"]],
  ])("finds %s", (_, path, content, [rule, size]) => {
    expect(evidence(check("files.large", { [path]: content }))).toEqual([{ path, excerpt: size, rule }]);
  });

  it.each([
    ["an image over 1 MB", "hero.png", big(2)],
    ["a font over 1 MB", "brand.woff2", big(2)],
    ["a text file of 2 MB", "notes.txt", big(2, true)],
  ])("lets %s through", (_, path, content) =>
    expect(check("files.large", { [path]: content }).verdict).toBe("clean"),
  );

  it("still finds an image over 5 MB", () => {
    expect(evidence(check("files.large", { "huge.png": big(6) }))[0]!.rule).toBe("over-5-mb");
  });
});

describe("workflows.permissions", () => {
  it("finds a workflow with no top-level permissions, and lets one with them through", () => {
    const result = check("workflows.permissions", {
      ".github/workflows/a.yml": "on: push\njobs: {}\n",
      ".github/workflows/b.yml": "on: push\npermissions:\n  contents: read\njobs: {}\n",
      ".github/workflows/c.yml": "on: push\npermissions: read-all\njobs: {}\n",
    });
    expect(evidence(result)).toEqual([{ path: ".github/workflows/a.yml", rule: "no-top-level-permissions" }]);
  });
});

describe("workflows.prtarget", () => {
  const wf = (on: string, steps: string) => ({
    ".github/workflows/t.yml": `on: ${on}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`,
  });
  const headCheckout =
    "      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n";

  it("finds a checkout of the pull request's head under pull_request_target", () => {
    expect(evidence(check("workflows.prtarget", wf("pull_request_target", headCheckout)))).toEqual([
      { path: ".github/workflows/t.yml", line: 6, excerpt: "ref: ${{ github.event.pull_request.head.sha }}" },
    ]);
  });

  it.each([
    ["the same checkout under pull_request", wf("pull_request", headCheckout)],
    [
      "pull_request_target with the base checked out",
      wf("pull_request_target", "      - uses: actions/checkout@v4\n"),
    ],
    ["pull_request_target that only labels", wf("[pull_request_target]", "      - run: echo labelled\n")],
  ])("lets %s through", (_, files) => expect(check("workflows.prtarget", files).verdict).toBe("clean"));

  it("finds gh pr checkout in a run step", () => {
    const result = check(
      "workflows.prtarget",
      wf("pull_request_target", "      - run: gh pr checkout ${{ github.event.number }}\n"),
    );
    expect(evidence(result)[0]!.excerpt).toBe("gh pr checkout ${{ github.event.number }}");
  });
});

describe("workflows.injection", () => {
  const wf = (run: string) => ({
    ".github/workflows/t.yml": `on: issues\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo start\n          ${run}\n`,
  });

  it.each([
    'echo "${{ github.event.issue.title }}"',
    "git checkout ${{ github.head_ref }}",
    "echo ${{ github.event.pull_request.head.ref }}",
    "echo '${{ github.event.comment.body }}'",
    "echo ${{ github.event.commits[0].message }}",
    "echo ${{github.event.head_commit.author.email}}",
  ])("finds %s, on its own line", (run) => {
    expect(evidence(check("workflows.injection", wf(run)))).toEqual([
      { path: ".github/workflows/t.yml", line: 8, excerpt: run },
    ]);
  });

  it.each([
    "echo ${{ github.event.issue.number }}",
    "echo ${{ github.sha }}",
    'echo "$TITLE"',
    "echo ${{ github.event.pull_request.head.sha }}",
  ])("lets %s through", (run) => expect(check("workflows.injection", wf(run)).verdict).toBe("clean"));
});

describe("deps.lockfile", () => {
  const pkg = (deps: Record<string, string>) => JSON.stringify({ name: "w", dependencies: deps });

  it.each([["package-lock.json"], ["yarn.lock"], ["pnpm-lock.yaml"], ["bun.lock"]])(
    "is clean with a %s beside it",
    (lock) => {
      expect(check("deps.lockfile", { "package.json": pkg({ a: "1" }), [lock]: "x" }).verdict).toBe("clean");
    },
  );

  it("finds a package.json with dependencies and no lockfile", () => {
    expect(evidence(check("deps.lockfile", { "package.json": pkg({ a: "1" }) }))).toEqual([
      { path: "package.json", rule: "no-lockfile" },
    ]);
  });

  it("reads a workspace member's lockfile from its root", () => {
    expect(
      check("deps.lockfile", {
        "package-lock.json": "{}",
        "package.json": pkg({}),
        "packages/a/package.json": pkg({ b: "1" }),
      }).verdict,
    ).toBe("clean");
  });

  it("does not ask for a lockfile where there are no dependencies", () => {
    expect(check("deps.lockfile", { "package.json": pkg({}) }).verdict).toBe("clean");
  });
});

describe("deps.updates", () => {
  it.each([
    ".github/dependabot.yml",
    ".github/dependabot.yaml",
    "renovate.json",
    ".renovaterc",
    ".github/renovate.json5",
  ])("is clean with %s", (path) => expect(check("deps.updates", { [path]: "{}" }).verdict).toBe("clean"));

  it("is clean with a renovate key in package.json, and found with nothing", () => {
    expect(check("deps.updates", { "package.json": JSON.stringify({ renovate: {} }) }).verdict).toBe("clean");
    expect(check("deps.updates", { "a.txt": "x" })).toEqual({ verdict: "found", evidence: [] });
  });
});

describe("deps.advisories", () => {
  it("reads clean with no dependencies, and makes no call: there is nothing to look up (#12)", () => {
    const result = check("deps.advisories", { "package.json": "{}", "package-lock.json": "{}" });
    expect(result.verdict).toBe("clean");
  });
});

describe("quality.markers", () => {
  const mark = ["TO", "DO"].join("");
  const fix = ["FIX", "ME"].join("");

  it("finds markers in comments, counts them, and names each", () => {
    const result = check("quality.markers", {
      "src/a.ts": `// ${mark}: tidy\nconst x = 1; /* ${fix} later */\n`,
      "src/b.py": `# ${mark} remove\n`,
    });
    expect(evidence(result).map((e) => [e.path, e.line, e.rule])).toEqual([
      ["src/a.ts", 1, mark],
      ["src/a.ts", 2, fix],
      ["src/b.py", 1, mark],
    ]);
  });

  it.each([
    ["a marker that is not in a comment", "src/a.ts", `const label = "${mark}";\n`],
    ["a marker in prose", "docs/plan.md", `# ${mark}\n`],
    [
      "a marker inside a JSON string",
      "test/fixtures/titles.json",
      `{ "lines": ["## Notes", "", "# ${mark}: move the clothes rack"] }\n`,
    ],
    [
      "a marker in a JSON value, after //",
      "config/settings.json",
      `{ "url": "https://example.com// ${mark}" }\n`,
    ],
    ["a // inside a JSONC string", "tsconfig.json", `{ "note": "see // ${mark} in the docs" }\n`],
    [
      "a block comment opener inside a string",
      "tsconfig.json",
      `{ "glob": "src/**/*.ts", "x": "${mark}" }\n`,
    ],
    ["an escaped quote that does not end a string", "a.json", `{ "q": "say \\"hi\\" // ${mark}" }\n`],
    ["a lowercase word", "src/a.ts", `// ${mark.toLowerCase()} is a word\n`],
    ["part of a longer word", "src/a.ts", `// ${mark}S\n`],
  ])("lets %s through", (_, path, text) =>
    expect(check("quality.markers", { [path]: text }).verdict).toBe("clean"),
  );

  it("still finds a marker in a real comment in a file that allows them", () => {
    for (const [path, text] of [
      // JSONC by convention, named .json.
      ["tsconfig.json", `{\n  // ${mark}: turn on strict\n  "compilerOptions": {}\n}\n`],
      [".vscode/settings.json", `{\n  /* ${fix}: the formatter */\n  "editor.tabSize": 2\n}\n`],
      ["devcontainer.json", `{\n  "name": "dev", // ${mark} pin the image\n}\n`],
      ["jsconfig.json", `{\n  /*\n   * ${mark}: paths\n   */\n  "include": []\n}\n`],
      ["tsconfig.jsonc", `{\n  // ${mark}: tighten this\n  "strict": true\n}\n`],
      ["config.json5", `{\n  // ${fix}: the port\n  port: 8080,\n}\n`],
      ["src/a.ts", `// ${mark}: tidy\n`],
      ["src/b.py", `# ${mark} remove\n`],
    ] as const) {
      expect(evidence(check("quality.markers", { [path]: text })).map((e) => e.path)).toEqual([path]);
    }
  });

  it("keeps every marker in the case, though a card shows 20", () => {
    const many = Array.from({ length: 30 }, (_, i) => `// ${mark} ${i}`).join("\n");
    expect(evidence(check("quality.markers", { "src/a.ts": many }))).toHaveLength(30);
  });
});
