import { spawnChild } from "../spawn.js";
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";

/** How a check runs a tool (npm, gh): an argument array in a folder, and what came back. */
export interface ToolRunner {
  run(
    args: readonly string[],
    cwd: string,
  ): { status: number | null; stdout: string; stderr: string; error?: Error };
}

/**
 * How a check runs npm: on a copy of the project. With `manifest`, the copy holds that package.json alone, in
 * place of the project's files.
 */
export interface NpmRunner {
  run(args: readonly string[], project: string, manifest?: string): ReturnType<ToolRunner["run"]>;
}

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
  const npmEnv = { ...npmEnvironment(env), ...NPM_QUIET, ...npmWrites(folder) };
  if (platform === "win32") {
    const cli = join(dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
    return existsSync(cli) ? inCopy(runner(execPath, [cli], npmEnv), folder) : undefined;
  }
  const npm = onPath("npm", env, platform);
  return npm === undefined ? undefined : inCopy(runner(npm, [], npmEnv), folder);
}

/** What npm reads of a project: its manifest and its lockfile. Nothing else is copied. */
export const NPM_PROJECT_FILES: readonly string[] = [
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
];

/**
 * npm, run on a copy of the project's manifest and lockfile in a fresh folder of Code Sleuth's own, never in the
 * repository. In the repository, its `.npmrc` would be npm's project config: it could point the registry, or a
 * proxy, at a host of its choosing, and have the user's own token sent there, or name `${VARIABLE}` in a URL and
 * have the value sent. In the copy, only the user's own config applies. The folder is removed after.
 */
function inCopy(npm: ToolRunner, folder: string): NpmRunner {
  return {
    run(args, project, manifest) {
      mkdirSync(folder, { recursive: true });
      const work = mkdtempSync(join(folder, "project-"));
      try {
        if (manifest !== undefined) writeFileSync(join(work, "package.json"), manifest);
        else
          for (const name of NPM_PROJECT_FILES) {
            const from = join(project, name);
            if (isRegularFile(from)) writeFileSync(join(work, name), readFileSync(from));
          }
        // npm takes the nearest folder up with a package.json as the project, and reads its .npmrc. With the
        // copy's own, that is the copy; without one it would climb into Code Sleuth's folders, so npm is not run.
        // (--prefix would pin it too, but moves npm's global config away from the user's own.)
        if (!isRegularFile(join(work, "package.json")))
          return { status: null, stdout: "", stderr: "", error: new Error("no package.json to copy") };
        return npm.run(args, work);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
  };
}

function isRegularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * The variables npm may see: what it needs to run and to reach the network (the PATH, the home and temporary
 * folders, the locale, proxies and certificates), the user's own `npm_config_*` settings, and each variable the
 * user's own `.npmrc` names as `${NAME}`, so a token kept in the environment still reaches the registry it is
 * for. Nothing else: no other secret of the user's is there to be sent.
 */
export function npmEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const named = new Set(namedInUserConfig(env).map((name) => name.toUpperCase()));
  const passed: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (NPM_NEEDS.test(name) || named.has(name.toUpperCase())) passed[name] = value;
  }
  return passed;
}

const NPM_NEEDS =
  /^(?:PATH|PATHEXT|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|TMPDIR|LANG|LANGUAGE|LC_[A-Z]+|TZ|HTTPS?_PROXY|NO_PROXY|ALL_PROXY|NODE_EXTRA_CA_CERTS|SSL_CERT_FILE|SSL_CERT_DIR|NPM_CONFIG_[A-Z0-9_-]+)$/i;

/** The variables the user's own `.npmrc` names, as `${NAME}` or `${NAME?}`. */
function namedInUserConfig(env: NodeJS.ProcessEnv): string[] {
  const configured = Object.entries(env).find(
    ([name]) => name.toLowerCase() === "npm_config_userconfig",
  )?.[1];
  const home = env.HOME ?? env.USERPROFILE ?? homedir();
  let text: string;
  try {
    text = readFileSync(configured ?? join(home, ".npmrc"), "utf8");
  } catch {
    return [];
  }
  return [...text.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\??\}/g)].map((match) => match[1]!);
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
 * npm with the user's own configuration left alone -- their .npmrc and any scoped or private registry decide
 * where its calls go -- and only its own chatter turned off: no update notice, no funding message. Where it
 * writes is set apart (npmWrites), and the project it reads is a copy (inCopy).
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
