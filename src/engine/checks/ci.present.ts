import type { Check, Result } from "../check.js";
import { cards, voices, workflowReasons } from "../copy.js";
import { readWorkflows } from "../workflows.js";

const CI_EVENTS = ["push", "pull_request"];

export const ciPresent: Check = {
  id: "ci.present",
  title: "Continuous integration",
  booksName: "continuous integration",
  needs: [],
  voice: voices["ci.present"],
  card: cards["ci.present"],
  run(repo): Result {
    const workflows = readWorkflows(repo);
    if (workflows.some(({ events }) => events.some((event) => CI_EVENTS.includes(event))))
      return { verdict: "clean" };
    // A workflow that does not parse may be the one that runs on push.
    const unreadable = workflows.find(({ readable }) => !readable);
    if (unreadable !== undefined)
      return { verdict: "not-investigated", reason: workflowReasons.unreadable(unreadable.path) };
    return {
      verdict: "found",
      evidence: workflows.map(({ path }) => ({ path, rule: "no-push-or-pull-request" })),
    };
  },
};
