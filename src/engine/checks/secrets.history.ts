import type { Check, Evidence, Result } from "../check.js";
import { cards, historyPartial, historyShallow, historyUnreadable, voices } from "../copy.js";
import { SKIPPED_FOLDERS } from "../repo.js";
import { blockFrom, scanLine } from "../secrets/scan.js";

export const secretsHistory: Check = {
  id: "secrets.history",
  title: "Secrets in the history",
  booksName: "credential in version control history",
  needs: ["git"],
  voice: voices["secrets.history"],
  card: cards["secrets.history"],
  run(repo, context): Result {
    // A partial clone holds only part of the history, and the rest is never fetched: say so, rather than read part.
    if (repo.isPartialClone) return { verdict: "not-investigated", reason: historyPartial };
    // A shallow clone holds the history from its cut on: what was added and removed before it is not here.
    if (repo.isShallow) return { verdict: "not-investigated", reason: historyShallow };
    const added = repo.addedLines();
    if (added === undefined) return { verdict: "not-investigated", reason: historyUnreadable };
    const kept = added.filter(({ path }) => !path.split("/").some((part) => SKIPPED_FOLDERS.includes(part)));

    const evidence: Evidence[] = [];
    const seen = new Set<string>();
    kept.forEach(({ commit, path, line, text }, i) => {
      const block = () => {
        // The lines this commit added to this file, in a run from here: the private key's block.
        const run: string[] = [];
        for (let j = i; j < kept.length; j++) {
          const next = kept[j]!;
          if (next.commit !== commit || next.path !== path || next.line !== line + (j - i)) break;
          run.push(next.text);
        }
        return blockFrom(run, 0);
      };
      for (const piece of scanLine(text, path, line, context, { commit, block })) {
        // The oldest commit that added a secret to a file is the one that matters; later copies say nothing new.
        const key = `${piece.rule}\0${piece.valueHash}\0${path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        evidence.push(piece);
      }
    });
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
