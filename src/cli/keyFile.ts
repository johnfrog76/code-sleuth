import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { relative, sep } from "node:path";
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
export function shownPath(path: string, home: string = homedir()): string {
  const rest = relative(home, path);
  return rest !== "" && !rest.startsWith("..") && !rest.startsWith(sep) ? `~${sep}${rest}` : path;
}
