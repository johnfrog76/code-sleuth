import { parse } from "yaml";
import type { Result } from "./check.js";
import { workflowReasons } from "./copy.js";
import type { RepoReader } from "./repo.js";

/** One step of a job: what it uses, with what, or what it runs, and the line of the file it starts on. */
export interface Step {
  job: string;
  line: number;
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
  /** True when `run` is a block (`run: |`), so its text starts on the line after `line`. */
  block?: boolean;
}

/** A GitHub Actions workflow, read with the YAML parser's safe defaults: no custom tags. */
export interface Workflow {
  path: string;
  /** The events in `on`, whatever its form: a string, a list or a map. */
  events: string[];
  /** The workflow's own top-level keys: `permissions`, `env`, `jobs`. */
  keys: string[];
  steps: Step[];
  /** Every step's `run`, with the line of the file it starts on. */
  runs: { line: number; text: string }[];
  /** False when the file is not YAML the parser can read. */
  readable: boolean;
}

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/i;

/**
 * The longest line of a step's `run` that a workflow rule reads. Every rule is linear, so this is a ceiling,
 * not a speed: a longer line is skipped, and the check says it skipped it rather than reading clean.
 */
export const MAX_WORKFLOW_LINE = 65_536;

/** A line a workflow rule did not read, because it is longer than `MAX_WORKFLOW_LINE`. 0 when not located. */
export interface Skipped {
  path: string;
  line: number;
}

/**
 * A workflow check's clean, held to what it read: with a workflow the parser could not read, or a line the
 * check skipped, clean would claim text nobody looked into, so the check reads not investigated and names it.
 */
export function cleanOrUnreadable(repo: RepoReader, skipped?: Skipped): Result {
  const unreadable = readWorkflows(repo).find(({ readable }) => !readable);
  if (unreadable !== undefined)
    return { verdict: "not-investigated", reason: workflowReasons.unreadable(unreadable.path) };
  if (skipped !== undefined)
    return { verdict: "not-investigated", reason: workflowReasons.longLine(skipped.path, skipped.line) };
  return { verdict: "clean" };
}

/** Each run's workflows, parsed once: every workflow check reads the same ones. */
const parsed = new WeakMap<RepoReader, Workflow[]>();

/** Every workflow in `.github/workflows/`, in path order. */
export function readWorkflows(repo: RepoReader): Workflow[] {
  let workflows = parsed.get(repo);
  if (workflows === undefined) {
    workflows = repo.files
      .filter((path) => WORKFLOW.test(path))
      .map((path) => readWorkflow(path, repo.readText(path) ?? ""));
    parsed.set(repo, workflows);
  }
  return workflows;
}

export function readWorkflow(path: string, text: string): Workflow {
  const empty = { path, events: [], keys: [], steps: [], runs: [] };
  let doc: unknown;
  try {
    // The parser's safe defaults, with no custom tags. Its warnings (an unknown tag, say) are not ours to
    // print: they would land in the middle of the detective's output.
    doc = parse(text, { logLevel: "error" });
  } catch {
    return { ...empty, readable: false };
  }
  if (!isMap(doc)) return { ...empty, readable: doc === null };
  const steps = readSteps(doc.jobs, text);
  return {
    path,
    events: events(doc.on),
    keys: Object.keys(doc),
    steps,
    runs: steps.flatMap(({ line, run }) => (run === undefined ? [] : [{ line, text: run }])),
    readable: true,
  };
}

/** The line a piece of a step's text is on, counting into a block `run:`. */
export function lineInRun(step: Step, index: number): number {
  return step.line === 0 ? 0 : step.line + (step.block ? 1 : 0) + index;
}

function events(on: unknown): string[] {
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.filter((e): e is string => typeof e === "string");
  if (isMap(on)) return Object.keys(on);
  return [];
}

function readSteps(jobs: unknown, text: string): Step[] {
  if (!isMap(jobs)) return [];
  const index = indexKeys(text.split(/\r?\n/));
  const found: Step[] = [];
  // Steps come in file order, so each search starts after the last step found.
  let from = 0;
  for (const [job, body] of Object.entries(jobs)) {
    if (!isMap(body) || !Array.isArray(body.steps)) continue;
    for (const step of body.steps) {
      if (!isMap(step)) continue;
      const located = locate(index, step, from);
      if (located.line > 0) from = located.line;
      found.push({
        job,
        line: located.line,
        ...(typeof step.uses === "string" ? { uses: step.uses } : {}),
        ...(isMap(step.with) ? { with: step.with } : {}),
        ...(typeof step.run === "string" ? { run: step.run, block: located.block } : {}),
      });
    }
  }
  return found;
}

type Key = "run" | "uses";
const KEYS: readonly Key[] = ["run", "uses"];

/** Where each key's values are written: key, then the value as a step's first line reads, then where, in order. */
type KeyIndex = Map<Key, Map<string, { at: number; block: boolean }[]>>;

/**
 * A line's `run:` or `uses:` key and what follows it, read by hand as `^\s*-?\s*key:(.*)$` read it: spaces, an
 * optional `-`, spaces, the key. By hand because the pattern retried a long run of spaces from every place in it.
 */
export function keyOf(line: string): { key: Key; rest: string } | undefined {
  let i = 0;
  while (i < line.length && /\s/.test(line[i]!)) i++;
  if (line[i] === "-") {
    i++;
    while (i < line.length && /\s/.test(line[i]!)) i++;
  }
  for (const key of KEYS)
    if (line.startsWith(`${key}:`, i)) return { key, rest: line.slice(i + key.length + 1) };
  return undefined;
}

/**
 * A value with a trailing YAML comment taken off, as YAML reads it: in a plain value, `#` after a space starts
 * one; after a value quoted whole, so does `#` after its closing quote. Read once, start to end.
 */
export function withoutComment(value: string): string {
  const quote = value[0] === '"' || value[0] === "'" ? value[0] : undefined;
  if (quote !== undefined) {
    const close = value.indexOf(quote, 1);
    if (close > 0 && /^\s+#/.test(value.slice(close + 1))) return value.slice(0, close + 1);
    return value;
  }
  for (let i = 1; i < value.length; i++)
    if (value[i] === "#" && /\s/.test(value[i - 1]!)) return value.slice(0, i).trimEnd();
  return value;
}

/**
 * Every line that writes a step's key, read once: by its inline value, and, for a block (`run: |`), by the
 * block's first line. Each line is read once, start to end, so a long one costs its length and no more.
 */
function indexKeys(lines: readonly string[]): KeyIndex {
  const index: KeyIndex = new Map(KEYS.map((key) => [key, new Map()]));
  const add = (key: Key, value: string, at: number, block: boolean) => {
    const values = index.get(key)!;
    const where = values.get(value);
    if (where === undefined) values.set(value, [{ at, block }]);
    else where.push({ at, block });
  };
  lines.forEach((line, at) => {
    const keyed = keyOf(line);
    if (keyed === undefined) return;
    // A trailing comment is not part of the value YAML reads: ` #` ends a plain value, and follows a quoted one.
    const raw = withoutComment(keyed.rest.trim());
    // A value quoted whole loses its quotes; one that only ends in a quote (`echo "hi"`) keeps them.
    const inline = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
    add(keyed.key, inline, at, false);
    const next = lines[at + 1];
    if (/^[|>]/.test(inline) && next !== undefined) add(keyed.key, next.trim(), at, true);
  });
  return index;
}

/**
 * Where a step is: the line of its `run:` when it runs something, else of its `uses:`, at or after `from`. A
 * step's text is found from the YAML's value, so a line is only a pointer for a person; the rules read the
 * parsed value.
 */
function locate(
  index: KeyIndex,
  step: Record<string, unknown>,
  from: number,
): { line: number; block: boolean } {
  const key = typeof step.run === "string" ? "run" : typeof step.uses === "string" ? "uses" : undefined;
  if (key === undefined) return { line: 0, block: false };
  const first = String(step[key]).split("\n")[0]!.trim();
  const where = index.get(key)!.get(first) ?? [];
  // The first place at or after `from`, by halves: the places are in file order.
  let [lo, hi] = [0, where.length];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (where[mid]!.at < from) lo = mid + 1;
    else hi = mid;
  }
  const hit = where[lo];
  return hit === undefined ? { line: 0, block: false } : { line: hit.at + 1, block: hit.block };
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
