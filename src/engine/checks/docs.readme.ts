import type { Check, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { findDoc } from "../files.js";

/** A heading a stranger reads as "how do I start". */
const START_HEADING =
  /\b(?:install(?:ation|ing)?|usage|use|using|quick ?start|get(?:ting)? started|set ?up|run(?:ning)?|how to)\b/i;

export const MIN_README_LINES = 10;

/** No heading is longer than this; a longer line is read as text, never as a heading. */
export const MAX_HEADING_LINE = 4096;

/**
 * A `#` heading's text, by hand rather than by one pattern: up to three spaces, one to six `#`, a space, the
 * text, and an optional closing run of `#`. A pattern for it backtracks over every space on a long
 * line, and a README is the repository's to write.
 */
function atxHeading(line: string): string | undefined {
  let at = 0;
  while (at < 3 && /\s/.test(line[at] ?? "")) at++;
  let hashes = 0;
  while (line[at + hashes] === "#") hashes++;
  if (hashes < 1 || hashes > 6) return undefined;
  const rest = line.slice(at + hashes);
  if (!/^\s/.test(rest)) return undefined;
  let text = rest.trim();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end--;
  text = text.slice(0, end).trimEnd();
  return text;
}

/** The headings of a markdown, reStructuredText or plain README: `#` lines, underlined lines, `<h1>` to `<h6>`. */
export function headings(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (line.length > MAX_HEADING_LINE) return;
    const atx = atxHeading(line);
    if (atx !== undefined) found.push(atx);
    else if (
      line.trim() !== "" &&
      /^\s*(?:=+|-+|~+|\^+)\s*$/.test(lines[i + 1] ?? "") &&
      !/^\s*[-=~^]+\s*$/.test(line)
    ) {
      found.push(line.trim());
    }
    for (const html of line.matchAll(/<h[1-6][^<>]{0,200}>([^<]{0,500})<\/h[1-6]>/gi)) found.push(html[1]!);
  });
  return found;
}

export const docsReadme: Check = {
  id: "docs.readme",
  title: "A README that says how to start",
  booksName: "README",
  needs: [],
  voice: voices["docs.readme"],
  card: cards["docs.readme"],
  run(repo): Result {
    const path = findDoc(repo, "README", [""]);
    if (path === undefined) return { verdict: "found", evidence: [] };
    const text = repo.readText(path) ?? "";
    // trimEnd, not a /\s+$/ pattern: that one retries from every space of a long run, so it takes the square.
    const lines = text.trimEnd().split(/\r?\n/).length;
    if (text.trim() === "" || lines < MIN_README_LINES) {
      return {
        verdict: "found",
        evidence: [{ path, excerpt: `${text.trim() === "" ? 0 : lines} lines`, rule: "under-10-lines" }],
      };
    }
    if (!headings(text).some((heading) => START_HEADING.test(heading))) {
      return { verdict: "found", evidence: [{ path, rule: "no-start-heading" }] };
    }
    return { verdict: "clean" };
  },
};
