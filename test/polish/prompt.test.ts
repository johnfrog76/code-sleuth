import { describe, expect, it } from "vitest";
import { PROMPT } from "../../src/polish/client.js";

// The prompt is the first rung of keeping a rewrite honest: it asks; the guard checks the list
// (docs/POLISH.md). These hold the asks in place, so a later edit cannot drop one quietly.
describe("the polish prompt", () => {
  it("keeps the facts the guard checks", () => {
    for (const ask of [
      "Every path",
      "Every number",
      "Every masked value",
      "Every checkbox line",
      "Found by Code Sleuth:",
    ])
      expect(PROMPT).toContain(ask);
  });

  it("asks for no added specific: a name, a place, a count, an example or a kind", () => {
    expect(PROMPT).toContain(
      "Don't add a specific the card doesn't give: a name, a place, a count, an example or a kind.",
    );
    expect(PROMPT).toContain('not "an email address"');
  });

  it("asks that meaning words keep their meaning, and that nothing is dropped", () => {
    expect(PROMPT).toContain('"Quietly" is not "privately"');
    expect(PROMPT).toMatch(/Don't drop a sentence's point, a condition/);
  });

  it("asks for no brackets, no new character and no added sentence, which the guard refuses", () => {
    expect(PROMPT).toMatch(/Add no text in square brackets, apart from the card's own checkboxes/);
    expect(PROMPT).toMatch(/straight quotes and `--`, never curly quotes or a dash/);
    expect(PROMPT).toContain("Keep it about as long as it is: add no sentence of your own.");
  });

  it("still lets the model hand the card back unchanged", () => {
    expect(PROMPT).toContain("If you can't improve the card without changing a fact, return it unchanged.");
  });

  it("holds no machine path and no private name", () => {
    expect(PROMPT).not.toMatch(/\/Users\/|\/home\/|[A-Z]:\\\\/);
  });
});
