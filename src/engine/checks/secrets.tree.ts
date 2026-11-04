import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { blockFrom, scanLine } from "../secrets/scan.js";

export const secretsTree: Check = {
  id: "secrets.tree",
  title: "Secrets in the working tree",
  booksName: "hard-coded credential",
  needs: [],
  voice: voices["secrets.tree"],
  card: cards["secrets.tree"],
  run(repo, context): Result {
    const evidence: Evidence[] = [];
    for (const path of repo.textFiles) {
      if (repo.isBinary(path)) continue;
      const lines = (repo.readText(path) ?? "").split(/\r?\n/);
      lines.forEach((text, i) => {
        evidence.push(...scanLine(text, path, i + 1, context, { block: () => blockFrom(lines, i) }));
      });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
