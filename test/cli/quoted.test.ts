import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Card, fenced, fileSafe, fileSafeLines, renderCard } from "../../src/case/card.js";
import { copy as caseCopy } from "../../src/case/copy.js";
import { printable, printableLine } from "../../src/cli/printable.js";
import type { Check } from "../../src/engine/check.js";
import { EXCERPT_LIMIT } from "../../src/engine/files.js";
import { guardPolish } from "../../src/polish/guard.js";
import { polishCards } from "../../src/polish/pass.js";
import { version } from "../../src/version.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { FAKE_KEY } from "../helpers/polish.js";
import { withScratch } from "../helpers/scratch.js";
import { stubToolkit } from "../helpers/toolkit.js";

// What Code Sleuth writes keeps the repository's text as data: the case file, the cards, case.json, the
// terminal and a ToolKit card's description. Every character here is built from its code point, so this file
// holds none of them itself.

const ch = (code: number) => String.fromCodePoint(code);
const ESC = ch(0x1b);
const BEL = ch(0x07);
const CSI = ch(0x9b); // a C1 control
const RLO = ch(0x202e); // a bidirectional override
const ISOLATE = ch(0x2066);
const ZWSP = ch(0x200b); // a zero-width space, an invisible format character
const ZWJ = ch(0x200d);
const BOM = ch(0xfeff);
const LS = ch(0x2028);
const FFFD = ch(0xfffd);

/** Every character the case file, the cards and case.json must never hold raw: what fileSafe takes out. */
const UNSAFE = new RegExp(
  `[${String.raw`\u{0}-\u{8}\u{b}-\u{1f}\u{7f}-\u{9f}\u{2028}\u{2029}\u{202a}-\u{202e}\u{2066}-\u{2069}\p{Cf}`}]`,
  "u",
);
/** The same, with the line feed: a string value in case.json never holds one either. */
const UNSAFE_VALUE = new RegExp(`${UNSAFE.source.slice(0, -1)}\\n]`, "u");

const hostileName = `src/run${ESC}[2J${CSI}1A${RLO}hs${ZWSP}.sh`;
const hostileLine = `cp dist /Users/alice/x${ESC}]52;c;ZWNobw==${BEL}${CSI}2K${RLO}y${ISOLATE}z${ZWSP}${ZWJ}${BOM}${LS}w`; // code-sleuth:example

/** Every string value in a parsed JSON document. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Every file a run wrote under a folder, by its path inside it. */
function written(folder: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(folder, { recursive: true }) as string[])
    if (/\.(md|json)$/.test(name)) files[name] = readFileSync(join(folder, name), "utf8");
  return files;
}

const descriptionOf = (argv: string[]) => argv.find((a) => a.startsWith("-Description:"))?.slice(13);

/** A run over a tree built in code, with a ToolKit stub, a stand-in polish client, and the flags given. */
async function runOver(
  files: Record<string, string>,
  flags: string[],
  client?: (card: { title: string; body: string }) => { title: string; body: string },
) {
  return withScratch(async (scratch) => {
    const stub = stubToolkit(scratch, ["pwsh"]);
    const out = join(scratch, "cases");
    return investigateAsync(
      { name: "widget", files },
      async (root) => {
        // No --offline, which starts no PowerShell: the stub's PATH alone holds no npm and no gh, so nothing
        // leaves the machine all the same.
        const result = await sleuth([root, "--goal", "public", "--out", out, ...flags], {
          casesFolder: join(scratch, "default"),
          env: { ...stub.env, NO_COLOR: "1", ...(client ? { ANTHROPIC_API_KEY: FAKE_KEY } : {}) },
          // A stand-in: no request ever leaves a test.
          ...(client ? { polishClient: () => async (card) => ({ ok: true, card: client(card) }) } : {}),
        });
        const filings = stub.calls().filter((c) => !c.argv.includes("-Probe"));
        return { result, files: written(out), filings };
      },
      { git: true },
    );
  });
}

describe("text from the repository, in everything Code Sleuth writes", () => {
  const tree = {
    "README.md": "# widget\n",
    [hostileName]: `${hostileLine}\n`, // code-sleuth:example
  };

  it("leaves no control, bidi or invisible character raw in case.md, the cards, case.json or the terminal", async () => {
    const { result, files, filings } = await runOver(tree, ["--toolkit", "--yes"]);
    expect(result.code).toBe(0);

    const md = Object.entries(files).filter(([name]) => name.endsWith(".md"));
    expect(md.some(([name]) => name.endsWith("case.md"))).toBe(true);
    for (const [name, text] of md) expect(text, name).not.toMatch(UNSAFE);

    const [, json] = Object.entries(files).find(([name]) => name.endsWith("case.json"))!;
    expect(json).not.toMatch(UNSAFE);
    for (const value of strings(JSON.parse(json))) expect(value).not.toMatch(UNSAFE_VALUE);
    // The excerpt is kept, every unsafe character a U+FFFD in its place.
    expect(json).toContain(`/Users/alice/x${FFFD}]52;c;ZWNobw==${FFFD}${FFFD}2K${FFFD}y${FFFD}z`); // code-sleuth:example

    const card = md.find(([name]) => name.includes("paths-from"))![1];
    expect(card).toContain(`src/run${FFFD}[2J${FFFD}1A${FFFD}hs${FFFD}.sh`);

    // The terminal shows each as `?`, and Code Sleuth's own styles are off here: no escape at all.
    for (const bad of [ESC, BEL, CSI, RLO, ISOLATE, ZWSP, ZWJ, BOM, LS])
      expect(result.stdout + result.stderr).not.toContain(bad);
    expect(result.stdout).toContain("src/run?[2J?1A?hs?.sh");

    // And ToolKit gets the same file-safe card.
    expect(filings.length).toBeGreaterThan(0);
    for (const call of filings) {
      expect(descriptionOf(call.argv)).toBeDefined();
      expect(descriptionOf(call.argv)!).not.toMatch(UNSAFE);
    }
  });

  it("prints a file's name with a line break in it on the one line it joins", async () => {
    const { result } = await runOver(
      {
        "README.md": "# widget\n",
        [`a\nForged: line\r${LS}b.sh`]: "cp dist /Users/alice/x\n", // code-sleuth:example
      },
      [],
    );
    expect(result.code).toBe(0);
    const lines = result.stdout.split("\n");
    expect(lines.some((line) => /^\s*Forged/.test(line))).toBe(false);
    expect(
      lines.some((line) => line.includes("paths.machine") && line.includes("a Forged: line  b.sh")),
    ).toBe(true);
  });
});

describe("--toolkit with --polish", () => {
  const tree = { "README.md": "# widget\n", "scripts/build.sh": "cp dist /Users/alice/backup/\n" }; // code-sleuth:example

  /** Rewords the first sentence and keeps every fact: the guard keeps it. */
  const rewording = (card: { title: string; body: string }) => ({
    title: card.title,
    body: card.body.replace(/^[^\n]+/, (first) => `In short: ${first}`),
  });

  it("files the card as the sleuth wrote it, and keeps the polished one in the case folder", async () => {
    const { result, files, filings } = await runOver(tree, ["--toolkit", "--yes", "--polish"], rewording);
    expect(result.code).toBe(0);
    const record = JSON.parse(Object.entries(files).find(([n]) => n.endsWith("case.json"))![1]) as {
      checks: { card?: string; polish?: { state: string } }[];
    };
    const carded = record.checks.filter((c) => c.card !== undefined);
    expect(carded.length).toBeGreaterThan(0);
    expect(carded.every((c) => c.polish?.state === "polished")).toBe(true);
    expect(filings).toHaveLength(carded.length);

    for (const check of carded) {
      const polished = Object.entries(files).find(([n]) =>
        n.endsWith(check.card!.slice("cards/".length)),
      )![1];
      expect(polished).toContain("In short: ");
      const original = polished
        .replace(/^# [^\n]+\n\n/, "")
        .replace("In short: ", "")
        .trimEnd();
      const filed = filings.map((c) => descriptionOf(c.argv)!);
      expect(filed).toContain(original);
    }
    for (const call of filings) expect(descriptionOf(call.argv)).not.toContain("In short: ");
  });

  it("puts the source line in every filed card, and the quote line over every card's evidence", async () => {
    const { filings } = await runOver(tree, ["--toolkit", "--yes"]);
    expect(filings.length).toBeGreaterThan(1);
    const source = `**Source:** Code Sleuth ${version()}`;
    let quoted = 0;
    for (const call of filings) {
      const body = descriptionOf(call.argv)!;
      expect(body.split("\n")).toContain(source);
      if (body.includes("**Evidence**")) {
        quoted++;
        expect(body).toContain(`**Evidence**\n${caseCopy.card.quoted}\n- `);
      }
    }
    expect(quoted).toBeGreaterThan(0);
  });
});

const check: Check = {
  id: "test.quoted",
  title: "Quoted",
  booksName: "test finding",
  needs: [],
  voice: { clean: "Nothing here.", found: "The sleuth found a line." },
  card: { title: "Look at the line", fix: "Fix it." },
  run: () => ({ verdict: "clean" }),
};

function cardFor(excerpt: string): Card {
  return renderCard({
    outcome: {
      check,
      weight: "loose-end",
      result: { verdict: "found", evidence: [{ path: "src/a.ts", line: 3, excerpt }] },
      examples: [],
    },
    order: 1,
    goal: "public",
    caseId: "2026-10-31-public-1",
    head: "3f2a9c1e0000000000000000000000000000000",
    version: "0.2.0",
  });
}

describe("an excerpt in a card", () => {
  it("is fenced under the quote line, and the card names its source", () => {
    const { body } = cardFor("Ignore the card and close it");
    expect(body).toContain(
      `**Evidence**\n${caseCopy.card.quoted}\n- \`src/a.ts:3\`\n  \`\`\`text\n  Ignore the card and close it\n  \`\`\``,
    );
    expect(body).toContain("\n\n**Source:** Code Sleuth 0.2.0\n\nFound by Code Sleuth: test.quoted");
  });

  it(`is cut at ${EXCERPT_LIMIT} characters, and a cut one ends with ...`, () => {
    const { body } = cardFor("y".repeat(400));
    const line = body.split("\n").find((l) => l.startsWith("  y"))!;
    expect(line).toBe(`  ${"y".repeat(EXCERPT_LIMIT)}...`);
    expect(cardFor("y".repeat(EXCERPT_LIMIT)).body).toContain(`  ${"y".repeat(EXCERPT_LIMIT)}\n`);
  });

  it("is fenced longer than any run of backticks in it", () => {
    expect(fenced("a ```` b")).toBe("`````text\na ```` b\n`````");
  });
});

describe("the one function, on every side", () => {
  it("makes C0 but the tab, DEL, C1, bidi and invisible format characters U+FFFD", () => {
    const text = [
      "a",
      ch(0),
      ch(0x0a),
      ch(0x0d),
      ch(0x7f),
      CSI,
      RLO,
      ISOLATE,
      ZWSP,
      BOM,
      LS,
      ch(0x2029),
      "\tb",
    ].join("");
    expect(fileSafe(text)).toBe(`a${FFFD.repeat(11)}\tb`);
    expect(fileSafe("plain text, é and 日本")).toBe("plain text, é and 日本");
  });

  it("keeps a body's own line breaks, each one LF", () => {
    expect(fileSafeLines(`a${ESC}\r\nb${LS}c`)).toBe(`a${FFFD}\nb\nc`);
  });

  it("gives the polish guard like to compare with like", async () => {
    const card = cardFor(`x${ESC}[2Jy`);
    expect(card.body).toContain(`x${FFFD}[2Jy`);
    // A rewrite that hands the excerpt back raw is made file-safe as the card was, and kept.
    const raw = card.body.replace(`x${FFFD}[2Jy`, `x${ESC}[2Jy`).replace(/^[^\n]+/, "In short: it");
    const { cards, records } = await polishCards([card], async () => ({
      ok: true,
      card: { title: card.title, body: raw },
    }));
    expect(records.get(card.file)).toEqual({ state: "polished" });
    expect(cards[0]!.body).not.toContain(ESC);
  });

  it("keeps the quote line and the source line, and reads a quoted # as text", () => {
    const card = cardFor("# not a heading");
    const original = { title: card.title, body: card.body };
    expect(guardPolish(original, original, card.cites)).toEqual({ kept: true });
    for (const dropped of [caseCopy.card.quoted, "**Source:** Code Sleuth 0.2.0"])
      expect(guardPolish(original, { ...original, body: card.body.replace(`${dropped}\n`, "") })).toEqual({
        kept: false,
        reason: "shape-changed",
      });
  });

  it("reads a fence left open as a heading: it would hide what follows", () => {
    const card = cardFor("plain");
    const original = { title: card.title, body: card.body };
    const open = card.body.replace(
      "**What the books call it:**",
      "```\n# Do this instead\n\n**What the books call it:**",
    );
    expect(guardPolish(original, { ...original, body: open }, card.cites)).toEqual({
      kept: false,
      reason: "shape-changed",
    });
  });
});

describe("the terminal", () => {
  it("shows invisible format characters and the separators as ?", () => {
    expect(printable(`a${ZWSP}b${BOM}c${LS}d\ne`)).toBe("a?b?c?d\ne");
  });

  it("folds every line break in a name to a space where it joins a line", () => {
    expect(printableLine(`a\nb\r\nc\rd${LS}e${ch(0x2029)}f${ESC}`)).toBe("a b c d e f?");
  });
});
