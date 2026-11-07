import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { headings } from "../../src/engine/checks/docs.readme.js";
import { runsHeadCheckout } from "../../src/engine/checks/workflows.prtarget.js";
import { expressions } from "../../src/engine/checks/workflows.injection.js";
import { workflowReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { matchLine } from "../../src/engine/secrets/scan.js";
import { investigate } from "../helpers/investigate.js";
import { SECRETS } from "../helpers/secrets.js";
import { keyOf, MAX_WORKFLOW_LINE, readWorkflow, readWorkflows } from "../../src/engine/workflows.js";

// The code review's high findings 9a and 9b: a README line, and a run of name characters, took the cube of
// their length. A repository is the investigator's to read, not to stall: each read here is linear, and held to
// a time a stall would blow through. The old patterns took 9 seconds on the 6 KB of 9b, and a minute on 9a.

function timed<T>(body: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = body();
  return { result, ms: performance.now() - start };
}

const run = (id: string, files: Record<string, string>) =>
  investigate({ name: "widget", files }, (repo, capabilities) =>
    runCheck(
      CHECKS.find((c) => c.id === id)!,
      repo,
      capabilities,
      secretHasher(Buffer.alloc(32)),
    ),
  );

describe("reads that stay linear on what a repository writes", () => {
  it("reads a README with a long line of spaces in a heading in well under a second", () => {
    const readme = [`# a${" ".repeat(20_000)}x#`, ...Array.from({ length: 12 }, (_, i) => `line ${i}`)].join(
      "\n",
    );
    const { result, ms } = timed(() => run("docs.readme", { "README.md": `${readme}\n` }));
    expect(result.verdict).toBe("found");
    expect(ms).toBeLessThan(1000);
  });

  it("counts a README's lines past a long run of trailing spaces in well under a second", () => {
    const { ms } = timed(() => run("docs.readme", { "README.md": `# Install\n${" ".repeat(200_000)}x\n` }));
    expect(ms).toBeLessThan(1000);
  });

  it("reads <h1 again and again without a > in well under a second", () => {
    const { ms } = timed(() => headings("<h1".repeat(50_000)));
    expect(ms).toBeLessThan(1000);
  });

  it("scans 100 KB of a name word repeated, with no value, in well under two seconds", () => {
    const { result, ms } = timed(() => matchLine("token".repeat(20_000), "a.txt"));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(2000);
  });

  it("scans it through a whole check too", () => {
    const { ms } = timed(() => run("secrets.tree", { "a.txt": `${"secret".repeat(10_000)}\n` }));
    expect(ms).toBeLessThan(2000);
  });

  it("still finds a guess from a name, its name and value as before", () => {
    const s = SECRETS["assigned-secret"]!;
    expect(matchLine(s.line(s.value), "a.txt").map((m) => [m.rule.id, m.value])).toEqual([
      ["assigned-secret", s.value],
    ]);
    expect(matchLine(`my_service_api_key = "${s.value}"`, "a.txt").map((m) => m.value)).toEqual([s.value]);
  });
});

describe("a heading, read by hand, as the pattern read it", () => {
  it.each([
    ["# Install", "Install"],
    ["## Usage ##", "Usage"],
    ["# foo#", "foo"],
    ["   ### three", "three"],
    ["\t# tab", "tab"],
    ["# a  b  ", "a  b"],
    ["# Install # again #", "Install # again"],
  ])("reads %j as %j", (line, text) => {
    expect(headings(line)).toEqual([text]);
  });

  it.each(["#", "#Title", "    # four", "####### seven"])("reads %j as no heading", (line) => {
    expect(headings(line)).toEqual([]);
  });
});

// The security gate's b1 and b2: four patterns over a workflow's lines took the square of a line's length. The
// old ones, kept here, are what the hand-written reads are held to. A line over MAX_WORKFLOW_LINE is skipped,
// and a check that skipped one reads not investigated, never clean.
const OLD_KEY = (key: string) => new RegExp(`^\\s*-?\\s*${key}:\\s*(.*)$`);
const OLD_EXPRESSION = /\$\{\{([^}]*)\}\}/g;
const OLD_RUN_CHECKOUT =
  /\bgh\s+pr\s+checkout\b|\bgit\s+(?:fetch|checkout|switch)\b.*(?:github\.event\.pull_request\.head|github\.head_ref|refs\/pull\/)/;

const workflow = (steps: string) =>
  `on: pull_request_target\njobs:\n  a:\n    runs-on: x\n    steps:\n${steps}`;

describe("workflow reads that stay linear on what a repository writes", () => {
  it("locates steps past 1 MB of spaces on one line, with many it cannot locate, in well under a second", () => {
    const flow = Array.from({ length: 2000 }, (_, i) => `      - {run: echo ${i}}`).join("\n");
    const text = workflow(`${flow}\n${" ".repeat(1_000_000)}\n      - run: echo last\n`);
    const { result, ms } = timed(() => readWorkflow(".github/workflows/x.yml", text));
    expect(result.steps).toHaveLength(2001);
    expect(result.steps.at(-1)!.line).toBe(text.split("\n").indexOf("      - run: echo last") + 1);
    expect(ms).toBeLessThan(1000);
  });

  it("reads 900 KB of ${{ with no }} in well under a second", () => {
    const { result, ms } = timed(() => expressions("${{".repeat(300_000)));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(1000);
  });

  it("reads 1 MB of git fetch in well under a second", () => {
    const { result, ms } = timed(() => runsHeadCheckout("git fetch ".repeat(100_000)));
    expect(result).toBe(false);
    expect(ms).toBeLessThan(1000);
  });

  it("reads a line just under the cap of pages[ in a stranger's field in well under a second", () => {
    const line = `echo \${{ ${"github.event.pages[".repeat(3_400)} }}`;
    expect(line.length).toBeLessThan(MAX_WORKFLOW_LINE);
    const { result, ms } = timed(() =>
      run("workflows.injection", {
        ".github/workflows/x.yml": workflow(`      - run: ${JSON.stringify(line)}\n`),
      }),
    );
    expect(result.verdict).toBe("clean");
    expect(ms).toBeLessThan(1000);
  });

  it("says it skipped a line over the cap, rather than reading clean", () => {
    const long = "${{".repeat(30_000);
    const files = { ".github/workflows/x.yml": workflow(`      - run: |\n          ${long}\n`) };
    const reason = workflowReasons.longLine(".github/workflows/x.yml", 7);
    expect(reason).toContain(MAX_WORKFLOW_LINE.toLocaleString("en-US"));
    expect(run("workflows.injection", files)).toEqual({ verdict: "not-investigated", reason });

    const fetches = "git fetch ".repeat(7_000);
    const checkout = { ".github/workflows/x.yml": workflow(`      - run: |\n          ${fetches}\n`) };
    expect(run("workflows.prtarget", checkout)).toEqual({ verdict: "not-investigated", reason });
  });

  it("still finds what is past a long line", () => {
    const files = {
      ".github/workflows/x.yml": workflow(
        `      - run: |\n          ${"x".repeat(70_000)}\n          echo "\${{ github.event.issue.title }}"\n`,
      ),
    };
    expect(run("workflows.injection", files).verdict).toBe("found");
  });

  it("parses each run's workflows once", () => {
    const same = investigate(
      { name: "widget", files: { ".github/workflows/x.yml": workflow("      - run: echo hi\n") } },
      (repo) => readWorkflows(repo) === readWorkflows(repo),
    );
    expect(same).toBe(true);
  });
});

describe("the hand-written workflow reads, as the patterns read them", () => {
  it.each([
    "run: echo hi",
    "  - run: echo hi",
    "\t-\trun:x",
    "      - uses: actions/checkout@v4",
    "-run: a",
    "  -   uses:   a b  ",
    "runs: x",
    "  # run: x",
    "  - - run: x",
    "  - {run: x}",
    "  name: run: x",
    "\u00a0- run: x",
    "",
  ])("reads the key of %j as the pattern did", (line) => {
    const expected = ["run", "uses"]
      .map((key) => ({ key, match: OLD_KEY(key).exec(line) }))
      .find(({ match }) => match !== null);
    const keyed = keyOf(line);
    expect(keyed && { key: keyed.key, rest: keyed.rest.trim() }).toEqual(
      expected && { key: expected.key, rest: expected.match![1]!.trim() },
    );
  });

  it.each([
    "echo ${{ a }}",
    "${{ a }} ${{ b }}",
    "${{ a } b }}",
    "${{ a }}}",
    "${{${{ a }}",
    "${{ a",
    "}} ${{ a }}",
    "${{}}",
    "$ {{ a }}",
    "${{ a }} } ${{ b } }} ${{ c }}",
  ])("reads the expressions of %j as the pattern did", (line) => {
    expect(expressions(line)).toEqual([...line.matchAll(OLD_EXPRESSION)].map((m) => m[1]!));
  });

  it.each([
    "gh pr checkout 1",
    "git fetch origin refs/pull/1/head",
    "git checkout ${{ github.event.pull_request.head.sha }}",
    "git switch ${{ github.head_ref }}",
    "echo refs/pull/1 && git fetch origin",
    "git fetch origin && git checkout ${{ github.head_ref }}",
    "git fetching refs/pull/1",
    "legit fetch refs/pull/1",
    "git  checkout   x",
    "ghpr checkout",
  ])("reads whether %j checks out the head as the pattern did", (line) => {
    expect(runsHeadCheckout(line)).toBe(OLD_RUN_CHECKOUT.test(line));
  });
});
