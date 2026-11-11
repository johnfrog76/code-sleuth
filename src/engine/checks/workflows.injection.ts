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

/**
 * The `github` fields a stranger writes: titles, bodies, comments, branch names, commit messages and authors. An
 * index is bounded, so an unclosed `[` is not retried to the end of the line from every `pages[` in it. The cost:
 * an index longer than 200 characters is not read as one, so that expression reads clean. A real index is a
 * number, `*` or a short expression.
 */
const STRANGER = new RegExp(
  "github\\.(?:head_ref|event\\.(?:" +
    [
      "issue\\.(?:title|body)",
      "pull_request\\.(?:title|body|head\\.(?:ref|label|repo\\.default_branch))",
      "(?:comment|review|review_comment)\\.body",
      "discussion\\.(?:title|body)",
      "pages(?:\\[[^\\]]{0,200}\\]|\\.\\*)\\.page_name",
      "commits(?:\\[[^\\]]{0,200}\\]|\\.\\*)\\.(?:message|author\\.(?:email|name))",
      "head_commit\\.(?:message|author\\.(?:email|name))",
      "workflow_run\\.(?:head_branch|head_commit\\.(?:message|author\\.(?:email|name)))",
    ].join("|") +
    "))\\b",
);
/**
 * The text of each `${{ ... }}` in a line, as `/\$\{\{([^}]*)\}\}/g` reads it: from a `${{` to the first `}`,
 * which must be the first of `}}`. By hand, and linear: every `${{` before that `}` stops at it too, so when it
 * is not `}}` the search goes on after it, where the pattern retried it from each one.
 */
export function expressions(line: string): string[] {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const open = line.indexOf("${{", from);
    if (open < 0) return found;
    const close = line.indexOf("}", open + 3);
    if (close < 0) return found;
    if (line[close + 1] === "}") {
      found.push(line.slice(open + 3, close));
      from = close + 2;
    } else from = close + 1;
  }
}

/** `github.event['issue']["title"]` read as `github.event.issue.title`: the same field, in index syntax. */
function dotted(expression: string): string {
  return expression.replace(/\[\s*(['"])([\w-]+)\1\s*\]/g, ".$2");
}

export const workflowsInjection: Check = {
  id: "workflows.injection",
  title: "Untrusted input in a workflow's shell",
  booksName: "script injection",
  needs: [],
  voice: voices["workflows.injection"],
  card: cards["workflows.injection"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    let skipped: Skipped | undefined;
    for (const workflow of readWorkflows(repo)) {
      for (const step of workflow.steps) {
        (step.run ?? "").split("\n").forEach((text, i) => {
          if (text.length > MAX_WORKFLOW_LINE) {
            skipped ??= { path: workflow.path, line: lineInRun(step, i) };
            return;
          }
          if (expressions(text).some((expression) => STRANGER.test(dotted(expression)))) {
            evidence.push({
              path: workflow.path,
              line: lineInRun(step, i),
              excerpt: excerptOf(text, workflow.path),
            });
          }
        });
      }
    }
    return evidence.length === 0 ? cleanOrUnreadable(repo, skipped) : { verdict: "found", evidence };
  },
};
