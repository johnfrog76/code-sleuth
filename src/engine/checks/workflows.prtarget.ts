import type { Check, Evidence } from "../check.js";
import { cards, voices } from "../copy.js";
import { excerptOf } from "../files.js";
import { readWorkflows } from "../workflows.js";

/** An expression or ref that names the pull request's own code, which a stranger wrote. */
const HEAD = /github\.event\.pull_request\.head\.(?:sha|ref|repo\.full_name)|github\.head_ref|refs\/pull\//;
const RUN_CHECKOUT =
  /\bgh\s+pr\s+checkout\b|\bgit\s+(?:fetch|checkout|switch)\b.*(?:github\.event\.pull_request\.head|github\.head_ref|refs\/pull\/)/;

export const workflowsPrtarget: Check = {
  id: "workflows.prtarget",
  title: "pull_request_target with the pull request's code",
  booksName: "pwn request",
  needs: [],
  voice: voices["workflows.prtarget"],
  card: cards["workflows.prtarget"],
  run(repo) {
    const evidence: Evidence[] = [];
    for (const workflow of readWorkflows(repo)) {
      if (!workflow.events.includes("pull_request_target")) continue;
      for (const step of workflow.steps) {
        const checkout = step.uses?.toLowerCase().startsWith("actions/checkout") ?? false;
        const values = Object.entries(step.with ?? {}).filter(
          ([key]) => key === "ref" || key === "repository",
        );
        const fromWith = checkout
          ? values.find(([, value]) => typeof value === "string" && HEAD.test(value))
          : undefined;
        if (fromWith) {
          evidence.push({
            path: workflow.path,
            line: step.line,
            excerpt: excerptOf(`${fromWith[0]}: ${String(fromWith[1])}`),
          });
        } else if (step.run !== undefined && RUN_CHECKOUT.test(step.run)) {
          const line = step.run.split("\n").find((l) => RUN_CHECKOUT.test(l))!;
          evidence.push({ path: workflow.path, line: step.line, excerpt: excerptOf(line) });
        }
      }
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
