import type { Check } from "../check.js";
import { cards, voices } from "../copy.js";
import { COMMUNITY_FOLDERS, findDoc } from "../files.js";

export const docsConduct: Check = {
  id: "docs.conduct",
  title: "A code of conduct",
  booksName: "code of conduct",
  needs: [],
  voice: voices["docs.conduct"],
  card: cards["docs.conduct"],
  run: (repo) =>
    findDoc(repo, "CODE_OF_CONDUCT", COMMUNITY_FOLDERS) === undefined
      ? { verdict: "found", evidence: [] }
      : { verdict: "clean" },
};
