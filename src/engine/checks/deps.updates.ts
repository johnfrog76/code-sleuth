import type { Check, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { readPackageJson } from "../manifest.js";

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
    const configured =
      repo.files.some((path) => UPDATE_CONFIG.test(path)) || readPackageJson(repo)?.renovate !== undefined;
    return configured ? { verdict: "clean" } : { verdict: "found", evidence: [] };
  },
};
