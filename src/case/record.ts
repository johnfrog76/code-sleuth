import type { SpaceSource } from "../toolkit/space.js";
import type { Evidence, Verdict } from "../engine/check.js";
import type { ExampleLocations } from "../engine/examples.js";
import type { CheckOutcome } from "../engine/engine.js";
import type { Goal, Weight } from "../engine/goals.js";
import { renderCard, type Card } from "./card.js";
import type { RepoInfo } from "./repoInfo.js";

/** The case file format's version. A reader refuses a version it does not know. */
export const CASE_FILE_VERSION = 1;

export type CaseVerdict = "ready" | "nearly" | "not-ready";

export type Counts = Record<Weight | "clean" | "not-investigated", number>;

export interface CheckRecord {
  id: string;
  title: string;
  booksName: string;
  verdict: Verdict;
  weight?: Weight;
  evidence?: Evidence[];
  reason?: string;
  fix?: string;
  /** The card's path, relative to the case folder. */
  card?: string;
  /** The matches in example locations: every one, with its path, never counted and never carded. */
  examples?: Evidence[];
  /** What the polish pass did to its card, when it ran. */
  polish?: { state: "polished" } | { state: "kept-original"; reason: string };
}

/** What the run did with ToolKit. Recorded when the run looked for it; the CLI always does. */
export type ToolkitRecord =
  | { state: "not-installed" }
  | {
      state: "detected";
      via: "cli";
      /** The shell's name, never its path: `pwsh` or `powershell.exe`. */
      shell: string;
      prefix: string;
      /** The Space cards would land in, or null when ToolKit did not say. */
      space: string | null;
      /**
       * How that Space was chosen: `flag` (--toolkit-space), `origin` (the Space whose address is this
       * repository's origin) or `active` (ToolKit's active Space, because no Space's address matched).
       */
      spaceFrom?: SpaceSource;
      filing?: Filing;
    };

/** What `--toolkit` did, card by card, in the case's order. */
export interface Filing {
  filed: { check: string; card: string; folder?: string; path?: string }[];
  skipped: { check: string; card: string; date: string }[];
  /** Why nothing (more) was filed, when the person said no, or there was no one to ask. */
  notFiled?: string;
  /** The card ToolKit refused, and its own sentence; the cards after it were not filed. */
  stopped?: { check: string; sentence: string; failed?: boolean };
}

/** Whether the polish pass ran, and when it did not, the one thing that kept it off. */
/**
 * `keyFrom` says where the API key came from -- `the environment` or the .env's path -- never the key. With no
 * key, `keyFile` is the .env it would be read from and `keyExample` the .env.example to copy there, both in their ~ form.
 */
export type PolishState =
  | { state: "on"; model: string; keyFrom?: string }
  | {
      state: "off";
      reason: "no --polish" | "no key" | "no --polish, no key";
      keyFrom?: string;
      keyFile?: string;
      /** The `.env.example` to copy to `keyFile`, in its ~ form: a record, not a line to run. */
      keyExample?: string;
    };

export interface Enhancements {
  polish?: PolishState;
  toolkit?: ToolkitRecord;
  /** The `--toolkit-space` the run named, so the command a case shows files in the same Space. */
  toolkitSpace?: string;
}

export interface CaseRecord {
  caseFile: number;
  tool: { name: string; version: string };
  case: string;
  goal: string;
  repo: RepoInfo;
  openedAt: string;
  closedAt: string;
  verdict: CaseVerdict;
  counts: Counts;
  /** The example locations in force: the built-in globs, every `--examples` glob, and the line marker. */
  exampleLocations: ExampleLocations;
  enhancements?: Enhancements;
  checks: CheckRecord[];
}

/** The record with its enhancements, in the place spec 6.2 gives them: after the counts. */
export function withEnhancements(record: CaseRecord, enhancements: Enhancements | undefined): CaseRecord {
  if (enhancements === undefined || Object.keys(enhancements).length === 0) return record;
  const { checks, ...head } = record;
  return { ...head, enhancements, checks };
}

export interface CaseInput {
  goal: Goal;
  outcomes: readonly CheckOutcome[];
  repo: RepoInfo;
  tool: { name: string; version: string };
  caseId: string;
  openedAt: string;
  closedAt: string;
  /** Hunches get cards too. */
  all: boolean;
  /** The example locations the run used. */
  examples: ExampleLocations;
}

/** Builds the record and its cards. Pure: the same input gives the same bytes. */
export function buildCase(input: CaseInput): { record: CaseRecord; cards: Card[] } {
  const counts: Counts = { "smoking-gun": 0, "loose-end": 0, hunch: 0, clean: 0, "not-investigated": 0 };
  for (const { result, weight } of input.outcomes)
    counts[result.verdict === "found" ? weight : result.verdict]++;

  // Cards are numbered in checklist order: smoking guns, then loose ends, then hunches.
  const carded = (["smoking-gun", "loose-end", "hunch"] as const)
    .filter((weight) => weight !== "hunch" || input.all)
    .flatMap((weight) => input.outcomes.filter((o) => o.result.verdict === "found" && o.weight === weight));
  const cards = carded.map((outcome, i) =>
    renderCard({ outcome, order: i + 1, goal: input.goal.id, caseId: input.caseId, head: input.repo.head }),
  );

  const checks = input.outcomes.map(({ check, weight, result, examples }): CheckRecord => {
    const base = {
      id: check.id,
      title: check.title,
      booksName: check.booksName,
      verdict: result.verdict,
      ...(examples.length === 0 ? {} : { examples }),
    };
    if (result.verdict === "clean") return base;
    if (result.verdict === "not-investigated") return { ...base, reason: result.reason };
    const card = cards[carded.findIndex((o) => o.check.id === check.id)];
    return {
      ...base,
      weight,
      evidence: result.evidence,
      fix: check.card.fix,
      ...(card === undefined ? {} : { card: card.file }),
    };
  });

  const verdict: CaseVerdict =
    counts["smoking-gun"] > 0 ? "not-ready" : counts["loose-end"] > 0 ? "nearly" : "ready";

  return {
    record: {
      caseFile: CASE_FILE_VERSION,
      tool: input.tool,
      case: input.caseId,
      goal: input.goal.id,
      repo: input.repo,
      openedAt: input.openedAt,
      closedAt: input.closedAt,
      verdict,
      counts,
      exampleLocations: input.examples,
      checks,
    },
    cards,
  };
}
