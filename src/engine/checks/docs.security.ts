import type { Check } from "../check.js";
import { cards, voices } from "../copy.js";
import { COMMUNITY_FOLDERS, findDoc } from "../files.js";

export const docsSecurity: Check = {
  id: "docs.security",
  title: "A security policy",
  booksName: "vulnerability disclosure policy",
  needs: [],
  voice: voices["docs.security"],
  card: cards["docs.security"],
  run: (repo) =>
    findDoc(repo, "SECURITY", COMMUNITY_FOLDERS) === undefined
      ? { verdict: "found", evidence: [] }
      : { verdict: "clean" },
};
