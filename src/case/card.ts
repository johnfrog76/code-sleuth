import { COMMIT_MESSAGE, type Evidence } from "../engine/check.js";
import type { CheckOutcome } from "../engine/engine.js";
import { EXCERPT_LIMIT } from "../engine/files.js";
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
  /** Every path and `path:line` the card's evidence lines cite: a rewrite must keep each one, verbatim. */
  cites?: readonly string[];
}

export interface CardInput {
  outcome: CheckOutcome;
  order: number;
  goal: string;
  caseId: string;
  head: string | null;
  /** Code Sleuth's own version, for the card's source line. */
  version: string;
}

/** Renders a found check as a card: a smoking gun is a Bug, a loose end or a hunch a Task. */
export function renderCard({ outcome, order, goal, caseId, head, version }: CardInput): Card {
  const { check, weight, result } = outcome;
  if (result.verdict !== "found") throw new Error(`Only a found check makes a card: ${check.id}`);
  const title = check.card.title;
  if (title.length > CARD_TITLE_LIMIT)
    throw new Error(`A card title is over ${CARD_TITLE_LIMIT} characters: ${check.id}`);

  const evidence = result.evidence;
  let shown = Math.min(evidence.length, CARD_EVIDENCE_LIMIT);
  const ids = { goal, caseId, head, version };
  let body = cardBody(check, ids, evidence, shown);
  while (body.length > CARD_BODY_LIMIT && shown > 0) body = cardBody(check, ids, evidence, --shown);
  if (body.length > CARD_BODY_LIMIT)
    throw new Error(`A card body is over ${CARD_BODY_LIMIT} characters: ${check.id}`);

  return {
    file: `cards/${String(order).padStart(2, "0")}-${slug(title)}.md`,
    type: weight === "smoking-gun" ? "Bug" : "Task",
    title,
    body,
    cites: evidence.slice(0, shown).map(whereOf),
  };
}

/** Where a piece of evidence is: its path, with `:line` when it has one. */
export function whereOf(evidence: Evidence): string {
  return evidence.line === undefined ? evidence.path : `${evidence.path}:${evidence.line}`;
}

/** The whole markdown card: its own heading, then the body. */
export function cardFile(card: Card): string {
  // The title is one line whatever it holds: a polished one comes back from a model.
  return `# ${card.type}: ${fileSafe(oneLine(card.title))}\n\n${card.body}\n`;
}

function cardBody(
  check: CheckOutcome["check"],
  { goal, caseId, head, version }: Omit<CardInput, "outcome" | "order">,
  evidence: readonly Evidence[],
  shown: number,
): string {
  const parts: string[] = [check.voice.found];
  if (evidence.length > 0) {
    // What the repository says stands under one fixed line, each excerpt fenced: it is quoted, never addressed
    // to whoever reads the card.
    const lines = evidence.slice(0, shown).map(evidenceLine);
    if (shown < evidence.length) lines.push(`- ${copy.card.more(evidence.length - shown)}`);
    parts.push([copy.card.evidence, copy.card.quoted, ...lines].join("\n"));
  }
  parts.push(copy.card.booksName(check.booksName));
  parts.push(`${copy.card.fix}\n${check.card.fix}`);
  const done = [...(check.card.doneWhen ?? []), copy.card.readsClean(goal, check.id)].map(
    (line) => `- [ ] ${line}`,
  );
  parts.push([copy.card.doneWhen, ...done].join("\n"));
  parts.push(copy.card.source(version));
  parts.push(copy.card.fingerprint(check.id, caseId, head));
  return parts.join("\n\n");
}

/** One piece of evidence: where it is and its notes on one list line, then its excerpt, if any, fenced under it. */
export function evidenceLine(evidence: Evidence): string {
  let line = `- ${codeSpan(whereOf(evidence))}`;
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
  if (evidence.excerpt !== undefined && evidence.excerpt !== "")
    line += `\n${fenced(evidence.excerpt, "  ")}`;
  return line;
}

/**
 * An excerpt as a fenced block of text, on one line, file-safe, and at most EXCERPT_LIMIT characters: a longer
 * one is cut there and ends with `...`. The fence is longer than any run of backticks in it, so nothing in the
 * excerpt can close it. `indent` puts it inside a list item.
 */
export function fenced(text: string, indent = ""): string {
  const chars = [...fileSafe(oneLine(text))];
  const flat =
    chars.length <= EXCERPT_LIMIT ? chars.join("") : `${chars.slice(0, EXCERPT_LIMIT).join("")}...`;
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}text`, flat, fence].map((l) => `${indent}${l}`).join("\n");
}

/**
 * A markdown code span that holds any text, backticks included, on one line (a lone CR is a line break too),
 * file-safe.
 */
export function codeSpan(text: string): string {
  const flat = fileSafe(oneLine(text));
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = longest > 0 || flat.startsWith(" ") || flat.endsWith(" ") ? " " : "";
  return `${fence}${pad}${flat}${pad}${fence}`;
}

/** Text on one line: every line break, CRLF, LF or a lone CR (which lf() would turn into an LF), a space. */
export function oneLine(text: string): string {
  return text.replace(/\r\n|\r|\n|\u2028|\u2029/g, " ");
}

/**
 * Text from the repository, written into markdown prose as text and nothing else: on one line, so it cannot
 * start a heading or a checklist line of its own, and with every character markdown or HTML would read as
 * markup escaped, so it cannot open a link, a tag, an image or emphasis. A file's name, a branch, a reason
 * that quotes one.
 */
export function inlineText(text: string): string {
  return fileSafe(oneLine(text)).replace(/[\\`*_[\]<>~!|#]/g, (ch) => `\\${ch}`);
}

/**
 * Text from the repository, kept as data in a file a person or a program reads: the case file, a card, the
 * polish request, a ToolKit card. C0 controls but the tab, DEL, C1 controls, the bidirectional controls and every
 * invisible format character (`\p{Cf}`, the line and paragraph separators) each become U+FFFD. The one function
 * for every side: what goes out and what comes back from polish go through it alike, so the guard compares like
 * with like.
 */
export function fileSafe(text: string): string {
  return text.replace(UNSAFE, "\uFFFD");
}

/**
 * fileSafe on each line of a text whose line breaks are its own, as a card's body is. CRLF, CR and the line and
 * paragraph separators each read as LF, so a line break stays one, where a guard can see it.
 */
export function fileSafeLines(text: string): string {
  return text
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .split("\n")
    .map(fileSafe)
    .join("\n");
}

/** Every value in a record, made file-safe, as it is written to `case.json`. Keys are Code Sleuth's own. */
export function fileSafeRecord<T>(record: T): T {
  return JSON.parse(
    JSON.stringify(record, (_key, value: unknown) => (typeof value === "string" ? fileSafe(value) : value)),
  ) as T;
}

// Built from code points, so this file holds no control character itself.
const UNSAFE = new RegExp(
  `[${[
    [0x00, 0x08],
    [0x0a, 0x1f],
    [0x7f, 0x9f],
    [0x2028, 0x2029],
    [0x202a, 0x202e],
    [0x2066, 0x2069],
  ]
    .map(([from, to]) => `\\u{${from!.toString(16)}}-\\u{${to!.toString(16)}}`)
    .join("")}\\p{Cf}]`,
  "gu",
);

/** Lower case, every run of anything but a-z and 0-9 one hyphen, at most 60 characters. */
export function slug(title: string): string {
  const full = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return full.slice(0, 60).replace(/-+$/, "");
}
