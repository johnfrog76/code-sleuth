import { COMMIT_MESSAGE, type Check, type Evidence, type Result } from "../check.js";
import { cards, denyReasons, voices } from "../copy.js";
import { readableLines } from "../files.js";
import { isMarked } from "../examples.js";

/**
 * One whole-word, any-case pattern per line of the deny list, numbered by its line there. Blank lines and
 * `#` comments are not entries.
 */
export function denyPatterns(list: readonly string[]): { entry: number; pattern: RegExp }[] {
  return list.flatMap((raw, i) => {
    const word = raw.trim();
    if (word === "" || word.startsWith("#")) return [];
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [{ entry: i + 1, pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu") }];
  });
}

export const namesDeny: Check = {
  id: "names.deny",
  title: "Names on the deny list",
  booksName: "information disclosure",
  needs: ["denyList"],
  voice: voices["names.deny"],
  card: cards["names.deny"],
  run(repo, context): Result {
    const patterns = denyPatterns(context.denyList ?? []);
    // A finding names the deny list's line, never the word: the word is what must not leave the machine.
    const hits = (text: string) =>
      patterns.filter(({ pattern }) => pattern.test(text)).map(({ entry }) => `deny-list-line-${entry}`);

    const evidence: Evidence[] = [];
    for (const path of repo.textFiles) {
      readableLines(repo, path).forEach((text, i) => {
        for (const rule of hits(text)) {
          evidence.push({
            path,
            line: i + 1,
            rule,
            ...(isMarked(text) ? { marked: true as const } : {}),
          });
        }
      });
    }
    const messages = repo.commitMessages();
    for (const { commit, text } of messages ?? []) {
      text.split("\n").forEach((line, i) => {
        for (const rule of hits(line)) evidence.push({ path: COMMIT_MESSAGE, line: i + 1, commit, rule });
      });
    }
    if (evidence.length > 0) return { verdict: "found", evidence };
    // Clean would claim the commit messages too, and without git they were never read.
    if (messages === undefined) return { verdict: "not-investigated", reason: denyReasons.messagesUnread };
    return repo.isShallow
      ? { verdict: "not-investigated", reason: denyReasons.messagesShallow }
      : { verdict: "clean" };
  },
};
