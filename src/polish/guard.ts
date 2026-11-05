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
  | "checkbox-count-changed"
  | "code-changed"
  | "markup-added";

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
  /** Every checkbox, wherever it stands and whatever starts its line: `- [ ]`, `* [x]`, `[ ]` mid-line. */
  checkboxes: { open: number; ticked: number };
  /** The text of every code span, an excerpt's included: a rewrite keeps each word for word and adds none. */
  codeSpans: Set<string>;
  /** Every path written in prose, outside a code span, that reads as one. */
  prosePaths: Set<string>;
  /** Links, URLs and HTML tags: a rewrite adds none of them. */
  markup: string[];
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
/** Any decimal digit, in any script: a rewrite that writes ４８ for 48 adds a number the ASCII pattern misses. */
const ANY_DIGIT = /\p{Nd}/gu;
/** Numbers in words, each a fact as much as the digits are. */
const NUMBER_WORD =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen|once|twice|half|first|second|third)\b/gi;
const OPEN_BOX = /\[ \]/g;
const TICKED_BOX = /\[[xX]\]/g;
/** A markdown link or image, an autolink, a URL, or an HTML tag. */
const MARKUP = /\]\(|<\/?[A-Za-z!][^>]*>|<https?:|https?:\/\/\S+|\bwww\.\S+/gi;

export function factsOf(card: CardText): CardFacts {
  const text = `${card.title}\n${card.body}`;
  const paths = new Set<string>();
  const codeSpans = new Set<string>();
  for (const span of text.matchAll(CODE_SPAN)) {
    const inner = span[2]!.trim();
    codeSpans.add(inner);
    // An evidence span is `path:line` or `path`; a span with words in it (a command, an excerpt) is not a path.
    if (PATH.test(inner) && !/\s/.test(inner)) paths.add(inner);
  }
  const prose = text.replace(CODE_SPAN, " ");
  const prosePaths = new Set(
    prose
      .split(/[\s,;()"']+/)
      .map((word) => word.replace(/[.:!?]+$/, ""))
      // A path from home or the root reads as one too: `~/.ssh/id_ed`, `/etc/hosts`.
      .filter((word) => /[/.]/.test(word) && PATH.test(word.replace(/^~?\//, ""))),
  );
  const digits = (text.match(ANY_DIGIT) ?? []).filter((d) => !/[0-9]/.test(d));
  const words = (text.match(NUMBER_WORD) ?? []).map((w) => w.toLowerCase());
  return {
    fingerprint: lastLine(card.body),
    paths,
    maskedValues: new Set(text.match(MASKED) ?? []),
    numbers: [...(text.match(NUMBER) ?? []), ...digits, ...words].sort(),
    checkboxes: { open: (text.match(OPEN_BOX) ?? []).length, ticked: (text.match(TICKED_BOX) ?? []).length },
    codeSpans,
    prosePaths,
    markup: (prose.match(MARKUP) ?? []).sort(),
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
    /[\r\n\u2028\u2029]/.test(polished.title) ||
    polished.body.length > CARD_BODY_LIMIT ||
    hasHeading(polished.body)
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
  if (
    before.checkboxes.open !== after.checkboxes.open ||
    before.checkboxes.ticked !== after.checkboxes.ticked
  )
    return { kept: false, reason: "checkbox-count-changed" };
  // Every code span word for word: an excerpt quotes the file, and a command is run as written.
  // An original span may lose its backticks, its text standing in the prose; a span the card did not have, or
  // one that reads differently, is a change.
  if (
    [...before.codeSpans].some(
      (code) => !(PATH.test(code) ? citedIn(polishedText, code) : polishedText.includes(code)),
    )
  )
    return { kept: false, reason: "code-changed" };
  if ([...after.codeSpans].some((code) => !before.codeSpans.has(code)))
    return { kept: false, reason: "code-changed" };
  if ([...before.prosePaths].some((path) => !after.prosePaths.has(path) && !polishedText.includes(path)))
    return { kept: false, reason: "path-dropped" };
  if ([...after.prosePaths].some((path) => !before.prosePaths.has(path) && !before.paths.has(path)))
    return { kept: false, reason: "path-added" };
  // A link, a URL or an HTML tag the card did not have: a rewrite says the same, and points nowhere new.
  if (
    after.markup.some((piece) => !before.markup.includes(piece)) ||
    after.markup.length > before.markup.length
  )
    return { kept: false, reason: "markup-added" };
  return { kept: true };
}

/** A heading in any form ToolKit or a renderer reads as one: `#`, an underline (`===`, `---`), or `<h1>`. */
function hasHeading(body: string): boolean {
  const lines = body.split(/\r\n|\r|\n/);
  return lines.some(
    (line, i) =>
      /^\s{0,3}#{1,6}(?:\s|$)/.test(line) ||
      /<h[1-6][\s>]/i.test(line) ||
      (i > 0 && lines[i - 1]!.trim() !== "" && /^\s{0,3}(?:=+|-+)\s*$/.test(line)),
  );
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
