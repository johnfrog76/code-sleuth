import type { Check, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { readPackageJson } from "../manifest.js";
import { readWorkflows } from "../workflows.js";

/** The commands that run a project's tests, whatever the script inside them is. */
const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|npm\s+t\b|pytest\b|python3?\s+-m\s+(?:pytest|unittest)\b|tox\b|go\s+test\b|cargo\s+test\b)/;

/** npm's placeholder for a project with no tests. */
const NO_TESTS = /no test specified/;

export const ciTests: Check = {
  id: "ci.tests",
  title: "Tests in CI",
  booksName: "automated testing",
  needs: [],
  voice: voices["ci.tests"],
  card: cards["ci.tests"],
  run(repo): Result {
    const scripts = readPackageJson(repo)?.scripts;
    const test =
      typeof scripts === "object" && scripts !== null ? (scripts as Record<string, unknown>).test : undefined;
    const script =
      typeof test === "string" && test.trim() !== "" && !NO_TESTS.test(test) ? test.trim() : undefined;

    const workflows = readWorkflows(repo);
    const runsTests = workflows.some(({ runs }) =>
      runs.some(({ text }) => TEST_COMMAND.test(text) || (script !== undefined && text.includes(script))),
    );
    if (runsTests) return { verdict: "clean" };
    return { verdict: "found", evidence: workflows.map(({ path }) => ({ path, rule: "no-test-step" })) };
  },
};
