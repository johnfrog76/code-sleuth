import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Refusal } from "../refusal.js";
import { copy } from "./copy.js";

/** The per-user cases folder, for this platform. Never inside a repository. */
export function defaultCasesFolder(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  if (platform === "darwin") return join(home, "Library", "Application Support", "code-sleuth", "cases");
  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "code-sleuth", "cases");
  }
  return join(env.XDG_DATA_HOME || join(home, ".local", "share"), "code-sleuth", "cases");
}

/**
 * Refuses a cases folder inside the repository, and a repository that holds the cases folder --
 * `code-sleuth ~` among them. Either way a run would write into the tree it judges, and read its own cases.
 */
export function guardCasesFolder(repoRoot: string, casesFolder: string, chosen: boolean): void {
  const repo = canonical(repoRoot);
  const cases = canonical(casesFolder);
  if (!isWithin(cases, repo)) return;
  if (chosen) throw new Refusal(copy.outInsideRepo(casesFolder), copy.outInsideRepoHint);
  throw new Refusal(copy.repoHoldsCases(repoRoot), copy.repoHoldsCasesHint);
}

/** `<folder name>-<first 8 of a hash of the absolute path>`: one folder per repository on this machine. */
export function repoKey(repoRoot: string): string {
  const absolute = canonical(repoRoot);
  const hash = createHash("sha256").update(absolute).digest("hex").slice(0, 8);
  return `${basename(absolute) || "root"}-${hash}`;
}

/**
 * Makes the folder for a new case and returns its id and path. `n` counts that day's runs of that goal
 * from 1. A case folder is never reused: each one is made with a create that fails if it exists.
 */
export function newCaseFolder(repoFolder: string, date: string, goal: string): { id: string; path: string } {
  mkdirSync(repoFolder, { recursive: true });
  const prefix = `${date}-${goal}-`;
  const taken = readdirSync(repoFolder)
    .filter((name) => name.startsWith(prefix))
    .map((name) => Number(name.slice(prefix.length)))
    .filter((n) => Number.isInteger(n) && n > 0);
  for (let n = Math.max(0, ...taken) + 1; ; n++) {
    const id = `${prefix}${n}`;
    const path = join(repoFolder, id);
    try {
      mkdirSync(path);
      return { id, path };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

/** The real path, resolving links and case, of a path whose tail may not exist yet. */
function canonical(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync.native(absolute);
  const parent = dirname(absolute);
  return parent === absolute ? absolute : join(canonical(parent), basename(absolute));
}

/** True when `path` is the folder `root` or anything inside it, comparing real paths: links and case resolved. */
export function isInside(path: string, root: string): boolean {
  return isWithin(canonical(path), canonical(root));
}

function isWithin(child: string, parent: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

/** The file in the cases folder that holds this machine's key for hashing secrets. */
export const MACHINE_KEY_FILE = "machine-key";

/**
 * This machine's random key for hashing secrets, made on first use and kept in the cases folder, readable
 * by its owner only. A keyed hash lets two runs tell it is the same secret without the hash being guessable.
 */
export function machineKey(casesFolder: string): Buffer {
  mkdirSync(casesFolder, { recursive: true });
  const path = join(casesFolder, MACHINE_KEY_FILE);
  try {
    writeFileSync(path, randomBytes(32).toString("hex") + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const key = Buffer.from(readFileSync(path, "utf8").trim(), "hex");
  if (key.length !== 32) throw new Error(`The machine key in ${path} is not 32 bytes of hex.`);
  return key;
}
