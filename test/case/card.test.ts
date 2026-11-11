import { describe, expect, it } from "vitest";
import { CARD_BODY_LIMIT, cardFile, codeSpan, renderCard, slug } from "../../src/case/card.js";
import type { Check, Evidence } from "../../src/engine/check.js";
import type { Weight } from "../../src/engine/goals.js";

const check: Check = {
  id: "test.many",
  title: "Many findings",
  booksName: "test finding",
  needs: [],
  voice: { clean: "Nothing here.", found: "The sleuth found a lot." },
  card: { title: "Look at the findings", fix: "Fix each one." },
  run: () => ({ verdict: "clean" }),
};

function card(evidence: Evidence[], weight: Weight = "loose-end") {
  return renderCard({
    outcome: { check, weight, result: { verdict: "found", evidence }, examples: [] },
    order: 3,
    goal: "public",
    caseId: "2026-10-31-public-1",
    head: "3f2a9c1e0000000000000000000000000000000",
    version: "0.2.0",
  });
}

const many = (n: number, excerpt = "x") =>
  Array.from({ length: n }, (_, i) => ({ path: `src/file-${i}.ts`, line: i + 1, excerpt }));

describe("a card", () => {
  it("cites each path and path:line its evidence lines show, for the polish guard", () => {
    const shown = card([
      { path: ".env", line: 3, excerpt: "TOKEN=****" },
      { path: "Dockerfile" },
      { path: "src/a.ts", line: 12 },
    ]);
    expect(shown.cites).toEqual([".env:3", "Dockerfile", "src/a.ts:12"]);
    for (const cite of shown.cites!) expect(shown.body).toContain(`\`${cite}\``);
  });

  it("is a Bug for a smoking gun and a Task otherwise", () => {
    expect(card([], "smoking-gun").type).toBe("Bug");
    expect(card([], "loose-end").type).toBe("Task");
    expect(card([], "hunch").type).toBe("Task");
  });

  it("has no ## heading, fits the limit, and ends with the fingerprint", () => {
    for (const evidence of [[], many(3), many(30), many(30, "y".repeat(400))]) {
      const { body } = card(evidence);
      expect(body).not.toMatch(/^#/m);
      expect(body.length).toBeLessThanOrEqual(CARD_BODY_LIMIT);
      expect(body.split("\n").at(-1)).toBe(
        "Found by Code Sleuth: test.many, case 2026-10-31-public-1, at 3f2a9c1.",
      );
    }
  });

  it("shows at most 20 evidence lines and says how many more were cut", () => {
    const { body } = card(many(30));
    expect(body.match(/^- `src\/file-/gm)).toHaveLength(20);
    expect(body).toContain("- and 10 more in the case file");
  });

  it("cuts below 20 when long excerpts would pass the limit, and still counts the rest", () => {
    const { body } = card(many(30, "y".repeat(400)));
    const shown = body.match(/^- `src\/file-/gm)!.length;
    expect(shown).toBeLessThan(20);
    expect(body).toContain(`- and ${30 - shown} more in the case file`);
  });

  it("carries its acceptance as checkboxes, ending with the check reading Clean", () => {
    expect(card([]).body).toContain("- [ ] `code-sleuth --goal public` reads `test.many` as Clean.");
  });

  it("is written as a file with its own heading, and named by order and slug", () => {
    const c = card([]);
    expect(c.file).toBe("cards/03-look-at-the-findings.md");
    expect(cardFile(c).startsWith("# Task: Look at the findings\n\n")).toBe(true);
  });
});

describe("the pieces", () => {
  it.each([
    ["A token in plain sight", "a-token-in-plain-sight"],
    ["  No LICENSE -- at all!  ", "no-license-at-all"],
    ["x".repeat(70), "x".repeat(60)],
    [`${"a".repeat(59)} b`, "a".repeat(59)],
  ])("slugs %j", (title, expected) => expect(slug(title)).toBe(expected));

  it.each([
    ["plain", "`plain`"],
    ["a `tick`", "`` a `tick` ``"],
    ["two\nlines", "`two lines`"],
  ])("puts %j in a code span", (text, expected) => expect(codeSpan(text)).toBe(expected));
});
