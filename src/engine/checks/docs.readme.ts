import type { Check } from "../check.js";
import { cards, voices } from "../copy.js";
import { findDoc } from "../files.js";

/** A heading a stranger reads as "how do I start". */
const START_HEADING =
  /\b(?:install(?:ation|ing)?|usage|use|using|quick ?start|get(?:ting)? started|set ?up|run(?:ning)?|how to)\b/i;

export const MIN_README_LINES = 10;

/** The headings of a markdown, reStructuredText or plain README: `#` lines, underlined lines, `<h1>` to `<h6>`. */
export function headings(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const found: string[] = [];
  lines.forEach((line, i) => {
    const atx = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (atx) found.push(atx[1]!);
    else if (
      line.trim() !== "" &&
      /^\s*(?:=+|-+|~+|\^+)\s*$/.test(lines[i + 1] ?? "") &&
      !/^\s*[-=~^]+\s*$/.test(line)
    ) {
      found.push(line.trim());
    }
    for (const html of line.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)) found.push(html[1]!);
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
  run(repo) {
    const path = findDoc(repo, "README", [""]);
    if (path === undefined) return { verdict: "found", evidence: [] };
    const text = repo.readText(path) ?? "";
    const lines = text.replace(/\s+$/, "").split(/\r?\n/).length;
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
