import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { excerptOf, readableLines } from "../files.js";
import { LOCKFILES } from "./deps.lockfile.js";

// The words are built from pieces, so this file does not carry the markers it looks for.
const WORDS = [
  ["TO", "DO"],
  ["FIX", "ME"],
  ["HA", "CK"],
  ["X", "XX"],
].map((parts) => parts.join(""));
const MARKER = new RegExp(`\\b(${WORDS.join("|")})\\b`);
/** Where a comment starts, in the languages a repository is likely to hold. */
const COMMENT = /(?:\/\/|#|\/\*|^\s*\*|<!--|--|;)/;
/** Prose, where a marker word is a word, not a note to self. */
const PROSE = /\.(?:md|markdown|txt|rst|adoc)$/i;
/**
 * The JSON family. Plain JSON has no comments, but many `.json` files are JSONC by convention (`tsconfig.json`,
 * `.vscode/*.json`, `devcontainer.json`), and `.jsonc` and `.json5` allow them. In all of them `#` is never a
 * comment, and `//` or `/*` inside a string is not one either, so they are read with a scanner that knows
 * where the strings are.
 */
const JSON_FAMILY = /\.json[c5]?$/i;

/**
 * For each line of a JSON-family file, where its comment text starts: the column after a `//` or `/*` that is
 * outside any string, 0 for a line inside a block comment, or -1 for a line with no comment.
 */
export function jsonCommentStarts(lines: readonly string[]): number[] {
  let inBlock = false;
  return lines.map((line) => {
    let start = inBlock ? 0 : -1;
    let quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inBlock) {
        if (ch === "*" && line[i + 1] === "/") {
          inBlock = false;
          i++;
        }
      } else if (quote !== null) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "/" && line[i + 1] === "/") {
        if (start < 0) start = i + 2;
        break;
      } else if (ch === "/" && line[i + 1] === "*") {
        if (start < 0) start = i + 2;
        inBlock = true;
        i++;
      }
    }
    return start;
  });
}

export const qualityMarkers: Check = {
  id: "quality.markers",
  title: "Markers left in the code",
  booksName: "technical debt markers",
  needs: [],
  voice: voices["quality.markers"],
  card: cards["quality.markers"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    for (const path of repo.textFiles) {
      if (PROSE.test(path) || LOCKFILES.includes(path.split("/").at(-1)!)) continue;
      const lines = readableLines(repo, path);
      const jsonComments = JSON_FAMILY.test(path) ? jsonCommentStarts(lines) : undefined;
      lines.forEach((text, i) => {
        const marker = MARKER.exec(text);
        if (marker === null) return;
        const inComment =
          jsonComments === undefined
            ? COMMENT.test(text.slice(0, marker.index))
            : jsonComments[i]! >= 0 && marker.index >= jsonComments[i]!;
        if (inComment) {
          evidence.push({
            path,
            line: i + 1,
            excerpt: excerptOf(text, path),
            rule: marker[1]!,
          });
        }
      });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
