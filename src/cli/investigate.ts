import { accessSync, constants, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { defaultCasesFolder, isInside } from "../case/folder.js";
import type { CaseRecord } from "../case/record.js";
import { examplesLine } from "../case/examplesLine.js";
import { polishLine } from "../case/polishLine.js";
import { readRemote } from "../case/repoInfo.js";
import { toolkitLine } from "../case/toolkitLine.js";
import { openCase } from "../case/write.js";
import { detectCapabilities, outgoingCalls } from "../engine/engine.js";
import { findGh, findNpm } from "../engine/npm.js";
import { findGoal, type Goal, WEIGHTS, type Weight } from "../engine/goals.js";
import { openRepo } from "../engine/repo.js";
import { copy } from "./copy.js";
import { header, painter, report } from "./output.js";
import { EXIT_FOUND, EXIT_OK, type Io, Refusal } from "./refusal.js";
import { polishAll, preparePolish } from "./polish.js";
import { fileCards, prepareToolkit, type ToolkitFlags, toolkitRecord } from "./toolkit.js";

/** The goals a case can be taken for in this release. The others are listed by `checks`, and come next. */
export const INVESTIGABLE = ["public"];

export interface InvestigateFlags extends ToolkitFlags {
  goal?: string;
  polish?: boolean;
  examples?: readonly string[];
  /** Make no network call: the checks that would read not-investigated, "--offline". */
  offline?: boolean;
  out?: string;
  deny?: string;
  all?: boolean;
  json?: boolean;
  failOn?: string;
}

/** `code-sleuth [<folder>]`: refuses what it cannot do, asks the goal if it can, takes the case and reports it. */
export async function investigate(
  folder: string | undefined,
  flags: InvestigateFlags,
  io: Io,
): Promise<number> {
  const root = checkFolder(folder ?? ".");
  const failOn = flags.failOn === undefined ? undefined : checkWeight(flags.failOn);
  const terminal = io.terminal ?? { stdin: false, stdout: false, stderr: false };
  const { goal, asked } = await pickGoal(flags.goal, io, terminal.stdin && terminal.stdout);
  const repo = openRepo(root);
  const denyList = flags.deny === undefined ? undefined : readDenyList(flags.deny, repo.top);
  const {
    detection,
    options: toolkitOptions,
    spaceFrom,
  } = prepareToolkit(flags, io, readRemote(repo), repo.top);

  // With --json, stdout carries the record alone and the person reads the rest on stderr.
  const human = flags.json ? io.stderr : io.stdout;
  const env = io.env ?? {};
  const colour = (flags.json ? terminal.stderr : terminal.stdout) && !env.NO_COLOR;
  const casesFolder = flags.out === undefined ? (io.casesFolder ?? defaultCasesFolder()) : resolve(flags.out);

  const polish = preparePolish(flags.polish ?? false, io);

  // What may leave the machine is decided, and named, before any check runs; --offline turns it all off.
  const network = !(flags.offline ?? false);
  // npm's cache and logs go to Code Sleuth's own folder, never where a repository's .npmrc points.
  const npm = network ? findNpm(env, process.platform, process.execPath, io.npmFolder) : undefined;
  const gh = network ? findGh(env) : undefined;
  const capabilities = detectCapabilities(repo, {
    env,
    network,
    ...(npm === undefined ? {} : { npm }),
    ...(gh === undefined ? {} : { gh }),
  });
  const outgoing = [
    ...outgoingCalls(goal, repo, capabilities).map(copy.run.offlineSkips),
    ...(polish.client === undefined ? [] : [copy.run.polishLeaves]),
  ];

  const draft = openCase({
    repo,
    goal,
    capabilities,
    ...(npm === undefined ? {} : { npm }),
    ...(gh === undefined ? {} : { gh }),
    casesFolder,
    chosen: flags.out !== undefined,
    // npm writes its cache and logs into Code Sleuth's own folder: held to the same guard as the cases.
    ...(npm === undefined || io.npmFolder === undefined
      ? {}
      : { alsoWrites: [{ kind: "npm" as const, path: io.npmFolder }] }),
    all: flags.all ?? false,
    ...(denyList === undefined ? {} : { denyList }),
    ...(flags.examples === undefined ? {} : { examples: flags.examples }),
    onOpen: ({ id, repo: info }) => human(header(id, info, goal.id, goal.checks.length, asked, outgoing)),
    onOutcome: (_, index, total) => human(copy.run.tick + (index === total - 1 ? `${copy.run.done}\n` : "")),
  });

  let record: CaseRecord;
  try {
    human(
      report(
        draft.record,
        draft.outcomes,
        { casePath: draft.path, all: flags.all ?? false },
        painter(colour),
      ),
    );
    const polished = polish.client === undefined ? undefined : await polishAll(draft.cards, polish, human);
    const cards = polished?.cards ?? draft.cards;
    const filing =
      flags.toolkit && detection.state === "detected"
        ? await fileCards(draft, cards, detection, toolkitOptions, flags, io, human)
        : undefined;
    record = draft.close(
      {
        polish: polish.state,
        toolkit: toolkitRecord(detection, filing, spaceFrom),
        ...(flags.toolkitSpace === undefined ? {} : { toolkitSpace: flags.toolkitSpace }),
      },
      polished,
    );
  } catch (error) {
    draft.discard();
    throw error;
  }

  const examples = examplesLine(record);
  if (examples !== undefined) human(`${copy.run.examples}   ${examples}\n`);
  human(`${copy.run.polish}     ${polishLine(record, polish.runnableCopy)}\n`);
  const toolkit = record.enhancements!.toolkit!;
  const line = toolkitLine(toolkit, goal.id, flags.toolkitSpace);
  // Without ToolKit the run ends with the upsell, once, on its own; with it, the ToolKit line.
  human(
    toolkit.state === "not-installed"
      ? `${line}\n`
      : `${copy.toolkit.footer}    ${line.replace(/^ToolKit: /, "")}\n`,
  );
  if (flags.json) io.stdout(JSON.stringify(record, null, 2) + "\n");

  // A refusal from ToolKit is said once, in Code Sleuth's own two lines, after the case is safely written.
  const stopped =
    record.enhancements?.toolkit?.state === "detected"
      ? record.enhancements.toolkit.filing?.stopped
      : undefined;
  if (stopped !== undefined && detection.state === "detected") {
    throw new Refusal(
      stopped.failed
        ? copy.toolkit.failed(stopped.check, stopped.sentence)
        : copy.toolkit.refused(stopped.check, stopped.sentence),
      stopped.failed ? copy.toolkit.failedHint(detection.prefix) : copy.toolkit.refusedHint,
    );
  }

  if (failOn === undefined) return EXIT_OK;
  const bar = WEIGHTS.indexOf(failOn);
  const hit = record.checks.some((c) => c.verdict === "found" && WEIGHTS.indexOf(c.weight!) <= bar);
  return hit ? EXIT_FOUND : EXIT_OK;
}

function checkFolder(path: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:\/\/|[^/\\\s]+@[^:/\s]+:)/i.test(path))
    throw new Refusal(copy.url(path), copy.urlHint);
  const absolute = resolve(path);
  let isFolder: boolean;
  try {
    isFolder = statSync(absolute).isDirectory();
  } catch {
    throw new Refusal(copy.missing(path), copy.missingHint);
  }
  if (!isFolder) throw new Refusal(copy.notAFolder(path), copy.notAFolderHint);
  try {
    accessSync(absolute, constants.R_OK | constants.X_OK);
  } catch {
    throw new Refusal(copy.unreadable(path), copy.unreadableHint);
  }
  return absolute;
}

function checkWeight(weight: string): Weight {
  if (weight === "smoking-gun" || weight === "loose-end") return weight;
  throw new Refusal(copy.unknownWeight(weight), copy.unknownWeightHint);
}

async function pickGoal(
  given: string | undefined,
  io: Io,
  canAsk: boolean,
): Promise<{ goal: Goal; asked: boolean }> {
  if (given !== undefined) return { goal: investigable(given), asked: false };
  if (!canAsk || io.ask === undefined) throw new Refusal(copy.noGoal, copy.noGoalHint);
  io.stdout(`${copy.run.question}\n\n${copy.ask.choices}\n`);
  const answer = (await io.ask(copy.ask.prompt)).trim();
  io.stdout("\n");
  if (answer !== "" && answer !== "1")
    throw new Refusal(copy.ask.notAChoice(answer), copy.ask.notAChoiceHint);
  return { goal: investigable("public"), asked: true };
}

function investigable(id: string): Goal {
  const goal = findGoal(id);
  if (goal === undefined) throw new Refusal(copy.unknownGoal(id), copy.goalHint);
  if (!INVESTIGABLE.includes(id)) throw new Refusal(copy.goalNotYet(id), copy.goalNotYetHint);
  return goal;
}

/** The deny list's lines. It must be readable, and it must not live inside the repository it guards. */
function readDenyList(path: string, root: string): string[] {
  const absolute = resolve(path);
  if (isInside(absolute, root)) throw new Refusal(copy.denyInside(path), copy.denyInsideHint);
  try {
    return readFileSync(absolute, "utf8").split(/\r?\n/);
  } catch {
    throw new Refusal(copy.denyUnreadable(path), copy.denyUnreadableHint);
  }
}
