import { spawnChild } from "../spawn.js";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";

/** How a check runs a tool (npm, gh): an argument array in a folder, and what came back. */
export interface ToolRunner {
  run(
    args: readonly string[],
    cwd: string,
  ): { status: number | null; stdout: string; stderr: string; error?: Error };
}

export type NpmRunner = ToolRunner;

/**
 * Finds npm by asking the file system. On Windows `npm` is a .cmd shim, which Node will not start without a
 * shell, so npm's own script, npm-cli.js beside node, runs under node itself; with no such script there is no
 * npm to run. Elsewhere it is the `npm` on the PATH.
 */
export function findNpm(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
  execPath: string = process.execPath,
  folder: string = join(tmpdir(), "code-sleuth-npm"),
): NpmRunner | undefined {
  const npmEnv = { ...env, ...NPM_QUIET, ...npmWrites(folder) };
  if (platform === "win32") {
    const cli = join(dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
    return existsSync(cli) ? runner(execPath, [cli], npmEnv) : undefined;
  }
  const npm = onPath("npm", env, platform);
  return npm === undefined ? undefined : runner(npm, [], npmEnv);
}

/**
 * Where npm may write: its cache and its debug logs, both in a folder of Code Sleuth's own. A repository's
 * `.npmrc` could point either into the repository (`cache=./x`, `logs-dir=./y`), and npm writes a log on every
 * command; npm's settings from the environment outrank the project's `.npmrc`, so these win.
 */
export function npmWrites(folder: string): NodeJS.ProcessEnv {
  return { npm_config_cache: join(folder, "cache"), npm_config_logs_dir: join(folder, "logs") };
}

/**
 * Finds the GitHub CLI on the PATH: `gh`, or `gh.exe` on Windows, which Node starts without a shell. Whether
 * it is signed in is not asked here, since asking would call GitHub: a gh that is not answers with an error.
 */
export function findGh(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): ToolRunner | undefined {
  const gh = onPath(platform === "win32" ? "gh.exe" : "gh", env, platform);
  return gh === undefined
    ? undefined
    : runner(gh, [], { ...env, GH_PROMPT_DISABLED: "1", GH_NO_UPDATE_NOTIFIER: "1" });
}

function onPath(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | undefined {
  const separator = platform === "win32" ? ";" : delimiter;
  for (const folder of (env.PATH ?? env.Path ?? "").split(separator).filter((f) => f !== "")) {
    const path = join(folder, name);
    if (isExecutable(path, platform)) return path;
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

/**
 * npm with its own configuration left alone -- .npmrc and any scoped or private registry decide where its calls
 * go -- and only its own chatter turned off: no update notice, no funding message. Where it writes is set apart
 * (npmWrites).
 */
const NPM_QUIET = { npm_config_update_notifier: "false", npm_config_fund: "false" };

function runner(command: string, prefix: readonly string[], quiet: NodeJS.ProcessEnv): ToolRunner {
  return {
    run(args, cwd) {
      const result = spawnChild(command, [...prefix, ...args], {
        cwd,
        env: quiet,
        encoding: "utf8",
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 64 * 1024 * 1024,
      });
      return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        ...(result.error ? { error: result.error } : {}),
      };
    },
  };
}
