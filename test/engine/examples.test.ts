import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Result } from "../../src/engine/check.js";
import { splitExamples } from "../../src/engine/engine.js";
import { BUILT_IN_EXAMPLE_GLOBS, exampleLocations, isExampleEvidence } from "../../src/engine/examples.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

const builtIn = exampleLocations();

describe("the example locations", () => {
  it.each([
    ["test/fixtures/a.sh", true],
    ["packages/app/test/fixtures/deep/b.ts", true],
    ["__fixtures__/c.json", true],
    ["src/__fixtures__/d.ts", true],
    ["test/fixturesX/e.ts", false],
    ["fixtures/f.ts", false],
    ["src/test.ts", false],
  ])("reads %s as an example: %s", (path, expected) => {
    expect(isExampleEvidence({ path }, builtIn)).toBe(expected);
  });

  it("reads a marked line as an example wherever it is", () => {
    expect(isExampleEvidence({ path: "src/a.ts", marked: true }, builtIn)).toBe(true);
  });

  it("adds each --examples glob after the built-in ones", () => {
    const widened = exampleLocations(["spec/data/**", "**/*.sample"]);
    expect(widened.globs).toEqual([...BUILT_IN_EXAMPLE_GLOBS, "spec/data/**", "**/*.sample"]);
    expect(widened.added).toEqual(["spec/data/**", "**/*.sample"]);
    expect(isExampleEvidence({ path: "spec/data/x.json" }, widened)).toBe(true);
    expect(isExampleEvidence({ path: "config/app.sample" }, widened)).toBe(true);
    expect(isExampleEvidence({ path: "spec/data/x.json" }, builtIn)).toBe(false);
  });
});

describe("splitting a result", () => {
  const found = (...paths: string[]): Result => ({
    verdict: "found",
    evidence: paths.map((path) => ({ path, line: 1 })),
  });

  it("reads a result whose every match is an example as clean, and keeps the matches", () => {
    const { result, examples } = splitExamples(found("test/fixtures/a", "test/fixtures/b"), builtIn);
    expect(result).toEqual({ verdict: "clean" });
    expect(examples.map((e) => e.path)).toEqual(["test/fixtures/a", "test/fixtures/b"]);
  });

  it("keeps a result with real matches too, on the real ones alone", () => {
    const { result, examples } = splitExamples(found("test/fixtures/a", "src/b"), builtIn);
    expect(result).toEqual({ verdict: "found", evidence: [{ path: "src/b", line: 1 }] });
    expect(examples).toHaveLength(1);
  });

  it("leaves a finding with no evidence (a missing file) found", () => {
    expect(splitExamples({ verdict: "found", evidence: [] }, builtIn)).toEqual({
      result: { verdict: "found", evidence: [] },
      examples: [],
    });
  });
});

/** The `kept` fixture's files (a MET repository), to build on in code. */
function keptFiles(): Record<string, string> {
  const root = new URL("../fixtures/repos/whole/kept/", import.meta.url);
  const files: Record<string, string> = {};
  for (const name of readdirSync(root, { recursive: true }) as string[]) {
    try {
      files[name.split("\\").join("/")] = readFileSync(new URL(name, root), "utf8");
    } catch {
      // A folder.
    }
  }
  return files;
}

/** `kept` plus the given files, run through the CLI with --all; read-only is held around the whole run. */
function runKept(extra: string[], files: Record<string, string> = {}) {
  return withScratch((out) =>
    investigateAsync({ name: "kept", files: { ...keptFiles(), ...files } }, async (root) => {
      const result = await sleuth([root, "--goal", "public", "--out", out, "--all", ...extra], {
        casesFolder: join(out, "default"),
      });
      const repoFolder = readdirSync(out).find((n) => n.startsWith("kept-"))!;
      const caseFolder = join(
        out,
        repoFolder,
        readdirSync(join(out, repoFolder)).find((n) => n.startsWith("20"))!,
      );
      return {
        result,
        record: JSON.parse(readFileSync(join(caseFolder, "case.json"), "utf8")),
        md: readFileSync(join(caseFolder, "case.md"), "utf8"),
        cards: readdirSync(join(caseFolder, "cards")),
      };
    }),
  );
}

// Home folders and the marker word are built from pieces, so this file holds no bait of its own.
const mac = ["/Us", "ers/"].join("");
const mark = ["TO", "DO"].join("");

describe("a case with matches in example locations", () => {
  const bait = {
    "test/fixtures/build.sh": `cp out ${mac}alice/backup/\n# ${mark}: the fixture's own bait\n`,
    "src/__fixtures__/more.sh": `cd ${mac}bob/x/\n`,
  };

  it("is still MET, makes no card even with --all, and shows every match", async () => {
    const { result, record, cards } = await runKept([], bait);
    expect(record.verdict).toBe("met");
    // kept's one card is its deps.updates hunch (--all); the checks that found only examples make none.
    expect(cards).toEqual(["01-turn-on-automated-dependency-updates.md"]);
    for (const id of ["paths.machine", "quality.markers"]) {
      expect(record.checks.find((c: { id: string }) => c.id === id).card).toBeUndefined();
    }
    const paths = record.checks.find((c: { id: string }) => c.id === "paths.machine");
    expect(paths.verdict).toBe("clean");
    expect(paths.examples.map((e: { path: string }) => e.path).sort()).toEqual([
      "src/__fixtures__/more.sh",
      "test/fixtures/build.sh",
    ]);
    expect(record.exampleLocations).toEqual({
      globs: ["**/test/fixtures/**", "**/__fixtures__/**"],
      added: [],
      marker: "code-sleuth:example",
    });
    expect(result.stdout).toMatch(
      /^ {2}\[x\] paths\.machine +Clean, apart from 2 matches in example locations, not counted\.$/m,
    );
    expect(result.stdout).toMatch(
      /^ {2}\[x\] quality\.markers +Clean, apart from 1 match in example locations, not counted\.$/m,
    );
    expect(result.stdout).toContain(
      "Examples   3 matches in example locations were not counted; check that they are fake.\n",
    );
  });

  it("says so in case.md: the check's line, and the case's one Examples line", async () => {
    const { md } = await runKept([], bait);
    expect(md).toContain("(`paths.machine`): Clean, apart from 2 matches in example locations, not counted.");
    expect(md.match(/^Examples: /gm)).toHaveLength(1);
    expect(md).toContain(
      "\nExamples: 3 matches in example locations were not counted; check that they are fake.\n",
    );
  });

  it("still counts a real match outside the examples, beside them", async () => {
    const { record, result } = await runKept([], { ...bait, "scripts/deploy.sh": `cp out ${mac}erin/x/\n` });
    expect(record.verdict).toBe("nearly-met");
    const paths = record.checks.find((c: { id: string }) => c.id === "paths.machine");
    expect(paths.verdict).toBe("found");
    expect(paths.evidence.map((e: { path: string }) => e.path)).toEqual(["scripts/deploy.sh"]);
    expect(paths.card).toBeDefined();
    expect(result.stdout).toMatch(
      /paths\.machine +.*scripts\/deploy\.sh:1 And 2 more in example locations, not counted\.$/m,
    );
  });

  it("records and names every --examples glob, and widens what goes uncounted", async () => {
    const { result, record } = await runKept(["--examples", "spec/data/**", "--examples", "**/*.sample"], {
      "spec/data/home.txt": `${mac}carol/notes/\n`,
    });
    expect(record.verdict).toBe("met");
    expect(record.exampleLocations.added).toEqual(["spec/data/**", "**/*.sample"]);
    expect(record.exampleLocations.globs).toEqual([
      "**/test/fixtures/**",
      "**/__fixtures__/**",
      "spec/data/**",
      "**/*.sample",
    ]);
    expect(result.stdout).toContain(
      "Examples   1 match in example locations was not counted; check that it is fake. --examples added: spec/data/**, **/*.sample.\n",
    );
  });

  it("names --examples globs even when nothing matched them", async () => {
    const { result } = await runKept(["--examples", "nowhere/**"]);
    expect(result.stdout).toContain("Examples   --examples added: nowhere/**.\n");
  });

  it("has no Examples line when there are no examples and no --examples", async () => {
    const { result, md } = await runKept([]);
    expect(result.stdout).not.toMatch(/^Examples/m);
    expect(md).not.toMatch(/^Examples/m);
  });

  it("keeps every example match in --json, with its path and line", async () => {
    const json = await withScratch((out) =>
      investigateAsync({ name: "kept", files: { ...keptFiles(), ...bait } }, async (root) => {
        const { stdout } = await sleuth([root, "--goal", "public", "--out", out, "--json"], {
          casesFolder: join(out, "default"),
        });
        return JSON.parse(stdout);
      }),
    );
    const paths = json.checks.find((c: { id: string }) => c.id === "paths.machine");
    expect(paths.examples.map((e: { path: string; line: number }) => [e.path, e.line]).sort()).toEqual([
      ["src/__fixtures__/more.sh", 1],
      ["test/fixtures/build.sh", 1],
    ]);
  });
});
