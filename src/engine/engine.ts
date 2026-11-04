import { maskSecrets } from "./secrets/scan.js";
import { createHmac, randomBytes } from "node:crypto";
import type { Check, CheckContext, Evidence, Need, Result } from "./check.js";
import { CHECKS } from "./checks/index.js";
import { needReasons } from "./copy.js";
import { type ExampleLocations, exampleLocations, isExampleEvidence } from "./examples.js";
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
 * checks whose needs are met, and only those that would call for this repository.
 */
export function outgoingCalls(
  goal: Goal,
  repo: RepoReader,
  capabilities: Capabilities,
  table: readonly Check[] = CHECKS,
): string[] {
  return goal.checks.flatMap(({ id }) => {
    const check = table.find((c) => c.id === id);
    if (check?.outgoing === undefined || !check.needs.every((need) => capabilities.has(need))) return [];
    const call = check.outgoing(repo, capabilities);
    return call === undefined ? [] : [call];
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
export function runCheck(
  check: Check,
  repo: RepoReader,
  capabilities: Capabilities,
  context: CheckContext,
): Result {
  const missing = check.needs.find((need) => !capabilities.has(need));
  if (missing !== undefined) return { verdict: "not-investigated", reason: needReasons[missing] };
  return masked(check.run(repo, context));
}

/**
 * Every excerpt a check records goes through the secret rules here, whatever check found it: a token on a line
 * that a marker, a path or a workflow check reports is masked like any other. This is the one place a result
 * leaves a check, so no evidence reaches a case, a card or a polish request unmasked.
 */
export function masked(result: Result): Result {
  if (result.verdict !== "found") return result;
  return {
    verdict: "found",
    evidence: result.evidence.map((piece) =>
      piece.excerpt === undefined ? piece : { ...piece, excerpt: maskSecrets(piece.excerpt, piece.path) },
    ),
  };
}

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
