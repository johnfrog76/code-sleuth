import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { headings } from "../../src/engine/checks/docs.readme.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { matchLine } from "../../src/engine/secrets/scan.js";
import { investigate } from "../helpers/investigate.js";
import { SECRETS } from "../helpers/secrets.js";

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
