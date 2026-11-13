import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCKUP_INK,
  LogoLockup,
  LogoMark,
  POSES,
  SleuthAtom,
  stampInk,
  StampAtom,
  THEMES,
} from "../../src/atoms/atoms.js";
import { P, VERDICT_TOKENS, type Verdict } from "../../src/atoms/figures.js";
import { contrast, stamped } from "../helpers/contrast.js";

/** Renders an atom, failing on any warning React prints while it does. */
function render(element: React.ReactElement): string {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const markup = renderToStaticMarkup(element);
  expect(errors).not.toHaveBeenCalled();
  return markup;
}
afterEach(() => vi.restoreAllMocks());

const atoms: [string, React.ReactElement][] = [
  ...POSES.map((pose): [string, React.ReactElement] => [
    `the sleuth, ${pose}`,
    <SleuthAtom pose={pose} title={`The sleuth, ${pose}`} />,
  ]),
  ...POSES.map((pose): [string, React.ReactElement] => [
    `the sleuth, ${pose}, still`,
    <SleuthAtom pose={pose} title={`The sleuth, ${pose}`} still />,
  ]),
  ...(["MET", "NEARLY MET", "NOT MET"] as const).flatMap((word): [string, React.ReactElement][] => [
    [`the stamp, ${word}`, <StampAtom word={word} title={word} />],
    [`the stamp, ${word}, dark and still`, <StampAtom word={word} title={word} theme="dark" still />],
  ]),
  ["the mark", <LogoMark title="Code Sleuth" />],
  ["the mark at 16 px", <LogoMark title="Code Sleuth" size={16} />],
  ["the lockup, light", <LogoLockup title="Code Sleuth" name="Code Sleuth" />],
  ["the lockup, dark", <LogoLockup title="Code Sleuth" name="Code Sleuth" theme="dark" />],
];

describe.each(atoms)("%s", (_, element) => {
  it("renders as a standalone SVG, with a title for screen readers and no warning", () => {
    const markup = render(element);
    expect(markup).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[-\d. ]+"/);
    expect(markup).toContain('role="img"');
    expect(markup).toMatch(/<title>[^<]+<\/title>/);
  });
});

describe("the atoms", () => {
  it("have the five poses of the design, and holding-page as reading's variant", () => {
    expect(POSES).toEqual(["hanging", "reading", "holding-page", "pointing", "holding-door", "tipping-hat"]);
  });

  it("carry no words in the art: a figure's only text is its title", () => {
    for (const pose of POSES) {
      const markup = render(<SleuthAtom pose={pose} title="T" still />);
      expect(markup.replace(/<title>T<\/title>/, "")).not.toMatch(/<text/);
    }
    expect(render(<LogoMark title="T" />)).not.toMatch(/<text/);
  });

  it("take every word a surface shows as a prop", () => {
    expect(render(<StampAtom word="NEARLY MET" title="T" />)).toContain(">NEARLY MET<");
    expect(render(<LogoLockup title="T" name="Some Name" />)).toContain(">Some Name<");
  });

  // #103: drawn in a font wider than Helvetica Neue, the name ran past the canvas and lost its last letter.
  it("draw the name to a set width inside the canvas, whatever font the machine has", () => {
    const markup = render(<LogoLockup title="T" name="Code Sleuth" />);
    const [, minX, , width] = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+)/.exec(markup)!.map(Number);
    const text = /<text x="([\d.]+)"[^>]*textLength="([\d.]+)" lengthAdjust="spacingAndGlyphs"/.exec(markup);
    expect(text).not.toBeNull();
    expect(Number(text![1]) + Number(text![2])).toBeLessThan(minX! + width! - 8);
    expect(render(<LogoLockup title="T" name="A much longer name than ours" />)).toContain(
      'textLength="607"',
    );
  });

  it("still means still: no keyframes, no breathing", () => {
    const markup = render(<SleuthAtom pose="reading" title="T" still />);
    expect(markup).not.toContain("@keyframes");
    expect(markup).not.toContain("cs-breathe");
  });
});

describe("contrast, on both themes", () => {
  const themes = ["light", "dark", "office"] as const;

  it.each(themes)("the figure has a large part that stands out on %s, at 3 : 1 or more", (theme) => {
    // Light reads by the hat and the eye stripes; dark by the face and the coat.
    const parts = [P.fedora, P.stripe, P.face, P.trench];
    expect(Math.max(...parts.map((c) => contrast(c, THEMES[theme])))).toBeGreaterThanOrEqual(3);
    expect(parts.filter((c) => contrast(c, THEMES[theme]) >= 3).length).toBeGreaterThanOrEqual(2);
  });

  const verdicts = Object.keys(VERDICT_TOKENS) as Verdict[];

  it.each(themes)("each stamp's word reads on %s, at 4.5 : 1 or more as stamped", (theme) => {
    for (const word of verdicts) {
      expect(contrast(stamped(stampInk(word, theme), THEMES[theme]), THEMES[theme])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it.each(themes)("the three stamps wear three colours on %s", (theme) => {
    expect(new Set(verdicts.map((word) => stampInk(word, theme))).size).toBe(3);
  });

  it("draws a stamp in its verdict's ink, and an auto stamp carries its tokens", () => {
    expect(render(<StampAtom word="MET" title="T" still />)).toContain(VERDICT_TOKENS.MET.light);
    const auto = render(<StampAtom word="MET" title="T" still theme="auto" />);
    expect(auto).toContain("var(--verdict-met)");
    expect(auto).toContain(VERDICT_TOKENS.MET.dark);
    expect(auto).toContain("prefers-color-scheme: dark");
  });

  it.each(themes)("the lockup's name reads on %s, at 4.5 : 1 or more", (theme) => {
    expect(contrast(LOCKUP_INK[theme], THEMES[theme])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the figures file", () => {
  it("imports nothing but React, and says where it was drawn", () => {
    const source = readFileSync(new URL("../../src/atoms/figures.tsx", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports).toEqual(["react"]);
    expect(source).toContain("drawn for the Code Sleuth deck and taken whole as the product's atoms");
  });
});
