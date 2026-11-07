import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { excerptOf } from "../files.js";
import {
  cleanOrUnreadable,
  lineInRun,
  MAX_WORKFLOW_LINE,
  readWorkflows,
  type Skipped,
} from "../workflows.js";

/** An expression or ref that names the pull request's own code, which a stranger wrote. */
const HEAD =
  /github\.event\.pull_request\.(?:head\.(?:sha|ref|repo\.full_name)|merge_commit_sha)|github\.head_ref|refs\/pull\//;
const GH_CHECKOUT = /\bgh\s+pr\s+checkout\b/;
const GIT_CHECKOUT = /\bgit\s+(?:fetch|checkout|switch)\b/;
const HEAD_WORDS = /github\.event\.pull_request\.head|github\.head_ref|refs\/pull\//;

/**
 * A shell line that checks out the pull request's head: `gh pr checkout`, or a git fetch, checkout or switch
 * with the head's words after it. Two tests in a row, where one pattern with `.*` between them retried the rest
 * of the line from every `git fetch` in it; the head's words after the first command are after some command.
 */
export function runsHeadCheckout(line: string): boolean {
  if (GH_CHECKOUT.test(line)) return true;
  const command = GIT_CHECKOUT.exec(line);
  return command !== null && HEAD_WORDS.test(line.slice(command.index + command[0].length));
}

export const workflowsPrtarget: Check = {
  id: "workflows.prtarget",
  title: "pull_request_target with the pull request's code",
  booksName: "pwn request",
  needs: [],
  voice: voices["workflows.prtarget"],
  card: cards["workflows.prtarget"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    let skipped: Skipped | undefined;
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
            excerpt: excerptOf(`${fromWith[0]}: ${String(fromWith[1])}`, workflow.path),
          });
        } else if (step.run !== undefined) {
          const lines = step.run.split("\n");
          const long = lines.findIndex((l) => l.length > MAX_WORKFLOW_LINE);
          if (long >= 0) skipped ??= { path: workflow.path, line: lineInRun(step, long) };
          const line = lines.find((l) => l.length <= MAX_WORKFLOW_LINE && runsHeadCheckout(l));
          if (line !== undefined)
            evidence.push({ path: workflow.path, line: step.line, excerpt: excerptOf(line, workflow.path) });
        }
      }
    }
    return evidence.length === 0 ? cleanOrUnreadable(repo, skipped) : { verdict: "found", evidence };
  },
};
