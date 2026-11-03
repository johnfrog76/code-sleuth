import type { Check } from "../check.js";
import { cards, voices } from "../copy.js";
import { COMMUNITY_FOLDERS, findDoc } from "../files.js";

export const docsContributing: Check = {
  id: "docs.contributing",
  title: "A contributing guide",
  booksName: "contribution guidelines",
  needs: [],
  voice: voices["docs.contributing"],
  card: cards["docs.contributing"],
  run: (repo) =>
    findDoc(repo, "CONTRIBUTING", COMMUNITY_FOLDERS) === undefined
      ? { verdict: "found", evidence: [] }
      : { verdict: "clean" },
};
