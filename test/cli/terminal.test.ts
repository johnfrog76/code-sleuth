import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanRemote } from "../../src/case/repoInfo.js";
import { OWN_STYLES } from "../../src/cli/output.js";
import { printable } from "../../src/cli/printable.js";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's high findings 11 and 12: a remote's password kept in part, and repository text printed to
// the terminal with its control characters.

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const SEQUENCE = new RegExp(`${ESC}\\[[0-9;]*m|${ESC}[^[]|${ESC}\\[[^m]*?[A-Za-z]`, "g");

describe("a remote, as the case keeps it", () => {
  it.each([
    ["https://user:token@github.com/o/r.git", "github.com/o/r"],
    ["https://user:p@ss@github.com/o/r.git", "github.com/o/r"],
    ["https://oauth2:abc@gitlab.example.invalid/o/r?access_token=xyz", "gitlab.example.invalid/o/r"],
    ["https://github.com/o/r.git#secret-fragment", "github.com/o/r"],
    ["https://p@ss@host.example.invalid", "host.example.invalid"],
    ["git@github.com:o/r.git", "github.com/o/r"],
    ["a@b@host.example.invalid:o/r.git", "host.example.invalid/o/r"],
    ["ssh://git@host.example.invalid:22/o/r.git", "host.example.invalid:22/o/r"],
    ["github.com/o/r", "github.com/o/r"],
  ])("keeps %j as %j", (url, kept) => {
    expect(cleanRemote(url)).toBe(kept);
  });

  it("keeps it so through a whole run", () =>
    withScratch((scratch) =>
      investigateAsync(
        { name: "widget", files: { "README.md": "# widget\n" } },
        async (root) => {
          await sleuth([root, "--goal", "public", "--offline", "--out", join(scratch, "cases")], {
            casesFolder: join(scratch, "default"),
          });
          const folder = join(scratch, "cases");
          const record = (readdirSync(folder, { recursive: true }) as string[]).find((f) =>
            f.endsWith("case.json"),
          )!;
          const json = JSON.parse(readFileSync(join(folder, record), "utf8")) as { repo: { remote: string } };
          expect(json.repo.remote).toBe("github.com/o/r");
          expect(readFileSync(join(folder, record), "utf8")).not.toContain("ss@");
        },
        {
          git: true,
          prepare: (root) =>
            execFileSync("git", ["remote", "add", "origin", "https://user:p@ss@github.com/o/r.git"], {
              cwd: root,
            }),
        },
      ),
    ));
});

describe("what the terminal shows", () => {
  it("shows a control character as ?, and keeps the newline and the tab", () => {
    expect(printable(`a${ESC}[2Jb${BEL}c‮d\te\nf`)).toBe("a?[2Jb?c?d\te\nf");
  });

  const hostile = {
    "package.json": JSON.stringify({
      name: "widget",
      version: "1.0.0",
      license: `MIT${ESC}]52;c;ZWNobw==${BEL}${ESC}[2J`,
    }),
    LICENSE: "Custom terms of my own.\n",
    [`notes${ESC}[1A${ESC}[2K.txt`]: "path /Users/alice/proj\n",
    // One of Code Sleuth's own styles: the last pass lets it through, so it is taken out where the name goes in.
    [`green${ESC}[32m.js`]: "// TODO remove this\n",
  };

  it.each([
    ["without colour", false],
    ["with colour, in a terminal", true],
  ])("lets through no escape sequence of the repository's, %s", (_name, colour) =>
    withScratch((scratch) =>
      investigateAsync(
        { name: "widget", files: hostile },
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--offline", "--out", join(scratch, "cases")],
            {
              casesFolder: join(scratch, "default"),
              ...(colour ? { terminal: { stdin: false, stdout: true, stderr: true } } : {}),
              env: {},
            },
          );
          expect(result.code).toBe(0);
          const sequences = (result.stdout + result.stderr).match(SEQUENCE) ?? [];
          for (const sequence of sequences) expect(OWN_STYLES).toContain(sequence);
          expect(result.stdout).not.toContain(BEL);
          expect(result.stdout).toContain("MIT?]52;c;ZWNobw==??[2J");
          expect(result.stdout).toContain("notes?[1A?[2K.txt");
          expect(result.stdout).toContain("green?[32m.js");
        },
        { git: true },
      ),
    ),
  );

  it("keeps a refusal to one Error: line and one Hint: line, whatever the path holds", () =>
    withScratch((scratch) =>
      investigateAsync(
        tree(),
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--offline", "--out", join(root, `in${ESC}[2Jside\nError: forged`)],
            { casesFolder: join(scratch, "default") },
          );
          expect(isRefusal(result)).toBe(true);
          expect(result.stderr).not.toContain(ESC);
        },
        { git: true },
      ),
    ));
});

function tree() {
  return { name: "widget", files: { "README.md": "# widget\n" } };
}
