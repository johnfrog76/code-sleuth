import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "../engine/check.js";
import { CHECKS } from "../engine/checks/index.js";
import { type Capabilities, type CheckOutcome, runGoal, secretHasher } from "../engine/engine.js";
import { exampleLocations } from "../engine/examples.js";
import type { NpmRunner, ToolRunner } from "../engine/npm.js";
import type { Goal } from "../engine/goals.js";
import type { RepoReader } from "../engine/repo.js";
import { version } from "../version.js";
import type { PolishRecord } from "../polish/pass.js";
import { type Card, cardFile } from "./card.js";
import { guardCasesFolder, machineKey, newCaseFolder, repoKey } from "./folder.js";
import { renderCaseMd } from "./markdown.js";
import { buildCase, type CaseRecord, type Enhancements, withEnhancements } from "./record.js";
import { readRepoInfo, type RepoInfo } from "./repoInfo.js";

export interface TakeCaseOptions {
  repo: RepoReader;
  goal: Goal;
  capabilities: Capabilities;
  /** The cases folder: the per-user one, or the one `--out` names. */
  casesFolder: string;
  /** True when the person chose the folder with `--out`; it changes the refusal's words. */
  chosen: boolean;
  all?: boolean;
  /** npm, when the run found it and may call out: given to the checks that need it. */
  npm?: NpmRunner;
  /** gh, when the run found it and may call out. */
  gh?: ToolRunner;
  /** The `--examples` globs: folders whose matches are shown and not counted, beside the built-in ones. */
  examples?: readonly string[];
  /** The lines of the `--deny` list. Giving one is what lets `names.deny` run. */
  denyList?: readonly string[];
  now?: () => Date;
  table?: readonly Check[];
  /** Called once the case has its folder, before any check runs. */
  onOpen?: (opened: { id: string; path: string; repo: RepoInfo }) => void;
  /** Called as each check returns. */
  onOutcome?: (outcome: CheckOutcome, index: number, total: number) => void;
}

/** A case that has run and is held open: its folder exists, and nothing is written in it until it closes. */
export interface CaseDraft {
  id: string;
  path: string;
  record: CaseRecord;
  outcomes: CheckOutcome[];
  cards: Card[];
  /**
   * Writes `case.json`, `case.md` and `cards/`, once, and returns the record as written. Polished cards, when
   * given, replace the sleuth's words in the card files; each keeps its file name and its place.
   */
  close(
    enhancements?: Enhancements,
    polished?: { cards: Card[]; records: Map<string, PolishRecord> },
  ): CaseRecord;
  /** Removes the folder of a case that will not close. */
  discard(): void;
}

/**
 * Investigates and writes one case: `case.json`, `case.md` and `cards/`, in a new folder under the cases
 * folder. Refuses before reading anything when the cases folder and the repository overlap.
 */
export function takeCase(options: TakeCaseOptions & { enhancements?: Enhancements }): {
  path: string;
  record: CaseRecord;
  outcomes: CheckOutcome[];
} {
  const draft = openCase(options);
  try {
    return { path: draft.path, record: draft.close(options.enhancements), outcomes: draft.outcomes };
  } catch (error) {
    draft.discard();
    throw error;
  }
}

/**
 * Investigates and holds the case open, so the CLI can show it and ask before anything is filed, and the
 * case file records what happened. The caller closes or discards it.
 */
export function openCase(options: TakeCaseOptions): CaseDraft {
  const { repo, goal, capabilities, casesFolder, chosen, all = false, now = () => new Date() } = options;
  guardCasesFolder(repo.root, casesFolder, chosen);

  const opened = now();
  const info = readRepoInfo(repo);
  const folder = newCaseFolder(join(casesFolder, repoKey(repo.root)), localDate(opened), goal.id);
  const discard = () => rmSync(folder.path, { recursive: true, force: true });
  try {
    options.onOpen?.({ id: folder.id, path: folder.path, repo: info });
    const context = {
      ...secretHasher(machineKey(casesFolder)),
      ...(options.denyList === undefined ? {} : { denyList: options.denyList }),
      ...(options.npm === undefined ? {} : { npm: options.npm }),
      ...(options.gh === undefined ? {} : { gh: options.gh }),
    };
    const can =
      options.denyList === undefined ? capabilities : new Set([...capabilities, "denyList" as const]);
    const examples = exampleLocations(options.examples ?? []);
    const outcomes = runGoal(goal, repo, can, {
      table: options.table ?? CHECKS,
      context,
      examples,
      ...(options.onOutcome ? { onOutcome: options.onOutcome } : {}),
    });
    const closed = now();
    const { record, cards } = buildCase({
      goal,
      outcomes,
      repo: info,
      tool: { name: "code-sleuth", version: version() },
      caseId: folder.id,
      openedAt: isoSeconds(opened),
      closedAt: isoSeconds(closed),
      all,
      examples,
    });
    let written = false;
    return {
      id: folder.id,
      path: folder.path,
      record,
      outcomes,
      cards,
      close(enhancements, polished) {
        if (written) throw new Error(`The case ${folder.id} is already written.`);
        written = true;
        const checks = polished
          ? record.checks.map((check) => {
              const polish = check.card === undefined ? undefined : polished.records.get(check.card);
              return polish === undefined ? check : { ...check, polish };
            })
          : record.checks;
        const final = withEnhancements({ ...record, checks }, enhancements);
        writeCase(folder.path, final, outcomes, polished?.cards ?? cards);
        return final;
      },
      discard,
    };
  } catch (error) {
    // A case that did not close leaves no half-written folder behind.
    discard();
    throw error;
  }
}

function writeCase(
  path: string,
  record: CaseRecord,
  outcomes: readonly CheckOutcome[],
  cards: readonly Card[],
): void {
  writeFileSync(join(path, "case.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  writeFileSync(join(path, "case.md"), renderCaseMd(record, outcomes), "utf8");
  mkdirSync(join(path, "cards"));
  for (const card of cards) writeFileSync(join(path, card.file), cardFile(card), "utf8");
}

/** `2026-10-31`, in the person's own time zone: the day they ran it. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2026-10-31T14:02:11Z`. */
export function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
