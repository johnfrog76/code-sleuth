import {
  spawnSync,
  type SpawnSyncOptions,
  type SpawnSyncOptionsWithBufferEncoding,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Code Sleuth's own folder for the children that need one: the folder that holds `handoff.ps1`, shipped with the
 * package. PowerShell and gh start here, never in the investigated repository or the person's working folder,
 * so nothing in either can be read as their configuration. The same relative path from `src/` and `dist/`.
 */
export const OWN_FOLDER = fileURLToPath(new URL("../toolkit/", import.meta.url));

/** The variable the model key is read from. Its value never reaches a process Code Sleuth starts. */
export const KEY_VARIABLE = "ANTHROPIC_API_KEY";

/**
 * The environment a child gets: the one given, without the model key, in any letter case. Windows matches
 * variable names without regard to case, and a copy of `process.env` keeps the person's own casing, so
 * `anthropic_api_key` would reach a child there. Dropping every casing everywhere is simpler, and harmless.
 */
export function withoutKey(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env))
    if (name.toUpperCase() !== KEY_VARIABLE) child[name] = value;
  return child;
}

/**
 * Every child process Code Sleuth starts goes through here: git, npm, gh and ToolKit's shell. An argument array,
 * never a command string, and an environment with the model key taken out. A test holds every other file in
 * `src/` away from `node:child_process`.
 */
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string>;
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithBufferEncoding,
): SpawnSyncReturns<Buffer>;
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
): SpawnSyncReturns<string | Buffer> {
  const env = absolutePathOnly(withoutKey(options.env ?? process.env));
  // A bare name is found on the PATH here, in absolute folders only, and started by its full path: started by
  // name, it would be looked for in the child's folder first on Windows, and that folder is the repository.
  const file = isBare(command) ? onPath(command, env) : command;
  if (file === undefined) return notFound(command, options.encoding);
  return spawnSync(file, args, { ...options, env });
}

/** A command named without a folder: `git`, not `/usr/bin/git`. */
function isBare(command: string): boolean {
  return !/[\\/]/.test(command);
}

/** The PATH's folders, absolute ones only: an empty or relative entry is read against the child's own folder. */
export function pathFolders(env: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string[] {
  const path = platform === "win32" ? win32 : posix;
  const value = Object.entries(env).find(([name]) => name.toUpperCase() === "PATH")?.[1] ?? "";
  return value.split(path.delimiter).filter((folder) => folder !== "" && path.isAbsolute(folder));
}

/**
 * The environment with its PATH cut to absolute folders, so a child the child starts cannot be found in the
 * repository either. PSModulePath, where PowerShell looks for a module, keeps its absolute folders only too:
 * a relative one is read against PowerShell's own working folder.
 */
function absolutePathOnly(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  const delimiter = process.platform === "win32" ? win32.delimiter : posix.delimiter;
  for (const name of Object.keys(out)) {
    const upper = name.toUpperCase();
    if (upper === "PATH") out[name] = pathFolders(env).join(delimiter);
    if (upper === "PSMODULEPATH") out[name] = absoluteFolders(out[name] ?? "").join(delimiter);
  }
  return out;
}

/** A list of folders, absolute ones only. */
export function absoluteFolders(value: string, platform: NodeJS.Platform = process.platform): string[] {
  const path = platform === "win32" ? win32 : posix;
  return value.split(path.delimiter).filter((folder) => folder !== "" && path.isAbsolute(folder));
}

/**
 * The first file of this name in the PATH's absolute folders, by asking the file system. On Windows a name
 * without an extension is looked for as `.exe` and `.com`, the files Node starts without a shell.
 */
export function onPath(
  name: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const path = platform === "win32" ? win32 : posix;
  const names = platform === "win32" && path.extname(name) === "" ? [`${name}.exe`, `${name}.com`] : [name];
  for (const folder of pathFolders(env, platform))
    for (const file of names) {
      const full = path.join(folder, file);
      if (isExecutable(full, platform)) return full;
    }
  return undefined;
}

function isExecutable(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    // Windows has no execute bit: a .exe file is enough.
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** What spawnSync gives for a command it cannot find, without looking anywhere else for it. */
function notFound(
  command: string,
  encoding: SpawnSyncOptions["encoding"],
): SpawnSyncReturns<string | Buffer> {
  const empty = encoding === "buffer" || encoding === undefined ? Buffer.alloc(0) : "";
  const error = Object.assign(new Error(`spawnSync ${command} ENOENT`), { code: "ENOENT", path: command });
  return {
    pid: 0,
    output: [null, empty, empty],
    stdout: empty,
    stderr: empty,
    status: null,
    signal: null,
    error,
  };
}
