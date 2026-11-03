import { COMMIT_MESSAGE, type Evidence } from "../engine/check.js";
import type { CheckOutcome } from "../engine/engine.js";
import { copy } from "./copy.js";

/** A card body fits the agent bridge's 4,096-character limit on one parameter, with room to spare. */
export const CARD_BODY_LIMIT = 3500;
export const CARD_EVIDENCE_LIMIT = 20;
export const CARD_TITLE_LIMIT = 80;

export interface Card {
  /** `cards/01-add-a-code-of-conduct.md`, relative to the case folder. */
  file: string;
  type: "Bug" | "Task";
  title: string;
  /** Everything after the heading: what a tracker card's description takes. No `##` heading in it. */
  body: string;
}

export interface CardInput {
  outcome: CheckOutcome;
  order: number;
  goal: string;
  caseId: string;
  head: string | null;
}

/** Renders a found check as a card: a smoking gun is a Bug, a loose end or a hunch a Task. */
export function renderCard({ outcome, order, goal, caseId, head }: CardInput): Card {
  const { check, weight, result } = outcome;
  if (result.verdict !== "found") throw new Error(`Only a found check makes a card: ${check.id}`);
  const title = check.card.title;
  if (title.length > CARD_TITLE_LIMIT)
    throw new Error(`A card title is over ${CARD_TITLE_LIMIT} characters: ${check.id}`);

  const evidence = result.evidence;
  let shown = Math.min(evidence.length, CARD_EVIDENCE_LIMIT);
  let body = cardBody(check, goal, caseId, head, evidence, shown);
  while (body.length > CARD_BODY_LIMIT && shown > 0)
    body = cardBody(check, goal, caseId, head, evidence, --shown);
  if (body.length > CARD_BODY_LIMIT)
    throw new Error(`A card body is over ${CARD_BODY_LIMIT} characters: ${check.id}`);

  return {
    file: `cards/${String(order).padStart(2, "0")}-${slug(title)}.md`,
    type: weight === "smoking-gun" ? "Bug" : "Task",
    title,
    body,
  };
}

/** The whole markdown card: its own heading, then the body. */
export function cardFile(card: Card): string {
  return `# ${card.type}: ${card.title}\n\n${card.body}\n`;
}

function cardBody(
  check: CheckOutcome["check"],
  goal: string,
  caseId: string,
  head: string | null,
  evidence: readonly Evidence[],
  shown: number,
): string {
  const parts: string[] = [check.voice.found];
  if (evidence.length > 0) {
    const lines = evidence.slice(0, shown).map(evidenceLine);
    if (shown < evidence.length) lines.push(`- ${copy.card.more(evidence.length - shown)}`);
    parts.push([copy.card.evidence, ...lines].join("\n"));
  }
  parts.push(copy.card.booksName(check.booksName));
  parts.push(`${copy.card.fix}\n${check.card.fix}`);
  const done = [...(check.card.doneWhen ?? []), copy.card.readsClean(goal, check.id)].map(
    (line) => `- [ ] ${line}`,
  );
  parts.push([copy.card.doneWhen, ...done].join("\n"));
  parts.push(copy.card.fingerprint(check.id, caseId, head));
  return parts.join("\n\n");
}

export function evidenceLine(evidence: Evidence): string {
  const where = evidence.line === undefined ? evidence.path : `${evidence.path}:${evidence.line}`;
  let line = `- ${codeSpan(where)}`;
  if (evidence.excerpt !== undefined) line += ` -- ${codeSpan(evidence.excerpt)}`;
  const notes = [
    evidence.rule === undefined ? undefined : copy.card.rule(evidence.rule),
    evidence.commit === undefined
      ? undefined
      : evidence.path === COMMIT_MESSAGE
        ? copy.card.inCommit(evidence.commit.slice(0, 7))
        : copy.card.addedIn(evidence.commit.slice(0, 7)),
    evidence.weighed === undefined ? undefined : copy.card.weighed[evidence.weighed],
  ].filter((note) => note !== undefined);
  if (notes.length > 0) line += ` (${notes.join("; ")})`;
  return line;
}

/** A markdown code span that holds any text, backticks included, on one line. */
export function codeSpan(text: string): string {
  const flat = text.replace(/\r?\n/g, " ");
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = longest > 0 || flat.startsWith(" ") || flat.endsWith(" ") ? " " : "";
  return `${fence}${pad}${flat}${pad}${fence}`;
}

/** Lower case, every run of anything but a-z and 0-9 one hyphen, at most 60 characters. */
export function slug(title: string): string {
  const full = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return full.slice(0, 60).replace(/-+$/, "");
}
