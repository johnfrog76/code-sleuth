import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Evidence, Result } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher, splitExamples } from "../../src/engine/engine.js";
import { EXAMPLE_MARKER, exampleLocations } from "../../src/engine/examples.js";
import { withoutComment } from "../../src/engine/workflows.js";
import { type BuiltFixture, investigate, type InvestigateOptions } from "../helpers/investigate.js";

// #34: a line carrying the example marker is an example for every check, set in one place as a result leaves its
// check, so no check has to remember. Each row is a line a check records, marked: its match is an example (shown,
// never counted), and the check reads clean.

function check(
  id: string,
  files: BuiltFixture["files"],
  options: InvestigateOptions & { denyList?: string[] } = {},
): { result: Result; examples: Evidence[] } {
  const found = CHECKS.find((c) => c.id === id)!;
  const { denyList, ...investigateOptions } = options;
  const context = { ...secretHasher(Buffer.alloc(32)), ...(denyList ? { denyList } : {}) };
  return investigate(
    { name: "repo", files },
    (repo, capabilities) => {
      const can = denyList ? new Set([...capabilities, "denyList" as const]) : capabilities;
      return splitExamples(runCheck(found, repo, can, context), exampleLocations());
    },
    investigateOptions,
  );
}

// Bait is built from pieces, so this file holds none of its own.
const mac = ["/Us", "ers/"].join("");
const note = ["TO", "DO"].join("");
const token = ["gh", "p_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"].join("");
const npmToken = ["_auth", "Token=", "abcdef", "0123456789"].join("");
const mark = `# ${EXAMPLE_MARKER}`;
const wf = (on: string, steps: string) => ({
  ".github/workflows/t.yml": `on: ${on}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`,
});

const rows: [string, BuiltFixture["files"], (InvestigateOptions & { denyList?: string[] })?][] = [
  ["secrets.tree", { "src/a.sh": `export GITHUB_TOKEN=${token} ${mark}\n` }],
  ["paths.machine", { "src/a.sh": `cp out ${mac}alice/backup/ ${mark}\n` }],
  ["quality.markers", { "src/a.sh": `# ${note}: later, ${EXAMPLE_MARKER}\n` }],
  ["files.sensitive", { ".npmrc": `//registry.example.invalid/:${npmToken} ${mark}\n` }],
  ["names.deny", { "src/a.ts": `// Initech ${EXAMPLE_MARKER}\n` }, { denyList: ["Initech"] }],
  ["workflows.injection", wf("issues", `      - run: echo "\${{ github.event.issue.title }}" ${mark}\n`)],
  [
    "workflows.prtarget",
    // Its finding names the step's first line, so that is the line the marker goes on.
    wf(
      "pull_request_target",
      `      - uses: actions/checkout@v4 ${mark}\n        with:\n          ref: \${{ github.event.pull_request.head.sha }}\n`,
    ),
  ],
];

describe("a line carrying the example marker", () => {
  it.each(rows)("is an example for %s: shown, never counted", (id, files, options) => {
    const { result, examples } = check(id, files, options);
    expect(result.verdict, JSON.stringify(result)).toBe("clean");
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.every((piece) => piece.marked === true)).toBe(true);
  });

  it("is an example in a commit message too, for names.deny", () => {
    const { result, examples } = check(
      "names.deny",
      { "a.txt": "nothing here\n" },
      {
        git: true,
        denyList: ["Initech"],
        commits: [
          { message: `Fix it\n\nAsked for by Initech. ${EXAMPLE_MARKER}`, files: { "b.txt": "x\n" } },
        ],
      },
    );
    expect(result.verdict).toBe("clean");
    expect(examples).toMatchObject([{ path: "commit message", line: 3, marked: true }]);
  });

  it("counts only on its own line: the same match on an unmarked line still counts", () => {
    const { result } = check("paths.machine", {
      "src/a.sh": `cp out ${mac}alice/backup/ ${mark}\ncp out ${mac}bob/backup/\n`,
    });
    expect(result).toMatchObject({ verdict: "found", evidence: [{ path: "src/a.sh", line: 2 }] });
  });

  it("covers every check that records a line: each one has a row here", () => {
    // A check that records a file's line names one in its evidence; this list is every such check today. A new
    // one gets a row above, or this fails.
    expect(rows.map(([id]) => id).sort()).toEqual(
      [
        "files.sensitive",
        "names.deny",
        "paths.machine",
        "quality.markers",
        "secrets.tree",
        "workflows.injection",
        "workflows.prtarget",
      ].sort(),
    );
  });
});

describe("a one-line run: with a trailing comment", () => {
  it("is found on its own line, not line 0: the comment is not part of the value YAML reads", () => {
    const { result } = check(
      "workflows.injection",
      wf("issues", `      - run: echo "\${{ github.event.issue.title }}" # a note\n`),
    );
    expect(result).toMatchObject({ verdict: "found", evidence: [{ line: 6 }] });
  });

  it.each([
    ["echo hi # note", "echo hi"],
    ["echo a#b", "echo a#b"],
    ['"echo # kept" # note', '"echo # kept"'],
    ["'echo x'", "'echo x'"],
    ["# all comment", "# all comment"],
  ])("reads %j as %j", (value, expected) => {
    expect(withoutComment(value)).toBe(expected);
  });
});

describe("the one place", () => {
  it("is the engine: no check file sets marked itself", () => {
    const folder = join(import.meta.dirname, "../../src/engine/checks");
    const setters = readdirSync(folder)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => /\bmarked\b|isMarked/.test(readFileSync(join(folder, name), "utf8")));
    expect(setters).toEqual([]);
  });
});
