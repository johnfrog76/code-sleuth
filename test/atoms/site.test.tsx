import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JUNGLE_TOKENS, VERDICT_TOKENS, jungleCss, verdictCss } from "../../src/atoms/figures.js";
import { contrast, stamped } from "../helpers/contrast.js";

// The project's page wears the verdict tokens: its stamps and its CSS read them, and nothing types a colour in.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const page = read("site/index.html");
const css = read("site/site.css");

/** A block's custom properties, `--name: value;`, by name. */
function properties(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

/** The page's tokens in one appearance: the jungle's, then site.css's own, the dark block over the light one. */
function tokens(appearance: "light" | "dark"): (name: string) => string {
  const light = css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"));
  const dark = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/.exec(css)![1]!;
  const jungle = Object.fromEntries(Object.values(JUNGLE_TOKENS).map((token) => [token.name, token.value]));
  const all: Record<string, string> = {
    ...jungle,
    ...properties(light),
    ...(appearance === "dark" ? properties(dark) : {}),
  };
  const resolve = (name: string): string => {
    const value = all[name];
    if (value === undefined) throw new Error(`no token ${name}`);
    const ref = /^var\((--[a-z-]+)\)$/.exec(value);
    return ref ? resolve(ref[1]!) : value;
  };
  return resolve;
}

/** `rgba(r, g, b, a)` laid over a #rrggbb background, as #rrggbb. */
function over(rgba: string, behind: string): string {
  const [r, g, b, a] = /rgba\(([^)]+)\)/.exec(rgba)![1]!.split(",").map(Number);
  return `#${[r!, g!, b!]
    .map((fg, i) => Math.round(fg * a! + parseInt(behind.slice(1 + 2 * i, 3 + 2 * i), 16) * (1 - a!)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

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

  it("takes its jungle from the deck's palette, with no brown token left", () => {
    expect(read("site/tokens.css")).toContain(jungleCss());
    const named: string[] = [
      ...Object.values(VERDICT_TOKENS).flatMap((token) => [token.light, token.dark]),
      ...Object.values(JUNGLE_TOKENS).map((token) => token.value),
    ];
    const typed = [...read("site/tokens.css").matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0]);
    expect(typed.filter((hex) => !named.includes(hex))).toEqual([]);
    expect(JUNGLE_TOKENS).toMatchObject({
      canopy: { value: "#2f8a44" },
      canopyLit: { value: "#8fd45e" },
      canopyDeep: { value: "#145232" },
      canopyNight: { value: "#0b2e1e" },
      dusk: { value: "#2e4e5c" },
      duskDeep: { value: "#0f2a2c" },
    });
  });

  it("types a colour only where it names a token", () => {
    const lines = css.split("\n").filter((line) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(line));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !/^\s*--[a-z-]+:/.test(line))).toEqual([]);
  });

  it("meets AA for its words on every background they sit on, in both appearances", () => {
    for (const appearance of ["light", "dark"] as const) {
      const t = tokens(appearance);
      // The page's own ground: body text, the muted words and the links, on the page and on a panel.
      for (const ground of [t("--lp-bg"), t("--lp-panel")])
        for (const ink of ["--lp-text", "--lp-muted", "--lp-accent"])
          expect(contrast(t(ink), ground), `${appearance} ${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      // The banner's dark jungle: each stop of its gradient, and the first under its glow.
      const jungle = [t("--jungle-dusk"), t("--jungle-canopy-deep"), t("--jungle-canopy-night")];
      for (const ground of [...jungle, over(t("--lp-glow"), t("--jungle-dusk"))])
        for (const ink of ["--lp-on-jungle", "--lp-on-jungle-muted"])
          expect(contrast(t(ink), ground), `${appearance} ${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      // The primary button, at rest and hovered; and the bubble over the window.
      for (const ground of [t("--lp-cta"), t("--lp-cta-hover")])
        expect(contrast(t("--lp-cta-text"), ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("--lp-bubble-text"), t("--lp-bubble"))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
