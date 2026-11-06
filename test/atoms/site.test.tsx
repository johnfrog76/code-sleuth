import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERDICT_TOKENS, verdictCss } from "../../src/atoms/figures.js";
import { contrast, stamped } from "../helpers/contrast.js";

// The project's page wears the verdict tokens: its stamps and its CSS read them, and nothing types a colour in.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const page = read("site/index.html");

describe("the project's page and the verdict tokens", () => {
  it("takes its verdict colours from the tokens, with no colour typed into the page", () => {
    expect(read("site/tokens.css")).toContain(verdictCss());
    expect(page).toContain('href="tokens.css"');
    expect(page).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    for (const [word, token] of Object.entries(VERDICT_TOKENS)) {
      const stamp = read(`site/stamp-${word.toLowerCase().replace(" ", "-")}.svg`);
      expect(stamp).toContain(verdictCss());
      expect(stamp).toContain(`var(${token.name})`);
    }
    expect(
      readdirSync(new URL("site/", root)).filter((name) => name.includes("stamp") && name.includes("dark")),
    ).toEqual([]);
  });

  it("reads each stamp on its own background, in both appearances", () => {
    const css = read("site/site.css");
    const [light, dark] = [...css.matchAll(/--lp-bg: (#[0-9a-f]{6});/g)].map((match) => match[1]!);
    for (const token of Object.values(VERDICT_TOKENS)) {
      expect(contrast(stamped(token.light, light!), light!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(stamped(token.dark, dark!), dark!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
