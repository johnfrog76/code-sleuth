import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { type Capabilities, detectCapabilities } from "../../src/engine/engine.js";
import { openRepo, type RepoReader } from "../../src/engine/repo.js";

const FIXTURES = fileURLToPath(new URL("../fixtures/repos/", import.meta.url));

/** A tree written at test time: for secrets, which are assembled from fragments and never committed here. */
export interface BuiltFixture {
  name: string;
  files: Record<string, string>;
}

type Changes = Readonly<Record<string, string | null>>;

export interface InvestigateOptions {
  /** Make the copy a git repository, with everything committed. */
  git?: boolean;
  /**
   * More commits after the first, each a set of writes (a string) and deletes (null), with its own message
   * when one is given. Needs `git`.
   */
  commits?: readonly (Changes | { readonly message: string; readonly files: Changes })[];
  /** Change the copy after the commit and before the run: an untracked file, a deleted one. */
  prepare?: (root: string) => void;
}

/**
 * Every engine test runs through this. It copies the fixture to a scratch folder (outside any
 * repository), optionally commits it, runs `body` over it, and then holds the read-only guarantee:
 * the tree is byte-identical to before the run, and `git status` in it is clean.
 */
export function investigate<T>(
  fixture: string | BuiltFixture,
  body: (repo: RepoReader, capabilities: Capabilities) => T,
  options: InvestigateOptions = {},
): T {
  const { scratch, root, hold } = prepareFixture(fixture, options);
  try {
    const repo = openRepo(root);
    const result = body(repo, detectCapabilities(repo));
    hold();
    return result;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The same guarantee for a body that awaits, such as the CLI, which is handed the copy's folder. */
export async function investigateAsync<T>(
  fixture: string | BuiltFixture,
  body: (root: string) => Promise<T>,
  options: InvestigateOptions = {},
): Promise<T> {
  const { scratch, root, hold } = prepareFixture(fixture, options);
  try {
    const result = await body(root);
    hold();
    return result;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Copies (or writes) the fixture, commits it as asked, and returns a check that it is still as it was. */
function prepareFixture(fixture: string | BuiltFixture, options: InvestigateOptions) {
  const scratch = mkdtempSync(join(tmpdir(), "code-sleuth-fixture-"));
  // The copy keeps the fixture's own folder name, so a case's repository name does not depend on the run.
  const root = join(scratch, typeof fixture === "string" ? basename(fixture) : fixture.name);
  try {
    if (typeof fixture === "string") cpSync(join(FIXTURES, fixture), root, { recursive: true });
    else writeTree(root, fixture.files);
    if (options.git) {
      commitAll(root, "The fixture");
      options.commits?.forEach((commit, i) => {
        const described = "message" in commit && typeof commit.message === "string" && "files" in commit;
        writeTree(root, described ? (commit.files as Changes) : (commit as Changes));
        commitAll(root, described ? (commit.message as string) : `Change ${i + 1}`);
      });
    }
    options.prepare?.(root);
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    throw error;
  }
  const before = snapshot(root);
  const statusBefore = options.git ? gitStatus(root) : "";
  const hold = () => {
    expect(snapshot(root), "the investigation changed the tree").toEqual(before);
    if (options.git) expect(gitStatus(root), "the investigation changed git status").toBe(statusBefore);
  };
  return { scratch, root, hold };
}

function writeTree(root: string, files: Changes): void {
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    if (text === null) {
      rmSync(join(root, path));
    } else {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  }
}

function commitAll(root: string, message: string): void {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
  };
  // Fixed settings, so the commit -- and the head a golden case holds -- is the same on every host.
  const quiet = [
    "-c",
    "init.defaultBranch=main",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=",
    "-c",
    "core.autocrlf=false",
  ];
  const steps = existsSync(join(root, ".git")) ? [] : [["init", "-q"]];
  for (const args of [...steps, ["add", "-A"], ["commit", "-q", "-m", message]]) {
    const result = spawnSync("git", [...quiet, ...args], { cwd: root, env, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

function gitStatus(root: string): string {
  const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd: root,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    encoding: "utf8",
  });
  return result.stdout;
}

/** Every path under the root, outside `.git`, with a hash of its bytes. Folders count, empty or not. */
function snapshot(root: string, prefix = ""): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (path === ".git") continue;
      entries[`${path}/`] = "folder";
      Object.assign(entries, snapshot(root, path));
    } else {
      entries[path] = createHash("sha256")
        .update(readFileSync(join(root, path)))
        .digest("hex");
    }
  }
  return entries;
}
