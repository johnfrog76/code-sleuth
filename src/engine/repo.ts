import { Refusal } from "../refusal.js";
import { spawnChild } from "../spawn.js";
import { gitTooOld, gitTooOldHint } from "./copy.js";
import { closeSync, lstatSync, openSync, readdirSync, readFileSync, readSync } from "node:fs";
import { delimiter, join, resolve, sep } from "node:path";

/** Folders the text checks never read, at any depth. */
export const SKIPPED_FOLDERS: readonly string[] = ["node_modules", "vendor", "dist", "build"];

export interface RepoReader {
  /** The absolute path of the root the investigation was pointed at. */
  readonly root: string;
  /**
   * The repository the root is in: the outermost git work tree holding it, a submodule's superproject included,
   * or the root itself outside git. Nothing Code Sleuth writes may be inside it.
   */
  readonly top: string;
  /** True when the root is inside a git work tree, and `files` came from `git ls-files`. */
  readonly isGitRepository: boolean;
  /**
   * True for a partial clone: a remote is a promisor, so some of the history's objects are not here. Code Sleuth
   * never fetches them, so the history cannot be read whole.
   */
  readonly isPartialClone: boolean;
  /** True for a shallow clone: the history stops at a cut, and what came before it is not here. */
  readonly isShallow: boolean;
  /** Every file: tracked files in a repository, else every file under the root. Sorted, relative, `/`. */
  readonly files: readonly string[];
  /** `files` without anything under a skipped folder. What the text checks read. */
  readonly textFiles: readonly string[];
  has(path: string): boolean;
  readText(path: string): string | undefined;
  /** The file's size in bytes. */
  size(path: string): number;
  /**
   * Every commit message on every ref, oldest first. Read once, on first use. Undefined outside a
   * repository, or when git cannot read the history.
   */
  commitMessages(): readonly { commit: string; text: string }[] | undefined;
  /** True for a file a text check should not read: it holds a NUL byte in its first 8 KB. */
  isBinary(path: string): boolean;
  /**
   * Every line added in the history of every ref, oldest commit first: `git log -p --all`. Read once, on
   * first use. Undefined outside a repository, or when git cannot read the history.
   */
  addedLines(): readonly AddedLine[] | undefined;
}

export interface AddedLine {
  commit: string;
  path: string;
  line: number;
  text: string;
}

/** Opens a repository for reading. It reads files and runs `git`; it never writes anything. */
export function openRepo(root: string): RepoReader {
  const absolute = resolve(root);
  const tracked = gitTrackedFiles(absolute);
  const folders = new Map<string, boolean>();
  const files = (tracked ?? walk(absolute))
    .filter((path) => isFileHere(absolute, path, folders))
    .sort(byBytes);
  const known = new Set(files);
  const cache = new Map<string, string>();
  let history: readonly AddedLine[] | undefined | null = null;
  let messages: readonly { commit: string; text: string }[] | undefined | null = null;

  return {
    root: absolute,
    top: tracked === undefined ? absolute : outermostWorkTree(absolute),
    isGitRepository: tracked !== undefined,
    isPartialClone: tracked !== undefined && partialClone(absolute),
    isShallow: tracked !== undefined && shallow(absolute),
    files,
    textFiles: files.filter((path) => !path.split("/").some((part) => SKIPPED_FOLDERS.includes(part))),
    has: (path) => known.has(path),
    readText(path) {
      if (!known.has(path)) return undefined;
      let text = cache.get(path);
      if (text === undefined) {
        text = readFileSync(join(absolute, path), "utf8");
        cache.set(path, text);
      }
      return text;
    },
    size: (path) => (known.has(path) ? lstatSync(join(absolute, path)).size : 0),
    commitMessages() {
      if (messages === null) messages = tracked === undefined ? undefined : readMessages(absolute);
      return messages;
    },
    isBinary(path) {
      if (!known.has(path)) return false;
      const fd = openSync(join(absolute, path), "r");
      try {
        const head = Buffer.alloc(8192);
        const read = readSync(fd, head, 0, head.length, 0);
        return head.subarray(0, read).includes(0);
      } finally {
        closeSync(fd);
      }
    },
    addedLines() {
      if (history === null) history = tracked === undefined ? undefined : readHistory(absolute);
      return history;
    },
  };
}

/** `git log --all --reverse`, one record per commit: its hash and its whole message. */
function readMessages(root: string): { commit: string; text: string }[] | undefined {
  const log = git(root, ["log", "--all", "--reverse", "--no-color", "--format=%H%x00%B%x00"]);
  if (log.error) return undefined;
  if (log.status !== 0) return noHistory(root) ? [] : undefined;
  const parts = log.stdout.toString("utf8").split("\0");
  const found: { commit: string; text: string }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    found.push({ commit: parts[i]!.trim(), text: parts[i + 1]!.replace(/\n+$/, "") });
  }
  return found;
}

/** Parses `git log -p --all --reverse -U0`: only the `+` lines, each with its commit, path and line number. */
function readHistory(root: string): AddedLine[] | undefined {
  const log = git(root, [
    "-c",
    "core.quotepath=off",
    // Over this size git calls a file binary and shows no lines; a repository can set it to 1.
    "-c",
    "core.bigFileThreshold=1g",
    "log",
    "-p",
    "--all",
    "--reverse",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    // Every file as text: a `-diff` or `binary` attribute, the repository's to set, would hide a file's lines.
    "--text",
    // A merge's own lines too: what was added in resolving one, against its first parent.
    "--diff-merges=first-parent",
    "-U0",
    "--format=commit %H",
  ]);
  if (log.error) return undefined;
  if (log.status !== 0) return noHistory(root) ? [] : undefined;
  const lines: AddedLine[] = [];
  let commit = "";
  let path: string | null = null;
  // In a file's header (between `diff --git` and its first `@@`), `+++` names the file. In a hunk, every
  // `+` line is content -- including one whose own text starts with `++ `.
  let inHeader = false;
  let next = 0;
  for (const raw of log.stdout.toString("utf8").split("\n")) {
    if (raw.startsWith("commit ")) {
      commit = raw.slice("commit ".length);
      path = null;
      inHeader = false;
    } else if (raw.startsWith("diff --git ")) {
      path = null;
      inHeader = true;
    } else if (inHeader && raw.startsWith("+++ ")) {
      // git C-quotes a path holding a quote, a backslash, a tab or a control character: "b/a\tb.txt".
      const target = unquoted(raw.slice(4));
      path = target === "/dev/null" ? null : target.startsWith("b/") ? target.slice(2) : target;
    } else if (raw.startsWith("@@ ")) {
      inHeader = false;
      const match = /\+(\d+)/.exec(raw);
      next = match ? Number(match[1]) : 0;
    } else if (!inHeader && raw.startsWith("+") && path !== null && !raw.includes("\0")) {
      // A line holding a NUL is a binary file's, shown as text by --text: nothing a rule reads.
      lines.push({ commit, path, line: next++, text: raw.slice(1) });
    }
  }
  return lines;
}

/** The transports git itself knows: its own, and the remote helpers it ships. */
export const BUILT_IN_TRANSPORTS: readonly string[] = [
  "file",
  "git",
  "ssh",
  "http",
  "https",
  "ext",
  "fd",
  "ftp",
  "ftps",
];

let helperTransports: readonly string[] | undefined;

/**
 * Every other transport this machine's git could use: a `git-remote-<name>` helper, in git's own exec-path or on
 * the PATH, is a transport too. Found once, by listing folders: nothing is run but `git --exec-path`.
 */
export function helperTransportNames(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  if (helperTransports !== undefined) return helperTransports;
  const execPath = spawnChild("git", ["--exec-path"], { env: gitEnv(), encoding: "utf8" });
  const folders = [
    ...(execPath.status === 0 ? [execPath.stdout.trim()] : []),
    ...(env.PATH ?? env.Path ?? "").split(delimiter),
  ].filter((folder) => folder !== "");
  helperTransports = helperNamesIn(folders);
  return helperTransports;
}

/** The transports named by the `git-remote-<name>` helpers in these folders, git's own left out. */
export function helperNamesIn(folders: readonly string[]): string[] {
  const names = new Set<string>();
  for (const folder of folders) {
    let entries: string[];
    try {
      entries = readdirSync(folder);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const match = /^git-remote-([\w.+-]+?)(?:\.exe|\.cmd|\.bat)?$/i.exec(entry);
      if (match && !BUILT_IN_TRANSPORTS.includes(match[1]!.toLowerCase())) names.add(match[1]!);
    }
  }
  return [...names].sort();
}

/** The safe settings, with every helper transport on this machine turned off by name too. */
export function gitSafeConfig(): readonly string[] {
  return [...GIT_SAFE_CONFIG, ...helperTransportNames().map((name) => `protocol.${name}.allow=never`)];
}

/**
 * Settings a repository's own config could use to have git run a command of its choosing during a read: the
 * file-system monitor runs on `status` and `ls-files`, a signature check on `log`, a hook when the index is
 * written, a pager or an external diff. Every git call turns them off. Textconv is turned off on the `log -p`
 * call itself (`--no-ext-diff --no-textconv`).
 */
export const GIT_SAFE_CONFIG: readonly string[] = [
  // No transport at all: a partial clone would otherwise fetch missing objects from its promisor remote, a call
  // off the machine nobody named. This holds on every git; GIT_NO_LAZY_FETCH (gitEnv) is the newer gits' own.
  "protocol.allow=never",
  // protocol.allow is only the default: a repository's own protocol.<name>.allow would win over it, so each
  // transport git knows is turned off by name too, on the command line, which outranks the repository's config.
  ...BUILT_IN_TRANSPORTS.map((name) => `protocol.${name}.allow=never`),
  "core.fsmonitor=false",
  "log.showSignature=false",
  `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
  "core.pager=cat",
  "diff.external=",
  // A submodule is a repository of its own, with its own config: git status would descend into it and run its
  // filters. Code Sleuth never reads into one (status is told so too, in git()), and a diff never opens one.
  "submodule.recurse=false",
  "diff.ignoreSubmodules=all",
  "diff.submodule=short",
  "status.submoduleSummary=false",
];

/**
 * git's environment, with each setting given as `GIT_CONFIG_KEY_<n>` and `GIT_CONFIG_VALUE_<n>`. They rank with
 * `-c` above the repository's own config, and a key is never split at an `=`: `-c filter.a=b.clean=` would set
 * `filter.a`, and leave a driver named `a=b` running.
 */
export function gitEnv(config: readonly string[] = []): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" };
  for (const name of Object.keys(env))
    if (/^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)$/i.test(name)) delete env[name];
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_CEILING_DIRECTORIES"])
    delete env[name];
  config.forEach((setting, n) => {
    // A key may hold an `=` (a driver's name is the repository's to choose); a value Code Sleuth sets never does.
    const split = setting.lastIndexOf("=");
    env[`GIT_CONFIG_KEY_${n}`] = setting.slice(0, split);
    env[`GIT_CONFIG_VALUE_${n}`] = setting.slice(split + 1);
  });
  env.GIT_CONFIG_COUNT = String(config.length);
  return env;
}

function spawnGit(root: string, config: readonly string[], args: readonly string[]) {
  return spawnChild("git", [...args], {
    cwd: root,
    env: gitEnv(config),
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 1024,
  });
}

const filterOverrides = new Map<string, readonly string[]>();

/**
 * Every filter driver the config names, emptied: a driver's `clean` command runs when `status` compares a changed
 * file, so a repository could name its own. Reading the names runs nothing; the settings are read, never used.
 */
function filtersOff(root: string): readonly string[] {
  const known = filterOverrides.get(root);
  if (known !== undefined) return known;
  const listed = spawnGit(root, gitSafeConfig(), ["config", "--name-only", "--get-regexp", "^filter\\."]);
  const names = new Set<string>();
  if (listed.status === 0) {
    for (const key of listed.stdout.toString("utf8").split("\n")) {
      const match = /^filter\.(.+)\.[^.]+$/.exec(key.trim());
      if (match) names.add(match[1]!);
    }
  }
  const off = [...names].flatMap((name) => [
    `filter.${name}.clean=`,
    `filter.${name}.smudge=`,
    `filter.${name}.process=`,
    // git-lfs marks its filter required: emptied but still required, status would fail instead of reading.
    `filter.${name}.required=false`,
  ]);
  filterOverrides.set(root, off);
  return off;
}

/**
 * `git` in the root, with an argument array, none of the variables that would point it elsewhere, and none of the
 * settings that would have it run a command the repository chose.
 */
/** The first git that takes settings from GIT_CONFIG_COUNT, GIT_CONFIG_KEY_<n> and GIT_CONFIG_VALUE_<n>. */
export const GIT_ENV_CONFIG_SINCE: readonly [number, number] = [2, 31];

/** `git version 2.39.3 (Apple Git-145)` -> [2, 39, "2.39.3"]; undefined for anything else. */
export function parseGitVersion(text: string): { major: number; minor: number; shown: string } | undefined {
  const match = /^git version (\d+)\.(\d+)(\S*)/.exec(text.trim());
  return match
    ? { major: Number(match[1]), minor: Number(match[2]), shown: `${match[1]}.${match[2]}${match[3]}` }
    : undefined;
}

/** Whether this git version takes settings from the environment. */
export function takesEnvConfig(version: { major: number; minor: number }): boolean {
  const [major, minor] = GIT_ENV_CONFIG_SINCE;
  return version.major > major || (version.major === major && version.minor >= minor);
}

let gitChecked = false;

/**
 * Refuses a git older than 2.31 before it reads the repository: it would ignore every GIT_CONFIG_KEY_<n>
 * setting without a word, leaving the repository's own commands on. Asked once; a git that does not answer is no
 * git, and reads as before.
 */
function refuseOldGit(): void {
  if (gitChecked) return;
  const answer = spawnChild("git", ["--version"], { env: gitEnv(), encoding: "utf8" });
  const version = answer.status === 0 ? parseGitVersion(answer.stdout) : undefined;
  if (version !== undefined && !takesEnvConfig(version))
    throw new Refusal(gitTooOld(version.shown), gitTooOldHint);
  gitChecked = true;
}

export function git(root: string, args: readonly string[]) {
  refuseOldGit();
  // status is the one read that would descend into a submodule; told not to, it never reads one's config.
  const read = args[0] === "status" ? ["status", "--ignore-submodules=all", ...args.slice(1)] : args;
  return spawnGit(root, [...gitSafeConfig(), ...filtersOff(root)], read);
}

/**
 * True when git log failing means there is no history: no ref at all, and HEAD names nothing. A repository with
 * refs whose log failed (a missing object, a broken ref) has history that could not be read.
 */
function noHistory(root: string): boolean {
  const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"]);
  if (head.error || head.status === 0) return false;
  const refs = git(root, ["for-each-ref", "--count=1", "--format=%(refname)"]);
  return !refs.error && refs.status === 0 && refs.stdout.toString("utf8").trim() === "";
}

/** A shallow clone: git keeps a list of the commits it was cut at. */
function shallow(root: string): boolean {
  const asked = git(root, ["rev-parse", "--is-shallow-repository"]);
  return asked.status === 0 && asked.stdout.toString("utf8").trim() === "true";
}

/** A partial clone names a promisor remote, or the older extension. Reading the config runs nothing. */
function partialClone(root: string): boolean {
  const promisor = git(root, ["config", "--get-regexp", "^remote\\..*\\.promisor$"]);
  if (promisor.status === 0 && /\btrue\b/i.test(promisor.stdout.toString("utf8"))) return true;
  const extension = git(root, ["config", "--get", "extensions.partialClone"]);
  return extension.status === 0 && extension.stdout.toString("utf8").trim() !== "";
}

/**
 * The outermost work tree holding `root`: its own top level, then each superproject above it, for a submodule.
 * git prints the superproject's work tree first, when there is one, then the top level.
 */
function outermostWorkTree(root: string): string {
  let top = root;
  for (let depth = 0; depth < 32; depth++) {
    const asked = git(top, ["rev-parse", "--show-superproject-working-tree", "--show-toplevel"]);
    if (asked.status !== 0) return top;
    const [first] = asked.stdout
      .toString("utf8")
      .split("\n")
      .filter((line) => line !== "");
    if (first === undefined) return top;
    const next = resolve(first);
    if (next === top) return top;
    top = next;
  }
  return top;
}

function gitTrackedFiles(root: string): string[] | undefined {
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.error || inside.status !== 0 || inside.stdout.toString("utf8").trim() !== "true")
    return undefined;
  const listed = git(root, ["ls-files", "-z"]);
  if (listed.error || listed.status !== 0) return undefined;
  return listed.stdout
    .toString("utf8")
    .split("\0")
    .filter((path) => path !== "");
}

function walk(root: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== ".git") found.push(...walk(root, path));
    } else if (entry.isFile()) {
      found.push(path);
    }
  }
  return found;
}

/**
 * A regular file reached through real folders only. git lists a tracked path even when a folder on its way has
 * been replaced in the work tree by a link, and reading through that link would read outside the repository.
 * Each folder is asked once.
 */
function isFileHere(root: string, path: string, folders: Map<string, boolean>): boolean {
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) {
    const folder = parts.slice(0, i).join("/");
    let real = folders.get(folder);
    if (real === undefined) {
      try {
        real = lstatSync(join(root, folder)).isDirectory();
      } catch {
        real = false;
      }
      folders.set(folder, real);
    }
    if (!real) return false;
  }
  return isFile(join(root, path));
}

/** A regular file, not a link, a folder or a submodule. A tracked file deleted from the tree is not one. */
function isFile(absolute: string): boolean {
  try {
    return lstatSync(absolute).isFile();
  } catch {
    return false;
  }
}

function byBytes(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Turns a platform path into the `/` form every path in a case uses. */
export function toPosix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** A path as git C-quotes it, read back: `"b/a\\tb.txt"` is `b/a<tab>b.txt`. A path not in quotes is as written. */
export function unquoted(path: string): string {
  if (!(path.startsWith('"') && path.endsWith('"') && path.length >= 2)) return path;
  const bytes: number[] = [];
  const body = path.slice(1, -1);
  const SIMPLE: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== "\\") {
      bytes.push(...Buffer.from(ch, "utf8"));
      continue;
    }
    const next = body[i + 1] ?? "";
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(SIMPLE[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}
