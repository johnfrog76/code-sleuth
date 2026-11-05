/**
 * Text from the repository, made safe to print to a terminal. A file's name, a branch, a manifest's license
 * field or an excerpt can hold control characters: ESC starts a sequence that can clear the screen, move the
 * cursor over a line already printed, or set the clipboard (OSC 52). C0 and C1 controls but the newline and the
 * tab, DEL, and the bidirectional overrides that reorder what a line shows, each become `?`.
 */
export function printable(text: string): string {
  return text.replace(UNPRINTABLE, "?");
}

// Built from code points, so this file holds no control character itself.
const UNPRINTABLE = new RegExp(
  `[${[
    [0x00, 0x08],
    [0x0b, 0x1f],
    [0x7f, 0x9f],
    [0x200e, 0x200f],
    [0x202a, 0x202e],
    [0x2066, 0x2069],
  ]
    .map(([from, to]) => `\\u{${from!.toString(16)}}-\\u{${to!.toString(16)}}`)
    .join("")}]`,
  "gu",
);

/**
 * What reaches the terminal, last of all: every escape sequence but the styles Code Sleuth itself paints with
 * (`allowed`) is taken out, as a second line behind `printable` where the repository's text goes in.
 */
export function terminalSafe(text: string, allowed: readonly string[]): string {
  if (allowed.length === 0) return printable(text);
  const known = new RegExp(`(${allowed.map((code) => code.replace(/[[\]\\^$.|?*+()]/g, "\\$&")).join("|")})`);
  return text
    .split(known)
    .map((piece, i) => (i % 2 === 1 ? piece : printable(piece)))
    .join("");
}
