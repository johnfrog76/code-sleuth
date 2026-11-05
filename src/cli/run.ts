import { parseArgs } from "node:util";
import { findGoal } from "../engine/goals.js";
import { version } from "../version.js";
import { checksTable } from "./checks.js";
import { copy } from "./copy.js";
import { investigate } from "./investigate.js";
import {
  EXIT_INTERRUPTED,
  EXIT_OK,
  EXIT_UNEXPECTED,
  Interrupted,
  type Io,
  oneLine,
  Refusal,
  refuse,
} from "./refusal.js";
import { maskSecrets } from "../engine/secrets/scan.js";

/** Every flag the CLI takes: the one list, which docs/CLI.md is held to. */
export const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  goal: { type: "string" },
  out: { type: "string" },
  deny: { type: "string" },
  all: { type: "boolean" },
  json: { type: "boolean" },
  "fail-on": { type: "string" },
  toolkit: { type: "boolean" },
  polish: { type: "boolean" },
  examples: { type: "string", multiple: true },
  offline: { type: "boolean" },
  yes: { type: "boolean" },
  refile: { type: "boolean" },
  "toolkit-prefix": { type: "string" },
  "toolkit-space": { type: "string" },
} as const;

/** Runs the CLI over its arguments and returns the exit code. */
export async function run(argv: readonly string[], io: Io): Promise<number> {
  try {
    const { values, positionals } = parse(argv);
    if (values.version) {
      io.stdout(`${version()}\n`);
      return EXIT_OK;
    }
    if (values.help) {
      io.stdout(copy.help(version()));
      return EXIT_OK;
    }
    const [first, extra] = positionals;
    if (extra !== undefined) throw new Refusal(copy.unexpectedArgument(extra), copy.seeHelp);
    if (first === "checks") {
      const goal = values.goal === undefined ? undefined : findGoal(values.goal);
      if (values.goal !== undefined && goal === undefined)
        throw new Refusal(copy.unknownGoal(values.goal), copy.goalHint);
      io.stdout(checksTable(goal));
      return EXIT_OK;
    }
    return await investigate(
      first,
      {
        ...(values.goal === undefined ? {} : { goal: values.goal }),
        ...(values.out === undefined ? {} : { out: values.out }),
        ...(values.deny === undefined ? {} : { deny: values.deny }),
        ...(values["fail-on"] === undefined ? {} : { failOn: values["fail-on"] }),
        ...(values["toolkit-prefix"] === undefined ? {} : { toolkitPrefix: values["toolkit-prefix"] }),
        ...(values["toolkit-space"] === undefined ? {} : { toolkitSpace: values["toolkit-space"] }),
        all: values.all ?? false,
        json: values.json ?? false,
        toolkit: values.toolkit ?? false,
        polish: values.polish ?? false,
        ...(values.examples === undefined ? {} : { examples: values.examples }),
        offline: values.offline ?? false,
        yes: values.yes ?? false,
        refile: values.refile ?? false,
      },
      io,
    );
  } catch (error) {
    if (error instanceof Refusal) return refuse(error, io);
    if (error instanceof Interrupted) {
      io.stdout("\n");
      return EXIT_INTERRUPTED;
    }
    return unexpected(error, io);
  }
}

/**
 * Anything that is not a stated refusal: one Error: line with its message, masked and printable, one Hint:
 * line saying where to report it, and exit 3, never 1 (which only --fail-on gives) nor a stack trace, unless
 * CODE_SLEUTH_DEBUG is set.
 */
export function unexpected(error: unknown, io: Io): number {
  const message = error instanceof Error ? error.message : String(error);
  io.stderr(`Error: ${oneLine(copy.unexpected(maskSecrets(message, "")))}\n`);
  io.stderr(`Hint: ${copy.unexpectedHint}\n`);
  if ((io.env ?? {}).CODE_SLEUTH_DEBUG && error instanceof Error && error.stack)
    io.stderr(`${error.stack}\n`);
  return EXIT_UNEXPECTED;
}

function parse(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      options: OPTIONS,
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    throw toRefusal(error);
  }
}

function toRefusal(error: unknown): unknown {
  if (!(error instanceof Error) || !("code" in error)) return error;
  const message = error.message;
  if (error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    const flag = /'([^']+)'/.exec(message)?.[1] ?? "given";
    return new Refusal(copy.unknownFlag(flag), copy.seeHelp);
  }
  if (error.code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL") {
    const arg = /'([^']+)'/.exec(message)?.[1] ?? "that";
    return new Refusal(copy.unexpectedArgument(arg), copy.seeHelp);
  }
  if (error.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
    // Node's own words run to three lines; the refusal says it in one, in the copy's.
    const flag = /'(--?[\w-]+)/.exec(message)?.[1] ?? "That flag";
    return new Refusal(
      /does not take an argument/.test(message) ? copy.flagTakesNoValue(flag) : copy.flagNeedsValue(flag),
      copy.seeHelp,
    );
  }
  return error;
}
