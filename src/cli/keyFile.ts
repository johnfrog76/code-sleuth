import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import defaultPaths, { type PlatformPath, posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { KEY_VARIABLE } from "../polish/client.js";

export interface KeyFileRead {
  /** The model key, when the file holds one. */
  key?: string;
  /** True on POSIX when the file can be read by its group or by others. */
  loose?: boolean;
}

/**
 * Reads Code Sleuth's own .env for the model key. It is parsed, never loaded: only ANTHROPIC_API_KEY is taken,
 * and nothing is written to the environment, so the npm, gh and PowerShell children never inherit the key. No
 * file, or one that cannot be read, gives nothing.
 */
export function readKeyFile(path: string, platform: NodeJS.Platform = process.platform): KeyFileRead {
  let mode: number;
  let text: string;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return {};
    mode = stat.mode;
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  let values: Record<string, string | undefined>;
  try {
    values = parseEnv(text) as Record<string, string | undefined>;
  } catch {
    values = {};
  }
  const key = values[KEY_VARIABLE]?.trim() || undefined;
  const loose = platform !== "win32" && (mode & 0o077) !== 0;
  return { ...(key === undefined ? {} : { key }), ...(loose ? { loose: true } : {}) };
}

/** A path as a person reads it: under the home folder, it starts `~`. */
export function shownPath(
  path: string,
  home: string = homedir(),
  paths: PlatformPath = defaultPaths,
): string {
  const rest = paths.relative(home, path);
  // On Windows a path on another drive is not under home, though relative() gives it whole, not with a `..`.
  const under = rest !== "" && rest !== ".." && !rest.startsWith(`..${paths.sep}`) && !paths.isAbsolute(rest);
  return under ? `~${paths.sep}${rest}` : path;
}

/**
 * The `.env.example` beside the running command, at the package's root: found from this file's own place, so
 * it is the right one for a clone, a global install or npx's cache alike. Undefined if it is not there.
 */
export function exampleFile(): string | undefined {
  const path = fileURLToPath(new URL("../../.env.example", import.meta.url));
  return existsSync(path) ? path : undefined;
}

/**
 * One line that copies the example into place, with both paths quoted, for the platform's own shell: a POSIX
 * shell on macOS and Linux (and the file made yours alone), PowerShell on Windows.
 */
export function copyCommand(
  example: string,
  keyFile: string,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === "win32") {
    // PowerShell takes the curly quotes for a straight one too: each is doubled, or a folder like O’Brien
    // ends the string early.
    const q = (text: string) => `'${text.replace(/['\u2018\u2019\u201a\u201b]/g, (quote) => quote + quote)}'`;
    return `New-Item -ItemType Directory -Force ${q(win32.dirname(keyFile))} | Out-Null; Copy-Item ${q(example)} ${q(keyFile)}`;
  }
  const q = (text: string) => `'${text.replace(/'/g, "'\\''")}'`;
  return `mkdir -p ${q(posix.dirname(keyFile))} && cp ${q(example)} ${q(keyFile)} && chmod 600 ${q(keyFile)}`;
}
