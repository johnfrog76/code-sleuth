import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as caseCopy from "../../src/case/copy.js";
import * as cliCopy from "../../src/cli/copy.js";
import * as engineCopy from "../../src/engine/copy.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The goal is "public facing" wherever a person reads it: the output, the case file, the cards, --help,
// the goal prompt, the docs and the project's page. The flag stays `--goal public`; that value isn't prose.
const GO_PUBLIC = /\bgo(?:es|ing|ne)?[\s-]+public\b/i;

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** Every string a copy module holds, functions included as their source, so a template counts too. */
function words(module: object): string {
  return JSON.stringify(module, (_key, value: unknown) =>
    typeof value === "function" ? String(value) : value,
  );
}

/** Every file under a folder, as one text. */
function everyFile(folder: string): string {
  return (readdirSync(folder, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
    .join("\n");
}

describe("the goal's words", () => {
  it("never say go public in a document a person reads", () => {
    const docs = [
      "README.md",
      "SECURITY.md",
      "site/index.html",
      ...readdirSync(new URL("docs/", root))
        .filter((name) => name.endsWith(".md"))
        .map((name) => `docs/${name}`),
    ];
    expect(docs).toEqual(
      expect.arrayContaining([
        "docs/QUICKSTART.md",
        "docs/CLI.md",
        "docs/CHECKS.md",
        "docs/CASE-FILE.md",
        "docs/CONFIGURATION.md",
        "docs/POLISH.md",
        "docs/TOOLKIT.md",
        "docs/KNOWN-GAPS.md",
        "docs/CONTRIBUTING.md",
      ]),
    );
    expect(docs.filter((doc) => GO_PUBLIC.test(read(doc)))).toEqual([]);
  });

  it("never say go public in the changelog's unreleased section; released ones stay as shipped", () => {
    const unreleased = read("CHANGELOG.md")
      .split(/^## \[Unreleased\]$/m)[1]!
      .split(/^## \[/m)[0]!;
    expect(unreleased).not.toMatch(GO_PUBLIC);
  });

  it("never say go public in a copy file", () => {
    for (const module of [cliCopy, caseCopy, engineCopy]) expect(words(module)).not.toMatch(GO_PUBLIC);
  });

  it("never say go public in a run: the prompt, the terminal, the case file, the cards, --help, checks", async () => {
    await withScratch(async (out) => {
      const casesFolder = join(out, "default");
      const run = await investigateAsync("whole/bare", (repo) =>
        sleuth([repo, "--all", "--out", out], {
          casesFolder,
          terminal: { stdin: true, stdout: true, stderr: true },
          env: { NO_COLOR: "1" },
          ask: async () => "",
        }),
      );
      expect(run.code).toBe(0);
      expect(run.stdout).toContain("Is it ready to be public facing?");
      const help = await sleuth(["--help"], { casesFolder });
      const checks = await sleuth(["checks"], { casesFolder });
      const caseFiles = everyFile(out);
      expect(caseFiles).toContain("Goal: public facing");
      for (const text of [run.stdout, run.stderr, help.stdout, checks.stdout, caseFiles]) {
        expect(text).not.toMatch(GO_PUBLIC);
      }
    });
  });
});
