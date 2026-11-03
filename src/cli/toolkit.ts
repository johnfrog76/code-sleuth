import { dirname } from "node:path";
import type { Card } from "../case/card.js";
import type { Filing, ToolkitRecord } from "../case/record.js";
import { localDate, type CaseDraft } from "../case/write.js";
import { confirmsSpace, type DetectOptions, type Detection, detectToolkit } from "../toolkit/detect.js";
import { fileCard } from "../toolkit/file.js";
import { ledgerPath, readLedger, recordFiled } from "../toolkit/ledger.js";
import { copy } from "./copy.js";
import { type Io, Refusal } from "./refusal.js";

export interface ToolkitFlags {
  toolkit?: boolean;
  yes?: boolean;
  refile?: boolean;
  toolkitPrefix?: string;
  toolkitSpace?: string;
}

/**
 * Looks for ToolKit, and refuses before any case is taken what the flags ask and ToolKit cannot do: --yes or
 * --refile without --toolkit, --toolkit with no ToolKit, a --toolkit-space ToolKit does not declare.
 */
export function prepareToolkit(
  flags: ToolkitFlags,
  io: Io,
): { detection: Detection; options: DetectOptions } {
  if (!flags.toolkit && (flags.yes || flags.refile)) {
    throw new Refusal(
      copy.toolkit.onlyWithToolkit(flags.yes ? "--yes" : "--refile"),
      copy.toolkit.onlyWithToolkitHint,
    );
  }
  const options: DetectOptions = {
    env: io.env ?? {},
    ...(flags.toolkitPrefix === undefined ? {} : { prefix: flags.toolkitPrefix }),
    ...(flags.toolkitSpace === undefined ? {} : { space: flags.toolkitSpace }),
    ...(io.toolkitModuleRoot === undefined ? {} : { moduleRoot: io.toolkitModuleRoot }),
  };
  const detection = detectToolkit(options);
  if (flags.toolkit && detection.state === "not-installed") {
    throw new Refusal(copy.toolkit.notInstalled(detection.reason), copy.toolkit.notInstalledHint);
  }
  if (
    flags.toolkitSpace !== undefined &&
    detection.state === "detected" &&
    !confirmsSpace(detection, flags.toolkitSpace)
  ) {
    const declared = detection.spaces === null ? copy.toolkit.spacesUnknown : detection.spaces.join(", ");
    throw new Refusal(
      copy.toolkit.undeclaredSpace(flags.toolkitSpace),
      copy.toolkit.undeclaredSpaceHint(declared),
    );
  }
  return { detection, options };
}

/** What the case records about ToolKit, before anything is filed. */
export function toolkitRecord(detection: Detection, filing?: Filing): ToolkitRecord {
  if (detection.state === "not-installed") return { state: "not-installed" };
  return {
    state: "detected",
    via: "cli",
    shell: detection.shell.name,
    prefix: detection.prefix,
    space: detection.space,
    ...(filing === undefined ? {} : { filing }),
  };
}

/**
 * --toolkit: asks once, naming the count and the Space, then files the case's cards one at a time, in its
 * order, through ToolKit's NewPrompt. A check already on the ledger is skipped unless --refile. The first
 * refusal stops the batch; what was filed before it stays filed and on the ledger.
 */
export async function fileCards(
  draft: CaseDraft,
  /** The cards to file: polished where polish kept a rewrite, else the sleuth's own. */
  cards: readonly Card[],
  detection: Extract<Detection, { state: "detected" }>,
  options: DetectOptions,
  flags: ToolkitFlags,
  io: Io,
  human: (text: string) => void,
  now: () => Date = () => new Date(),
): Promise<Filing> {
  const ledger = ledgerPath(dirname(draft.path));
  const known = new Map(readLedger(ledger).map((entry) => [entry.check, entry]));
  const filing: Filing = { filed: [], skipped: [] };

  const pending: { check: string; card: CaseDraft["cards"][number] }[] = [];
  for (const card of cards) {
    const check = draft.record.checks.find((c) => c.card === card.file)!.id;
    const earlier = known.get(check);
    if (earlier !== undefined && !flags.refile) {
      filing.skipped.push({ check, card: earlier.card, date: earlier.date });
      human(copy.toolkit.skipLine(check, earlier.card, earlier.date));
    } else {
      pending.push({ check, card });
    }
  }
  if (pending.length === 0) {
    filing.notFiled = copy.toolkit.nothingNew;
    return filing;
  }

  const space = detection.space;
  if (!flags.yes) {
    const terminal = io.terminal ?? { stdin: false, stdout: false, stderr: false };
    if (!(terminal.stdin && terminal.stdout) || io.ask === undefined) {
      // Said once, in the footer's ToolKit line, which names the Space as well.
      filing.notFiled = copy.toolkit.noTerminal;
      return filing;
    }
    const answer = (await io.ask(copy.toolkit.consent(pending.length, space))).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      filing.notFiled = copy.toolkit.declined;
      return filing;
    }
  }

  for (const { check, card } of pending) {
    const result = fileCard(detection, card, options);
    if (result.status !== "filed") {
      filing.stopped = {
        check,
        sentence: result.sentence,
        ...(result.status === "failed" ? { failed: true } : {}),
      };
      return filing;
    }
    recordFiled(ledger, { check, card: result.card, space, case: draft.id, date: localDate(now()) });
    filing.filed.push({
      check,
      card: result.card,
      ...(result.folder === undefined ? {} : { folder: result.folder }),
      ...(result.path === undefined ? {} : { path: result.path }),
    });
    human(copy.toolkit.filedLine(check, result.card, result.folder));
  }
  return filing;
}
