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

// The rule: you can't be safe, but you can practice smart habits. Code Sleuth's own words never claim that a
// repository, a verdict or Code Sleuth itself is safe, secure or guaranteed. A practice may be named; new copy
// says "smart habits", which needs no entry here. Every other use of these words is listed, with its reason.
const STATE = /\b(?:safe|safely|safer|safest|safety|secure|securely|guarantee|guarantees|guaranteed)\b/i;

const ALLOWED: readonly { phrase: string; in: readonly string[]; why: string }[] = [
  {
    phrase: "It asks; it cannot guarantee.",
    in: ["docs/POLISH.md"],
    why: "a denial: the prompt asks the model to keep every fact, and the doc says that asking is not a promise",
  },
  {
    phrase: "(`npm audit fix` does what it safely can)",
    in: ["docs/CHECKS.md", "src/engine/copy.ts"],
    why: "a practice, npm's own: it applies only the fixes that stay inside the ranges a project allows",
  },
  {
    phrase: "take its safe settings from GIT_CONFIG_KEY_<n>",
    in: ["src/engine/copy.ts"],
    why: "a practice: the settings Code Sleuth always hands git, a default it keeps, not a state it claims",
  },
];

/** Everything a person reads of Code Sleuth's own words, as files: the docs, the page and the copy. */
function ownWords(): string[] {
  const under = (folder: string, keep: (name: string) => boolean) =>
    readdirSync(new URL(folder, root))
      .filter(keep)
      .map((name) => `${folder}${name}`);
  return [
    "README.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ...under(".github/ISSUE_TEMPLATE/", (name) => name.endsWith(".yml")),
    ...under("docs/", (name) => name.endsWith(".md")),
    ...under("site/", (name) => name.endsWith(".html")),
    "src/cli/copy.ts",
    "src/case/copy.ts",
    "src/engine/copy.ts",
    "src/polish/prompt.md",
  ];
}

describe("no claim that anything is safe", () => {
  it("never says a repository, a verdict or Code Sleuth is safe, secure or guaranteed", () => {
    const files = ownWords();
    expect(files).toEqual(
      expect.arrayContaining([
        "docs/CHECKS.md",
        "site/index.html",
        "src/case/copy.ts",
        "src/polish/prompt.md",
      ]),
    );
    const used = new Set<string>();
    const claims: string[] = [];
    for (const path of files) {
      read(path)
        .split("\n")
        .forEach((line, i) => {
          let rest = line;
          for (const allowed of ALLOWED) {
            if (!allowed.in.includes(path) || !rest.includes(allowed.phrase)) continue;
            rest = rest.replaceAll(allowed.phrase, "");
            used.add(`${allowed.phrase} @ ${path}`);
          }
          if (STATE.test(rest)) claims.push(`${path}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(claims).toEqual([]);
    // An entry that no longer matches is a stale reason: take it out, or the list stops meaning anything.
    const listed = ALLOWED.flatMap((allowed) => allowed.in.map((path) => `${allowed.phrase} @ ${path}`));
    expect(listed.filter((entry) => !used.has(entry))).toEqual([]);
  });

  it("gives the security goal's verdicts the public goal's shape: ready, not safe", () => {
    expect(caseCopy.copy.verdict.security).toEqual({
      ready: "nothing stands out on security",
      nearly: "nearly ready on security",
      "not-ready": "not ready on security",
    });
  });
});
