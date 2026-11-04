import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CardText, type GuardResult, factsOf, guardPolish } from "../../src/polish/guard.js";

/** One table: a kept rewrite, and a row for each reason a rewrite is not kept. */
const table = JSON.parse(readFileSync(new URL("../fixtures/polish/guard.json", import.meta.url), "utf8")) as {
  original: CardText;
  rows: { name: string; polished: CardText; expected: GuardResult }[];
};

describe("the polish guard", () => {
  it.each(table.rows)("$name", ({ polished, expected }) => {
    expect(guardPolish(table.original, polished)).toEqual(expected);
  });

  it("has a row for every reason it gives", () => {
    const reasons = table.rows.flatMap((r) => (r.expected.kept ? [] : [r.expected.reason]));
    expect(new Set(reasons)).toEqual(
      new Set([
        "empty",
        "shape-changed",
        "check-id-dropped",
        "path-dropped",
        "path-added",
        "masked-value-changed",
        "number-changed",
        "checkbox-count-changed",
      ]),
    );
  });

  it("keeps the card it was given, unchanged", () => {
    expect(guardPolish(table.original, table.original)).toEqual({ kept: true });
  });

  it("reads the card's facts", () => {
    const facts = factsOf(table.original);
    // A check id in backticks reads like a file name, so it is kept like one: the check id is a fact too.
    expect([...facts.paths].sort()).toEqual(["config/dev.ts:12", "scripts/deploy.sh:40", "secrets.tree"]);
    expect([...facts.maskedValues].sort()).toEqual(["****", "ghp_****9f"]);
    expect(facts.checkboxes).toBe(2);
    expect(facts.fingerprint).toMatch(/^Found by Code Sleuth: secrets\.tree, /);
  });
});

describe("the polish guard and the card's own evidence", () => {
  // A card whose evidence cites paths that do not look like paths: a dotfile with a line, bare names.
  const fingerprint = "Found by Code Sleuth: files.sensitive, case 2026-11-04-public-1, at 3f2a9c1.";
  const original: CardText = {
    title: "Remove key files and .env files from the repository",
    body: [
      "Key files in the tree.",
      "",
      "**Evidence**",
      "- `.env:3` -- `TOKEN=****`",
      "- `Dockerfile`",
      "- `LICENSE`",
      "",
      "Two files, and 2 lines to fix.",
      "",
      "**Done when**",
      "- [ ] `code-sleuth --goal public` reads `files.sensitive` as Clean.",
      "",
      fingerprint,
    ].join("\n"),
  };
  const cites = [".env:3", "Dockerfile", "LICENSE"];
  const rewrite = (from: string, to: string): CardText => ({
    ...original,
    body: original.body.replace(from, to),
  });

  it.each([
    ["changes `.env:3` to `.envrc:3`", rewrite("`.env:3`", "`.envrc:3`"), "path-dropped"],
    ["drops a bare `Dockerfile`", rewrite("- `Dockerfile`\n", ""), "path-dropped"],
    ["drops a bare `LICENSE`", rewrite("- `LICENSE`\n", ""), "path-dropped"],
    ["drops one of two equal numbers", rewrite("and 2 lines", "and lines"), "number-changed"],
  ] as const)("refuses a rewrite that %s", (_name, polished, reason) => {
    expect(guardPolish(original, polished, cites)).toEqual({ kept: false, reason });
  });

  it("keeps a faithful rewrite", () => {
    const polished = rewrite(
      "Key files in the tree.",
      "There are key files in the tree, and they should go.",
    );
    expect(guardPolish(original, polished, cites)).toEqual({ kept: true });
  });

  it("finds a cite standing on its own, not inside a longer one", () => {
    const longer = { ...original, body: original.body.replace("`.env:3`", "`.env:31`") };
    expect(guardPolish(original, longer, cites)).toEqual({ kept: false, reason: "path-dropped" });
    const sentence = { ...original, body: original.body.replace("- `LICENSE`", "- See LICENSE.") };
    expect(guardPolish(original, sentence, cites)).toEqual({ kept: true });
  });
});
