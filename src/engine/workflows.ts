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
 * A workflow check's clean, held to what it read: with a workflow the parser could not read, clean would claim a
 * file nobody looked into, so the check reads not investigated and names it.
 */
export function cleanOrUnreadable(repo: RepoReader): Result {
  const unreadable = readWorkflows(repo).find(({ readable }) => !readable);
  return unreadable === undefined
    ? { verdict: "clean" }
    : { verdict: "not-investigated", reason: workflowReasons.unreadable(unreadable.path) };
}

/** Every workflow in `.github/workflows/`, in path order. */
export function readWorkflows(repo: RepoReader): Workflow[] {
  return repo.files
    .filter((path) => WORKFLOW.test(path))
    .map((path) => readWorkflow(path, repo.readText(path) ?? ""));
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
  const lines = text.split(/\r?\n/);
  const found: Step[] = [];
  // Steps come in file order, so each search starts after the last step found.
  let from = 0;
  for (const [job, body] of Object.entries(jobs)) {
    if (!isMap(body) || !Array.isArray(body.steps)) continue;
    for (const step of body.steps) {
      if (!isMap(step)) continue;
      const located = locate(lines, step, from);
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

/**
 * Where a step is: the line of its `run:` when it runs something, else of its `uses:`. A step's text is
 * found from the YAML's value, so a line is only a pointer for a person; the rules read the parsed value.
 */
function locate(
  lines: readonly string[],
  step: Record<string, unknown>,
  from: number,
): { line: number; block: boolean } {
  const key = typeof step.run === "string" ? "run" : typeof step.uses === "string" ? "uses" : undefined;
  if (key === undefined) return { line: 0, block: false };
  const value = String(step[key]);
  const first = value.split("\n")[0]!.trim();
  const pattern = new RegExp(`^\\s*-?\\s*${key}:\\s*(.*)$`);
  for (let i = from; i < lines.length; i++) {
    const match = pattern.exec(lines[i]!);
    if (match === null) continue;
    const raw = match[1]!.trim();
    // A value quoted whole loses its quotes; one that only ends in a quote (`echo "hi"`) keeps them.
    const inline = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
    if (inline === first) return { line: i + 1, block: false };
    if (/^[|>]/.test(inline) && lines[i + 1]?.trim() === first) return { line: i + 1, block: true };
  }
  return { line: 0, block: false };
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
