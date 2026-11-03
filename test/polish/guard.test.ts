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
