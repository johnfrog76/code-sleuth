import type { Check, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { cleanOrUnreadable, readWorkflows } from "../workflows.js";

export const workflowsPermissions: Check = {
  id: "workflows.permissions",
  title: "Workflow token permissions",
  booksName: "least privilege",
  needs: [],
  voice: voices["workflows.permissions"],
  card: cards["workflows.permissions"],
  run(repo): Result {
    const evidence = readWorkflows(repo)
      .filter(({ readable, keys }) => readable && !keys.includes("permissions"))
      .map(({ path }) => ({ path, rule: "no-top-level-permissions" }));
    return evidence.length === 0 ? cleanOrUnreadable(repo) : { verdict: "found", evidence };
  },
};
