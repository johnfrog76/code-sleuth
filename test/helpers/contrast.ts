/** WCAG relative luminance, from #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio, from #rrggbb. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The colour a stamp's ink lands as: the stamp is drawn at 90% opacity over what is behind it. */
export function stamped(ink: string, behind: string): string {
  const mixed = [1, 3, 5].map((i) => {
    const [fg, bg] = [ink, behind].map((hex) => parseInt(hex.slice(i, i + 2), 16));
    return Math.round(fg! * 0.9 + bg! * 0.1)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${mixed.join("")}`;
}
