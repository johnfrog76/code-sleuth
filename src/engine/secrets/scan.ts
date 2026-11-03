import type { CheckContext, Evidence } from "../check.js";
import { isMarked } from "../examples.js";
import { NAME_GUESS_MIN_ENTROPY, SECRET_RULES, type SecretRule } from "./rules.js";

/** Lockfiles hold integrity hashes that look random; the name-guess rule does not read them. */
const LOCKFILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"]);

/** The longest excerpt a finding keeps, around its match. */
const EXCERPT_LIMIT = 160;

const compiled = SECRET_RULES.map((rule) => ({
  rule,
  regex: new RegExp(rule.pattern, rule.ignoreCase ? "gi" : "g"),
}));

export interface SecretMatch {
  rule: SecretRule;
  value: string;
  index: number;
}

/** Every rule's matches in one line. A value a known-shape rule matched is not matched again as a guess. */
export function matchLine(text: string, path: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lockfile = LOCKFILES.has(path.split("/").at(-1)!);
  for (const { rule, regex } of compiled) {
    if (rule.nameGuess && lockfile) continue;
    regex.lastIndex = 0;
    for (let m = regex.exec(text); m !== null; m = regex.exec(text)) {
      const value = m[rule.group ?? 0];
      if (value === undefined || value === "") continue;
      const index = m.index + m[0].lastIndexOf(value);
      if (rule.nameGuess && (!looksRandom(value) || !isLiteral(text, index, value))) continue;
      if (rule.nameGuess && matches.some((known) => overlaps(known, index, value.length))) continue;
      matches.push({ rule, value, index });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/** Masks a value: its first four and last two characters with the middle replaced (`ghp_****9f`). */
export function mask(value: string): string {
  return value.length < 10 ? "****" : `${value.slice(0, 4)}****${value.slice(-2)}`;
}

/** The line with every value in it masked, trimmed, and cut to a window around the first match. */
export function maskedExcerpt(text: string, matches: readonly SecretMatch[]): string {
  let masked = "";
  let at = 0;
  let first = -1;
  for (const m of matches) {
    if (m.index < at) continue;
    masked += text.slice(at, m.index);
    if (first < 0) first = masked.length;
    masked += m.rule.marker ? m.value : mask(m.value);
    at = m.index + m.value.length;
  }
  masked += text.slice(at);
  const lead = masked.length - masked.trimStart().length;
  masked = masked.trim();
  first = Math.max(0, first - lead);
  if (masked.length <= EXCERPT_LIMIT) return masked;
  const start = Math.max(0, Math.min(first - 40, masked.length - EXCERPT_LIMIT));
  return `${start > 0 ? "..." : ""}${masked.slice(start, start + EXCERPT_LIMIT)}...`;
}

/** The private-key block that starts at `lines[start]`, through its END line or the end of the lines. */
export function blockFrom(lines: readonly string[], start: number): string {
  const block: string[] = [];
  for (let i = start; i < lines.length; i++) {
    block.push(lines[i]!);
    if (i > start && lines[i]!.includes("-----END ")) break;
  }
  return block.join("\n");
}

/** Scans one line and returns one piece of evidence per match: masked, hashed, weighed, and marked when the line is. */
export function scanLine(
  text: string,
  path: string,
  line: number,
  context: CheckContext,
  options: { commit?: string; block?: () => string } = {},
): Evidence[] {
  const { commit } = options;
  const matches = matchLine(text, path);
  if (matches.length === 0) return [];
  const excerpt = maskedExcerpt(text, matches);
  const marked = isMarked(text);
  return matches.map((m) => {
    const weighed = m.rule.nameGuess ? "name-guess" : undefined;
    return {
      path,
      line,
      excerpt,
      rule: m.rule.id,
      ...(commit === undefined ? {} : { commit }),
      valueHash: context.hashSecret(m.rule.marker ? (options.block?.() ?? m.value) : m.value),
      ...(weighed === undefined ? {} : { weighed }),
      ...(marked ? { marked: true as const } : {}),
    };
  });
}

/** A dotted property path in code: `tokens.colorNeutralForeground1`. A JWT's segments start `eyJ`, and is not one. */
const PROPERTY_PATH = /^[A-Za-z_$][\w$-]*(?:\.[A-Za-z_$][\w$-]*)+$/;
/** What may follow an unquoted literal on its line: a separator, then nothing, or a comment. */
const LINE_END = /^\s*[;,]?\s*(?:(?:#|\/\/).*)?$/;

/**
 * The name guess is about a value someone wrote down, not code. A quoted value is a literal. An unquoted one
 * is a literal only when it ends its line (`.env`, YAML, INI) and is not a property path; one followed by more
 * code -- arguments, an operator -- is a call or an expression.
 */
function isLiteral(text: string, index: number, value: string): boolean {
  if (/["'`]/.test(text.charAt(index - 1))) return true;
  if (PROPERTY_PATH.test(value) && !value.startsWith("eyJ")) return false;
  return LINE_END.test(text.slice(index + value.length));
}

function looksRandom(value: string): boolean {
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value) && entropy(value) >= NAME_GUESS_MIN_ENTROPY;
}

/** Shannon entropy, in bits per character. */
export function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

function overlaps(known: SecretMatch, index: number, length: number): boolean {
  return index < known.index + known.value.length && known.index < index + length;
}
