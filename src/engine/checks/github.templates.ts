import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { COMMUNITY_FOLDERS } from "../files.js";

/** Where GitHub reads an issue template: a folder of them, or the single file it read before forms. */
function hasIssueTemplate(files: readonly string[]): boolean {
  return files.some((path) => /^\.github\/issue_template(?:\/[^/]+|\.md)$/i.test(path));
}

/** Where GitHub reads a pull request template: the file, or a folder of them, at the root, in .github/ or docs/. */
function hasPullRequestTemplate(files: readonly string[]): boolean {
  return files.some((path) =>
    COMMUNITY_FOLDERS.some((folder) => {
      const base = folder === "" ? "" : `${folder}/`;
      const lower = path.toLowerCase();
      return (
        lower === `${base}pull_request_template.md` ||
        (lower.startsWith(`${base}pull_request_template/`) && !lower.slice(base.length + 22).includes("/"))
      );
    }),
  );
}

export const githubTemplates: Check = {
  id: "github.templates",
  title: "Issue and pull request templates",
  booksName: "issue templates",
  needs: [],
  voice: voices["github.templates"],
  card: cards["github.templates"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    if (!hasIssueTemplate(repo.files))
      evidence.push({ path: ".github/ISSUE_TEMPLATE/", rule: "no-issue-template" });
    if (!hasPullRequestTemplate(repo.files)) {
      evidence.push({ path: ".github/pull_request_template.md", rule: "no-pull-request-template" });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
