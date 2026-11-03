import type { Check, Evidence } from "../check.js";
import { cards, voices } from "../copy.js";
import { excerptOf } from "../files.js";
import { lineInRun, readWorkflows } from "../workflows.js";

/** The `github` fields a stranger writes: titles, bodies, comments, branch names, commit messages and authors. */
const STRANGER = new RegExp(
  "github\\.(?:head_ref|event\\.(?:" +
    [
      "issue\\.(?:title|body)",
      "pull_request\\.(?:title|body|head\\.(?:ref|label|repo\\.default_branch))",
      "(?:comment|review|review_comment)\\.body",
      "discussion\\.(?:title|body)",
      "pages(?:\\[[^\\]]*\\]|\\.\\*)\\.page_name",
      "commits(?:\\[[^\\]]*\\]|\\.\\*)\\.(?:message|author\\.(?:email|name))",
      "head_commit\\.(?:message|author\\.(?:email|name))",
      "workflow_run\\.(?:head_branch|head_commit\\.(?:message|author\\.(?:email|name)))",
    ].join("|") +
    "))\\b",
);
const EXPRESSION = /\$\{\{([^}]*)\}\}/g;

export const workflowsInjection: Check = {
  id: "workflows.injection",
  title: "Untrusted input in a workflow's shell",
  booksName: "script injection",
  needs: [],
  voice: voices["workflows.injection"],
  card: cards["workflows.injection"],
  run(repo) {
    const evidence: Evidence[] = [];
    for (const workflow of readWorkflows(repo)) {
      for (const step of workflow.steps) {
        (step.run ?? "").split("\n").forEach((text, i) => {
          if ([...text.matchAll(EXPRESSION)].some((m) => STRANGER.test(m[1]!))) {
            evidence.push({ path: workflow.path, line: lineInRun(step, i), excerpt: excerptOf(text) });
          }
        });
      }
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
