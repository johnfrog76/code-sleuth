import type { CheckOutcome } from "../engine/engine.js";
import { codeSpan, inlineText } from "./card.js";
import { copy } from "./copy.js";
import { examplesLine } from "./examplesLine.js";
import { polishLine } from "./polishLine.js";
import { toolkitLine } from "./toolkitLine.js";
import type { CaseRecord, CheckRecord } from "./record.js";

type Group = keyof typeof copy.groups;

/** `case.md`: the verdict, the counts, then the checklist, grouped as the terminal groups it. */
export function renderCaseMd(record: CaseRecord, outcomes: readonly CheckOutcome[]): string {
  const voiceOf = new Map(outcomes.map((o) => [o.check.id, o.check.voice]));
  const lines: string[] = [
    `# Case ${record.case}`,
    "",
    `**${copy.stamp[record.verdict]}** -- ${copy.verdictLine(record.goal, record.verdict, record.counts)}`,
    ...(record.verdict === "ready" ? ["", copy.yourCall] : []),
    "",
    `- Repo: ${copy.repoLine(inlineText(record.repo.name), record.repo.branch === null ? null : inlineText(record.repo.branch), record.repo.head, record.repo.dirty, record.repo.partialClone === true)}`,
    `- Goal: ${copy.goal[record.goal] ?? record.goal}`,
    `- Counts: ${copy.countsLine(record.counts)}`,
  ];

  const order: Group[] = ["smoking-gun", "loose-end", "hunch", "clean", "not-investigated"];
  for (const group of order) {
    const members = record.checks.filter((c) => groupOf(c) === group);
    if (members.length === 0) continue;
    lines.push("", `## ${copy.groups[group]}`, "");
    for (const check of members) lines.push(checklistLine(check, voiceOf.get(check.id)!));
  }
  const examples = examplesLine(record);
  if (examples !== undefined) lines.push("", `Examples: ${examples}`);
  const polish = polishLine(record);
  if (polish !== undefined) lines.push("", `Polish: ${polish}`);
  if (record.enhancements?.toolkit !== undefined) {
    lines.push("", toolkitLine(record.enhancements.toolkit, record.goal, record.enhancements.toolkitSpace));
  }
  return lines.join("\n") + "\n";
}

function groupOf(check: CheckRecord): Group {
  return check.verdict === "found" ? check.weight! : check.verdict;
}

function checklistLine(check: CheckRecord, voice: { clean: string; found: string }): string {
  const box = check.verdict === "clean" ? "- [x]" : "- [ ]";
  const head = `${box} **${check.title}** (${codeSpan(check.id)}):`;
  const examples = check.examples?.length ?? 0;
  if (check.verdict === "clean")
    return `${head} ${examples === 0 ? voice.clean : copy.examples.clean(examples)}`;
  if (check.verdict === "not-investigated")
    return `${head} ${copy.notInvestigated(inlineText(check.reason!))}`;
  let line = `${head} ${voice.found}`;
  const [first] = check.evidence ?? [];
  if (first !== undefined) {
    const where = first.line === undefined ? first.path : `${first.path}:${first.line}`;
    line += copy.firstEvidence(codeSpan(where), check.evidence!.length - 1);
  }
  if (examples > 0) line += copy.examples.alsoFound(examples);
  if (check.card !== undefined) line += ` [${copy.cardLink}](${check.card})`;
  return line;
}
