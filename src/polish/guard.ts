import { CARD_BODY_LIMIT, CARD_TITLE_LIMIT } from "../case/card.js";

/** A card's words: what is sent to be polished, and what comes back. */
export interface CardText {
  title: string;
  body: string;
}

/** Why a polished card was not kept. The card stays as the sleuth wrote it, and the case says which. */
export type GuardReason =
  | "empty"
  | "shape-changed"
  | "check-id-dropped"
  | "path-dropped"
  | "path-added"
  | "masked-value-changed"
  | "number-changed"
  | "checkbox-count-changed";

export type GuardResult = { kept: true } | { kept: false; reason: GuardReason };

/** The facts a card carries, which a rewrite must keep, all of them, and add none to. */
export interface CardFacts {
  /** The last line: the check id, the case and the short commit. */
  fingerprint: string;
  /** Every path, with its line where it has one, as the card names them in code spans. */
  paths: Set<string>;
  maskedValues: Set<string>;
  /** Every number, as many times as it appears. */
  numbers: string[];
  checkboxes: number;
}

const CODE_SPAN = /(`+)\s?([^`]+?)\s?\1/g;
/**
 * A path written in prose, the second net behind the card's own evidence: a folder in it, a file name with an
 * extension, a dotfile (`.env`), or any name with a line (`Dockerfile:4`), each maybe with `:line`.
 */
const PATH =
  /^(?:[\w.@-]+\/)+[\w.@-]*(?::\d+)?$|^\.?[\w@-]+(?:\.[\w-]+)+(?::\d+)?$|^\.[\w@.-]+(?::\d+)?$|^[\w@.-]+:\d+$/;
const MASKED = /\S{4}\*{4}\S{2}|\*{4}/g;
const NUMBER = /\d+(?:\.\d+)?/g;
const CHECKBOX = /^\s*- \[[ xX]\]/gm;

export function factsOf(card: CardText): CardFacts {
  const text = `${card.title}\n${card.body}`;
  const paths = new Set<string>();
  for (const span of text.matchAll(CODE_SPAN)) {
    const inner = span[2]!.trim();
    // An evidence span is `path:line` or `path`; a span with words in it (a command, an excerpt) is not a path.
    if (PATH.test(inner) && !/\s/.test(inner)) paths.add(inner);
  }
  return {
    fingerprint: lastLine(card.body),
    paths,
    maskedValues: new Set(text.match(MASKED) ?? []),
    numbers: (text.match(NUMBER) ?? []).sort(),
    checkboxes: (card.body.match(CHECKBOX) ?? []).length,
  };
}

/**
 * Keeps a polished card only when it keeps every fact of the card it was made from and adds none, and
 * still has a card's shape. Pure: the same pair always gives the same answer.
 */
export function guardPolish(
  original: CardText,
  polished: CardText,
  cites: readonly string[] = [],
): GuardResult {
  if (polished.title.trim() === "" || polished.body.trim() === "") return { kept: false, reason: "empty" };
  if (
    polished.title.length > CARD_TITLE_LIMIT ||
    polished.title.includes("\n") ||
    polished.body.length > CARD_BODY_LIMIT ||
    /^#{1,6}\s/m.test(polished.body)
  ) {
    return { kept: false, reason: "shape-changed" };
  }

  const before = factsOf(original);
  const after = factsOf(polished);
  if (after.fingerprint !== before.fingerprint) return { kept: false, reason: "check-id-dropped" };
  const polishedText = `${polished.title}\n${polished.body}`;
  // First, the card's own evidence: every path and path:line it cites, verbatim, whatever it looks like.
  if (cites.some((cite) => !citedIn(polishedText, cite))) return { kept: false, reason: "path-dropped" };
  if ([...before.paths].some((path) => !polishedText.includes(path)))
    return { kept: false, reason: "path-dropped" };
  if ([...after.paths].some((path) => !before.paths.has(path) && !isPartOfKnownPath(path, before.paths))) {
    return { kept: false, reason: "path-added" };
  }
  if (!sameSet(before.maskedValues, after.maskedValues))
    return { kept: false, reason: "masked-value-changed" };
  if (before.numbers.join("\n") !== after.numbers.join("\n"))
    return { kept: false, reason: "number-changed" };
  if (before.checkboxes !== after.checkboxes) return { kept: false, reason: "checkbox-count-changed" };
  return { kept: true };
}

/**
 * The cite stands on its own in the text: `.env:3` is not found inside `.envrc:3`, nor `a.ts:1` inside `a.ts:12`.
 * A full stop after it, ending a sentence, is fine.
 */
function citedIn(text: string, cite: string): boolean {
  const escaped = cite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.@/-])${escaped}(?![\\w@/-]|\\.\\w|:\\d)`).test(text);
}

/** `config/dev.ts` on its own, where the card said `config/dev.ts:12`, names nothing new. */
function isPartOfKnownPath(path: string, known: Set<string>): boolean {
  return [...known].some((k) => k.startsWith(`${path}:`));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function lastLine(text: string): string {
  return text.trimEnd().split("\n").at(-1)?.trim() ?? "";
}
