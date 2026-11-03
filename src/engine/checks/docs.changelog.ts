import type { Check } from "../check.js";
import { cards, voices } from "../copy.js";
import { findDoc } from "../files.js";

export const docsChangelog: Check = {
  id: "docs.changelog",
  title: "A changelog",
  booksName: "changelog",
  needs: [],
  voice: voices["docs.changelog"],
  card: cards["docs.changelog"],
  run: (repo) =>
    findDoc(repo, "CHANGELOG", [""]) === undefined
      ? { verdict: "found", evidence: [] }
      : { verdict: "clean" },
};
