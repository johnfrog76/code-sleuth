import { maskSecrets } from "./secrets/scan.js";
import { createHmac, randomBytes } from "node:crypto";
import {
  COMMIT_MESSAGE,
  type Check,
  type CheckContext,
  type Evidence,
  type Need,
  type Result,
} from "./check.js";
import { CHECKS } from "./checks/index.js";
import { checkFailed, gitTimedOutReason, needReasons, refusedReasons, tooLargeReasons } from "./copy.js";
import { type ExampleLocations, exampleLocations, isExampleEvidence, isMarked } from "./examples.js";
import { readableLines } from "./files.js";
import { WEIGHTS, type Goal, type Weight } from "./goals.js";
import type { RepoReader } from "./repo.js";
import { git } from "./repo.js";
import { findGh, findNpm, type NpmRunner, type ToolRunner } from "./npm.js";

export interface CheckOutcome {
  check: Check;
  /** What this goal makes of a `found` result. */
  weight: Weight;
  /** What the check found, without its example matches: a check that found only examples reads clean. */
  result: Result;
  /** The matches in example locations: shown, never counted, never carded. */
  examples: Evidence[];
}

/** What this machine and this run can do. A check that needs something missing is not run. */
export type Capabilities = ReadonlySet<Need>;

export interface DetectOptions {
  /** The run's environment: where npm is looked for. Without it, npm is not looked for. */
  env?: NodeJS.ProcessEnv;
  /** True when the run may call out: not --offline. Off unless the run says so, so a test never calls out. */
  network?: boolean;
  /** Only for tests: the npm the run uses. */
  npm?: NpmRunner;
  /** Only for tests: the gh the run uses. */
  gh?: ToolRunner;
}

/**
 * Finds what this run can do: git in a repository; npm and gh, when the run names an environment to find them in; and
 * the network, only when the run allows it. Each other need lands with the check that uses it.
 */
export function detectCapabilities(repo: RepoReader, options: DetectOptions = {}): Capabilities {
  const found = new Set<Need>();
  if (repo.isGitRepository && git(repo.root, ["--version"]).status === 0) found.add("git");
  if (options.npm !== undefined || (options.env !== undefined && findNpm(options.env) !== undefined))
    found.add("npm");
  if (options.gh !== undefined || (options.env !== undefined && findGh(options.env) !== undefined))
    found.add("gh");
  if (options.network === true) found.add("network");
  return found;
}

/**
 * Every call a goal's checks would make off the machine, one line each, said before any of them runs: only the
 * checks that have what they need, and only those that would call for this repository.
 */
/** A check's outgoing calls as a list: none, one, or one per project. */
function calls(outgoing: string | readonly string[] | undefined): string[] {
  return outgoing === undefined ? [] : typeof outgoing === "string" ? [outgoing] : [...outgoing];
}

export function outgoingCalls(
  goal: Goal,
  repo: RepoReader,
  capabilities: Capabilities,
  table: readonly Check[] = CHECKS,
): string[] {
  return goal.checks.flatMap(({ id }) => {
    const check = table.find((c) => c.id === id);
    if (check?.outgoing === undefined || !check.needs.every((need) => capabilities.has(need))) return [];
    return calls(check.outgoing(repo, capabilities));
  });
}

export interface RunOptions {
  /** The check table; tests pass their own. */
  table?: readonly Check[];
  /** How secrets are hashed. A run that writes a case passes the machine's key; the default is a throwaway key. */
  context?: CheckContext;
  /** The example locations in force: the built-in folders by default. */
  examples?: ExampleLocations;
  /** Called as each check returns, in order: the stakeout ticks off a lead. */
  onOutcome?: (outcome: CheckOutcome, index: number, total: number) => void;
}

/** A keyed hash: `hmac-sha256:<hex>`. The same key and value always give the same hash. */
export function secretHasher(key: Buffer): CheckContext {
  return {
    hashSecret: (value) => `hmac-sha256:${createHmac("sha256", key).update(value, "utf8").digest("hex")}`,
  };
}

/** Runs a goal's checks over the repository, in the goal's order. */
export function runGoal(
  goal: Goal,
  repo: RepoReader,
  capabilities: Capabilities,
  options: RunOptions = {},
): CheckOutcome[] {
  const table = options.table ?? CHECKS;
  const context = options.context ?? secretHasher(randomBytes(32));
  const locations = options.examples ?? exampleLocations();
  return goal.checks.map(({ id, weight }, index) => {
    const check = table.find((candidate) => candidate.id === id);
    if (check === undefined) throw new Error(`The goal ${goal.id} names a check that does not exist: ${id}`);
    const { result, examples } = splitExamples(runCheck(check, repo, capabilities, context), locations);
    const outcome = {
      check,
      weight: result.verdict === "found" ? weighFound(weight, result.evidence) : weight,
      result,
      examples,
    };
    options.onOutcome?.(outcome, index, goal.checks.length);
    return outcome;
  });
}

/**
 * Takes a found result's example matches out of its evidence. What is left is what the check found; a found
 * result whose every piece of evidence was an example reads clean. A finding with no evidence at all (a missing
 * file) is not an example, and stays found.
 */
export function splitExamples(
  result: Result,
  locations: ExampleLocations,
): { result: Result; examples: Evidence[] } {
  if (result.verdict !== "found" || result.evidence.length === 0) return { result, examples: [] };
  const examples = result.evidence.filter((piece) => isExampleEvidence(piece, locations));
  if (examples.length === 0) return { result, examples };
  const real = result.evidence.filter((piece) => !isExampleEvidence(piece, locations));
  return {
    result: real.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence: real },
    examples,
  };
}

/** A check whose need is missing is `not-investigated` with the reason, and its rule never runs. */
/** What a check lacks, when it does; the run says, before any check runs, what each would send off the machine. */
const CALLING: readonly Need[] = ["network", "npm", "gh"];

/**
 * The need that stops a check, or undefined. A check that calls off the machine names its call (`outgoing`); when
 * it would make none for this repository (no package.json, no dependencies, no npm lockfile), lacking the network,
 * npm or gh does not stop it, and it reads as it would online. Without them the run has no npm and no gh to give
 * it, so it cannot call out. When it would make a call and the network is off, `--offline` is the reason, first.
 */
function needed(check: Check, repo: RepoReader, capabilities: Capabilities): Need | undefined {
  const missing = check.needs.filter((need) => !capabilities.has(need));
  if (missing.length === 0) return undefined;
  if (check.outgoing !== undefined && missing.every((need) => CALLING.includes(need))) {
    const wouldCall = calls(check.outgoing(repo, new Set([...capabilities, ...CALLING])));
    if (wouldCall.length === 0) return undefined;
  }
  return missing.includes("network") ? "network" : missing[0];
}

export function runCheck(
  check: Check,
  repo: RepoReader,
  capabilities: Capabilities,
  context: CheckContext,
): Result {
  const missing = needed(check, repo, capabilities);
  if (missing !== undefined)
    return {
      verdict: "not-investigated",
      // git was there and did not answer: not the same as no git, and the reason says which.
      reason: missing === "git" && repo.gitTimedOut() ? gitTimedOutReason : needReasons[missing],
    };
  // A check that throws (a file it cannot open, a shape it did not expect) read nothing: not investigated, with
  // what went wrong, and the run goes on with the next check.
  // What the check asked to read and was not given: a text file over the size it is read up to.
  const unread: string[] = [];
  const watched: RepoReader = {
    ...repo,
    readText(path) {
      const text = repo.readText(path);
      if (text === undefined && repo.tooLarge(path)) unread.push(path);
      return text;
    },
  };
  let result: Result;
  try {
    result = check.run(watched, context);
  } catch (error) {
    result = {
      verdict: "not-investigated",
      reason: checkFailed(error instanceof Error ? error.message : String(error)),
    };
  }
  // A file too large to read may hold what this check looks for: clean would claim what nobody read.
  if (result.verdict === "clean" && unread.length > 0)
    result = {
      verdict: "not-investigated",
      reason: tooLargeReasons.text(unread[0]!, new Set(unread).size - 1),
    };
  // A path the index lists that leads outside the repository was not read, and may be the file this check
  // would have found something in: clean would claim what nobody looked at.
  if (result.verdict === "clean" && repo.refused.length > 0)
    result = {
      verdict: "not-investigated",
      reason: refusedReasons.leadsOutside(repo.refused[0]!, repo.refused.length - 1),
    };
  return masked(markedLines(result, repo));
}

/**
 * Sets `marked` on every piece of evidence whose whole line carries the example marker, for every check, here and
 * nowhere else: a check never has to remember. The line is read whole, so the marker counts even where the
 * excerpt was cut to a window. A line in the tree is read from the file, and a commit message's line from the
 * message. A line from the history (a file path with a commit) is no longer in the tree: the history reader
 * marked it from the line as that commit added it, and it is kept as it is.
 */
export function markedLines(result: Result, repo: RepoReader): Result {
  if (result.verdict !== "found") return result;
  const files = new Map<string, string[]>();
  let messages: Map<string, string[]> | undefined;
  const lineOf = (piece: Evidence): string | undefined => {
    if (piece.line === undefined) return undefined;
    if (piece.path === COMMIT_MESSAGE) {
      if (piece.commit === undefined) return undefined;
      messages ??= new Map(
        (repo.commitMessages() ?? []).map(({ commit, text }) => [commit, text.split("\n")]),
      );
      return messages.get(piece.commit)?.[piece.line - 1];
    }
    if (piece.commit !== undefined) return undefined;
    if (!files.has(piece.path)) files.set(piece.path, readableLines(repo, piece.path));
    return files.get(piece.path)![piece.line - 1];
  };
  return {
    verdict: "found",
    evidence: result.evidence.map((piece) => {
      if (piece.marked === true) return piece;
      const line = lineOf(piece);
      return line !== undefined && isMarked(line) ? { ...piece, marked: true } : piece;
    }),
  };
}

/**
 * Every excerpt a check records goes through the secret rules here, whatever check found it: a token on a line
 * that a marker, a path or a workflow check reports is masked like any other. This is the one place a result
 * leaves a check, so no evidence reaches a case, a card or a polish request unmasked.
 */
export function masked(result: Result): Result {
  // A reason can quote the repository too: a file's name, a manifest's license field.
  if (result.verdict === "not-investigated")
    return { verdict: "not-investigated", reason: maskSecrets(result.reason, "") };
  if (result.verdict !== "found") return result;
  return {
    verdict: "found",
    evidence: result.evidence.map((piece) => {
      const out: Evidence = { ...piece, path: maskSecrets(piece.path, piece.path) };
      if (piece.excerpt !== undefined) out.excerpt = maskSecrets(piece.excerpt, piece.path);
      return out;
    }),
  };
}

/**
 * What each evidence field holds. Only `path` and `excerpt` carry text from the repository, and `masked` masks
 * both; every other field is a number, a hash or a fixed word. A new field will not compile until it is put here.
 */
export const EVIDENCE_FIELDS = {
  path: "repository text, masked",
  excerpt: "repository text, masked",
  line: "a number",
  rule: "a fixed word: a rule id, a marker or a license id",
  commit: "a commit hash",
  valueHash: "a keyed hash",
  weighed: "a fixed word",
  marked: "a flag",
} as const satisfies Record<keyof Evidence, string>;

/**
 * The weight of a found check: the goal's weight, lowered one step for evidence that is a guess from a name or
 * a moderate advisory, and two for a low one. The heaviest piece of evidence decides. Examples are not weighed: they are taken out first (splitExamples).
 */
export function weighFound(goalWeight: Weight, evidence: readonly Evidence[]): Weight {
  if (evidence.length === 0) return goalWeight;
  const hunch = WEIGHTS.indexOf("hunch");
  const rank = (piece: Evidence) => {
    const at = WEIGHTS.indexOf(goalWeight);
    const steps = piece.weighed === "low" ? 2 : piece.weighed === undefined ? 0 : 1;
    return Math.min(at + steps, hunch);
  };
  return WEIGHTS[Math.min(...evidence.map(rank))]!;
}
