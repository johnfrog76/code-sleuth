import { findShell, plain, runHandoff, type Shell } from "./shell.js";
import type { SpaceAddress } from "./space.js";

/** ToolKit's shipped command prefix. */
export const DEFAULT_PREFIX = "tk";
const PROBE_LINE = /^CODE-SLEUTH-PROBE (.*)$/m;

export type Detection =
  | { state: "not-installed"; reason: string }
  /** Not looked for: under --offline no PowerShell is started, since it can make calls of its own. */
  | { state: "not-probed"; reason: "--offline" }
  | {
      state: "detected";
      via: "cli";
      shell: Shell;
      prefix: string;
      /** The Space ToolKit will file in, or null when it did not say. */
      space: string | null;
      /** The Spaces ToolKit declares, or null when it did not say. */
      spaces: string[] | null;
      /** Each declared Space's address, or null when ToolKit did not say: how the repository's own Space is found. */
      addresses: SpaceAddress[] | null;
      /** The hub ToolKit resolved, for the tests' guard; never written to a case. */
      root: string | null;
      /** The folders NewPrompt writes a card into for the Space in play (current/, backlog/), or null. */
      folders: string[] | null;
    };

export interface DetectOptions {
  env: NodeJS.ProcessEnv;
  prefix?: string;
  /** `--toolkit-space`: set as P20_ACTIVE_SPACE in the child shell only, so the person's config is never changed. */
  space?: string;
  /** Only for tests: the folder ToolKit is loaded from. */
  moduleRoot?: string;
  platform?: NodeJS.Platform;
}

/**
 * PowerShell's own calls off the machine, turned off for every ToolKit child, whatever the flags: its startup
 * telemetry and its check for a newer version.
 */
export const POWERSHELL_QUIET = { POWERSHELL_TELEMETRY_OPTOUT: "1", POWERSHELL_UPDATECHECK: "Off" } as const;

/**
 * The environment a ToolKit child gets, the probe and the filing alike: the run's own, with PowerShell's own
 * calls turned off, plus the Space when one was named.
 */
export function childEnv(options: DetectOptions): NodeJS.ProcessEnv {
  // A value of the person's own, in any letter case, gives way: Windows reads these names without regard to case.
  const quiet = Object.keys(POWERSHELL_QUIET);
  const own = Object.entries(options.env).filter(([name]) => !quiet.includes(name.toUpperCase()));
  return {
    ...Object.fromEntries(own),
    ...POWERSHELL_QUIET,
    ...(options.space === undefined ? {} : { P20_ACTIVE_SPACE: options.space }),
  };
}

/** The extra arguments every call to the hand-off carries. */
export function commonArgs(prefix: string, moduleRoot: string | undefined): string[] {
  return ["-Prefix", prefix, ...(moduleRoot === undefined ? [] : ["-ModuleRoot", moduleRoot])];
}

/** Asks, in order: is there a shell, and does ToolKit's NewPrompt resolve in it. Never reads ToolKit's files. */
/** Why ToolKit was not looked for at all: no PowerShell to start. Any other outcome started one. */
export const NO_POWERSHELL = "no PowerShell on the PATH";

/** True when looking for ToolKit started a PowerShell: whatever it found, ToolKit's module may have loaded. */
export function probed(detection: Detection): boolean {
  return (
    detection.state === "detected" ||
    (detection.state === "not-installed" && detection.reason !== NO_POWERSHELL)
  );
}

export function detectToolkit(options: DetectOptions): Detection {
  const shell = findShell(options.env, options.platform);
  if (shell === undefined) return { state: "not-installed", reason: NO_POWERSHELL };
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const result = runHandoff(shell, ["-Probe", ...commonArgs(prefix, options.moduleRoot)], childEnv(options));
  const line = result.status === 0 ? PROBE_LINE.exec(plain(result.stdout))?.[1] : undefined;
  if (line === undefined)
    return { state: "not-installed", reason: `${prefix}NewPrompt does not resolve in ${shell.name}` };

  let answer: {
    prefix?: unknown;
    space?: unknown;
    spaces?: unknown;
    addresses?: unknown;
    root?: unknown;
    folders?: unknown;
  };
  try {
    answer = JSON.parse(line) as typeof answer;
  } catch {
    answer = {};
  }
  const spaces = Array.isArray(answer.spaces)
    ? answer.spaces.filter((s): s is string => typeof s === "string")
    : null;
  return {
    state: "detected",
    via: "cli",
    shell,
    prefix: typeof answer.prefix === "string" && answer.prefix !== "" ? answer.prefix : prefix,
    space: typeof answer.space === "string" && answer.space !== "" ? answer.space : null,
    spaces,
    addresses: readAddresses(answer.addresses),
    root: typeof answer.root === "string" ? answer.root : null,
    folders: Array.isArray(answer.folders)
      ? answer.folders.filter((f): f is string => typeof f === "string" && f !== "")
      : null,
  };
}

/**
 * True when ToolKit confirmed the Space named: it reports that Space as active, and declares it. An undeclared
 * slug does not fail in ToolKit -- it falls back to another Space -- so both have to hold.
 */
export function confirmsSpace(detection: Detection, slug: string): boolean {
  return (
    detection.state === "detected" && detection.space === slug && (detection.spaces ?? []).includes(slug)
  );
}

/** The probe's addresses, as far as they read: a Space with no slug is dropped, a missing org is null. */
function readAddresses(value: unknown): SpaceAddress[] | null {
  if (!Array.isArray(value)) return null;
  const strings = (v: unknown): string[] =>
    (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]).filter(
      (s): s is string => typeof s === "string" && s !== "",
    );
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { slug, org, repos } = entry as { slug?: unknown; org?: unknown; repos?: unknown };
    if (typeof slug !== "string" || slug === "") return [];
    return [{ slug, org: typeof org === "string" && org !== "" ? org : null, repos: strings(repos) }];
  });
}
