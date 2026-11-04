import { homedir } from "node:os";
import { sep } from "node:path";
import { copy as caseCopy } from "../case/copy.js";
import type { CaseRecord } from "../case/record.js";
import type { RepoInfo } from "../case/repoInfo.js";
import type { CheckOutcome } from "../engine/engine.js";
import { copy } from "./copy.js";

type Group = "smoking-gun" | "loose-end" | "hunch" | "clean" | "not-investigated";
const GROUPS: readonly Group[] = ["smoking-gun", "loose-end", "hunch", "clean", "not-investigated"];

/** ANSI styles, used only where the terminal takes them. Every line also carries its word, so colour is never the only signal. */
const STYLE: Record<Group | "stamp", string> = {
  "smoking-gun": "\x1b[1;31m",
  "loose-end": "\x1b[33m",
  hunch: "\x1b[36m",
  clean: "\x1b[32m",
  "not-investigated": "\x1b[2m",
  stamp: "\x1b[1m",
};
const RESET = "\x1b[0m";

export interface Painter {
  (style: keyof typeof STYLE, text: string): string;
}

export function painter(color: boolean): Painter {
  return (style, text) => (color ? `${STYLE[style]}${text}${RESET}` : text);
}

/** A path under the home folder, written from `~`. */
export function tilde(path: string, home = homedir()): string {
  return path === home || path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}

export function header(
  id: string,
  repo: RepoInfo,
  goal: string,
  leads: number,
  asked: boolean,
  /** Every call this run will make off the machine, named before any is made: the checks' and the polish request. */
  outgoing: readonly string[],
): string {
  const lines = [copy.run.title(id), ""];
  if (!asked) lines.push(copy.run.question, "");
  lines.push(
    `  ${copy.run.repo}  ${caseCopy.repoLine(repo.name, repo.branch, repo.head, repo.dirty, repo.partialClone === true)}`,
    `  ${copy.run.goal}  ${caseCopy.goal[goal] ?? goal}`,
    ...(outgoing.length === 0
      ? [`  ${copy.run.out}   ${copy.run.nothingLeaves}`]
      : outgoing.map((call, i) => `  ${i === 0 ? copy.run.out : "   "}   ${call}`)),
    "",
    copy.run.stakeout(leads),
  );
  return lines.join("\n");
}

/** The verdict, the checklist grouped as case.md groups it, and where the case went. */
export function report(
  record: CaseRecord,
  outcomes: readonly CheckOutcome[],
  where: { casePath: string; all: boolean },
  paint: Painter,
): string {
  const verdict = `${paint("stamp", caseCopy.stamp[record.verdict])}  ${caseCopy.verdictLine(record.goal, record.verdict, record.counts)}`;
  const width = Math.max(...outcomes.map((o) => o.check.id.length)) + 3;
  const lines = ["", verdict, ...(record.verdict === "ready" ? [caseCopy.yourCall] : []), ""];
  for (const group of GROUPS) {
    const members = outcomes.filter((o) => groupOf(o) === group);
    if (members.length === 0) continue;
    lines.push(paint(group, caseCopy.groups[group]));
    // Clean shows one line and counts the rest, but a clean check with uncounted examples always gets its
    // own line: an example match is never counted and never hidden.
    const withExamples = members.filter((o) => o.examples.length > 0);
    const plain = members.filter((o) => o.examples.length === 0);
    const shown = group === "clean" ? [...withExamples, ...plain.slice(0, 1)] : members;
    shown.forEach((outcome, i) => {
      const box = group === "clean" ? "[x]" : "[ ]";
      let line = `  ${box} ${outcome.check.id.padEnd(width)}${finding(outcome)}`;
      if (group === "clean" && i === shown.length - 1 && plain.length > 1)
        line += copy.run.andMore(plain.length - 1);
      lines.push(line);
    });
  }
  const cards = record.checks.filter((c) => c.card !== undefined).length;
  const hunches = record.counts.hunch > 0 && !where.all;
  lines.push(
    "",
    `${copy.run.caseFile}  ${tilde(`${where.casePath}${sep}case.md`)}`,
    `${copy.run.cards}      ${cards === 0 ? copy.run.noCards : copy.run.cardsIn(cards)}${hunches ? copy.run.hunchCards : ""}`,
  );
  return lines.join("\n") + "\n";
}

function groupOf(outcome: CheckOutcome): Group {
  return outcome.result.verdict === "found" ? outcome.weight : outcome.result.verdict;
}

function finding({ check, result, examples }: CheckOutcome): string {
  if (result.verdict === "clean")
    return examples.length === 0 ? check.voice.clean : caseCopy.examples.clean(examples.length);
  if (result.verdict === "not-investigated") return result.reason;
  const also = examples.length === 0 ? "" : caseCopy.examples.alsoFound(examples.length);
  const [first] = result.evidence;
  if (first === undefined) return check.voice.found + also;
  const at = first.line === undefined ? first.path : `${first.path}:${first.line}`;
  return `${check.voice.found} ${copy.run.at(at, result.evidence.length - 1)}${also}`;
}
