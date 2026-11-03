/**
 * The small sloth banner, opening `code-sleuth --help` only. Cut from the character drawn in
 * design/archive/the-sloth-in-ascii.md ("The small banner"); a test holds it to that block byte for byte.
 * Plain text, no colour. The art has backticks in it, so it is ordinary strings with every backslash doubled.
 */
export const BANNER_LINES: readonly string[] = [
  '       _.-""""""""-._',
  "   .--'______________'--.",
  "   `-----------.-'''''-.",
  "     |  (o)   / (  O  ) \\",
  "     |  ///  |  \\\\\\\\\\\\\\  |",
  "     | //  .- \\  \\\\\\\\\\  /",
  "      \\    `-  `-.___.-'\\ \\",
  "       '-.____          ( ( (",
];

export const BANNER = BANNER_LINES.join("\n") + "\n";
