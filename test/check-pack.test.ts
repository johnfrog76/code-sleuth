import { describe, expect, it } from "vitest";
import { checkPack } from "../scripts/check-pack.mjs";

// scripts/check-pack.mjs holds what npm would pack to package.json's files before a version is staged. These
// hold its matching, on lists made here: npm is never run.
const manifest = {
  files: ["dist", "toolkit", "src/polish/prompt.md", ".env.example"],
  bin: { "code-sleuth": "dist/cli/main.js" },
};
const packed = [
  "package.json",
  "README.md",
  "LICENSE",
  ".env.example",
  "dist/cli/main.js",
  "toolkit/handoff.ps1",
  "src/polish/prompt.md",
];

describe("the pack check", () => {
  it("allows each file under files, and the ones npm always packs", () => {
    expect(checkPack(manifest, packed)).toEqual({ unexpected: [], empty: [] });
    expect(checkPack(manifest, [...packed, "readme", "Licence.txt", "LICENSE.md"]).unexpected).toEqual([]);
  });

  it("names a file no entry allows", () => {
    const extra = [
      ...packed,
      ".env",
      "src/polish/client.ts",
      "distant/x.js",
      "CHANGELOG.md",
      "docs/README.md",
    ];
    expect(checkPack(manifest, extra).unexpected).toEqual([
      ".env",
      "src/polish/client.ts",
      "distant/x.js",
      "CHANGELOG.md",
      "docs/README.md",
    ]);
  });

  it("allows the bin and main files, and the always-packed names at the root only", () => {
    const loose = { files: ["dist"], bin: "bin/run.js", main: "./index.js" };
    expect(checkPack(loose, ["package.json", "bin/run.js", "index.js", "dist/a.js"]).unexpected).toEqual([]);
    expect(checkPack(loose, ["dist/a.js", "toolkit/README.md", "x/package.json"]).unexpected).toEqual([
      "toolkit/README.md",
      "x/package.json",
    ]);
  });

  it("names an entry that packs nothing", () => {
    expect(
      checkPack(
        manifest,
        packed.filter((path) => !path.startsWith("dist/")),
      ).empty,
    ).toEqual(["dist"]);
  });

  it("reads entries as plain paths, with or without ./ and a trailing slash", () => {
    expect(checkPack({ files: ["./dist/", "toolkit"] }, ["dist/a.js", "toolkit/b.ps1"])).toEqual({
      unexpected: [],
      empty: [],
    });
  });

  it("refuses a files entry with a glob, which it does not read", () => {
    expect(() => checkPack({ files: ["dist/**/*.js"] }, ["dist/a.js"])).toThrow(/glob/);
  });
});
