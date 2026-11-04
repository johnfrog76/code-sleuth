import type { Check, Result } from "../check.js";
import { cards, unreadableReasons, voices } from "../copy.js";
import { manifestOf, readManifest } from "../manifest.js";

const UPDATE_CONFIG =
  /^(?:\.github\/dependabot\.ya?ml|(?:\.github\/|\.gitlab\/)?renovate\.json5?|\.renovaterc(?:\.json5?)?)$/i;

export const depsUpdates: Check = {
  id: "deps.updates",
  title: "Automated dependency updates",
  booksName: "dependency management",
  needs: [],
  voice: voices["deps.updates"],
  card: cards["deps.updates"],
  run(repo): Result {
    if (repo.files.some((path) => UPDATE_CONFIG.test(path))) return { verdict: "clean" };
    const read = readManifest(repo);
    // A Renovate setting could be in the package.json nobody read.
    if (read.state === "unreadable")
      return { verdict: "not-investigated", reason: unreadableReasons.manifest(read.path) };
    return manifestOf(read)?.renovate !== undefined
      ? { verdict: "clean" }
      : { verdict: "found", evidence: [] };
  },
};
