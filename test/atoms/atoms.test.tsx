import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCKUP_INK,
  LogoLockup,
  LogoMark,
  POSES,
  SleuthAtom,
  STAMP_INK,
  StampAtom,
  THEMES,
} from "../../src/atoms/atoms.js";
import { P } from "../../src/atoms/figures.js";

/** WCAG relative luminance and contrast ratio, from #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

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
  ...(["READY", "NEARLY", "NOT READY"] as const).flatMap((word): [string, React.ReactElement][] => [
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
    expect(render(<StampAtom word="NEARLY" title="T" />)).toContain(">NEARLY<");
    expect(render(<LogoLockup title="T" name="Some Name" />)).toContain(">Some Name<");
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

  it.each(themes)("the stamp's word reads on %s, at 4.5 : 1 or more", (theme) => {
    expect(contrast(STAMP_INK[theme], THEMES[theme])).toBeGreaterThanOrEqual(4.5);
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
