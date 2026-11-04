import { spawnChild } from "../spawn.js";
import { closeSync, lstatSync, openSync, readdirSync, readFileSync, readSync } from "node:fs";
import { join, resolve, sep } from "node:path";

/** Folders the text checks never read, at any depth. */
export const SKIPPED_FOLDERS: readonly string[] = ["node_modules", "vendor", "dist", "build"];

export interface RepoReader {
  /** The absolute path of the root the investigation was pointed at. */
  readonly root: string;
  /** True when the root is inside a git work tree, and `files` came from `git ls-files`. */
  readonly isGitRepository: boolean;
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
  const files = (tracked ?? walk(absolute)).filter((path) => isFile(join(absolute, path))).sort(byBytes);
  const known = new Set(files);
  const cache = new Map<string, string>();
  let history: readonly AddedLine[] | undefined | null = null;
  let messages: readonly { commit: string; text: string }[] | undefined | null = null;

  return {
    root: absolute,
    isGitRepository: tracked !== undefined,
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
  if (log.status !== 0) {
    const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"]);
    return head.status !== 0 && !head.error ? [] : undefined;
  }
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
    "log",
    "-p",
    "--all",
    "--reverse",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "-U0",
    "--format=commit %H",
  ]);
  if (log.error) return undefined;
  if (log.status !== 0) {
    // A repository with no commits has no history to read, and nothing in it.
    const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"]);
    return head.status !== 0 && !head.error ? [] : undefined;
  }
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
      const target = raw.slice(4);
      path = target === "/dev/null" ? null : target.startsWith("b/") ? target.slice(2) : target;
    } else if (raw.startsWith("@@ ")) {
      inHeader = false;
      const match = /\+(\d+)/.exec(raw);
      next = match ? Number(match[1]) : 0;
    } else if (!inHeader && raw.startsWith("+") && path !== null) {
      lines.push({ commit, path, line: next++, text: raw.slice(1) });
    }
  }
  return lines;
}

/**
 * Settings a repository's own config could use to have git run a command of its choosing during a read: the
 * file-system monitor runs on `status` and `ls-files`, a signature check on `log`, a hook when the index is
 * written, a pager or an external diff. Every git call turns them off. Textconv is turned off on the `log -p`
 * call itself (`--no-ext-diff --no-textconv`).
 */
export const GIT_SAFE_CONFIG: readonly string[] = [
  "core.fsmonitor=false",
  "log.showSignature=false",
  `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
  "core.pager=cat",
  "diff.external=",
];

function gitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_CEILING_DIRECTORIES"])
    delete env[name];
  return env;
}

function spawnGit(root: string, config: readonly string[], args: readonly string[]) {
  const flags = config.flatMap((setting) => ["-c", setting]);
  return spawnChild("git", [...flags, ...args], {
    cwd: root,
    env: gitEnv(),
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
  const listed = spawnGit(root, GIT_SAFE_CONFIG, ["config", "--name-only", "--get-regexp", "^filter\\."]);
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
export function git(root: string, args: readonly string[]) {
  return spawnGit(root, [...GIT_SAFE_CONFIG, ...filtersOff(root)], args);
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
