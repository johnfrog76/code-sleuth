import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HANDOFF } from "../../src/toolkit/shell.js";

// Windows PowerShell 5.1 is ToolKit's floor, and handoff.ps1 must parse there. It runs under 5.1 for real
// only on Windows (test/toolkit/real.test.ts); this holds the syntax everywhere.
const code = readFileSync(HANDOFF, "utf8")
  .replace(/<#[\s\S]*?#>/g, "")
  .split(/\r?\n/)
  .map((line) => line.replace(/(^|\s)#.*$/, ""))
  .join("\n");

describe("handoff.ps1", () => {
  it.each([
    ["the null-coalescing operator", /\?\?/],
    ["the null-conditional operator", /\?\./],
    ["a pipeline chain", /&&|\|\|/],
    ["-AsHashtable", /-AsHashtable/i],
    ["a ternary", /\)\s*\?\s*[^\s.]/],
  ])("uses no %s, which Windows PowerShell 5.1 cannot parse", (_, pattern) => {
    expect(code).not.toMatch(pattern);
  });

  it("is shipped with the package", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      files: string[];
    };
    expect(manifest.files).toContain("toolkit");
  });
});
