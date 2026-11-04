import { basename } from "node:path";
import type { RepoReader } from "../engine/repo.js";
import { git } from "../engine/repo.js";

export interface RepoInfo {
  name: string;
  head: string | null;
  branch: string | null;
  dirty: boolean | null;
  /** The `origin` remote, without a scheme or credentials: `github.com/<owner>/<repo>`. */
  remote: string | null;
  /** Present, and true, for a partial clone, whose history is not all here. */
  partialClone?: true;
}

/** What the case says about the repository. Outside git, everything but the name is null. */
export function readRepoInfo(repo: RepoReader): RepoInfo {
  const info: RepoInfo = { name: basename(repo.root), head: null, branch: null, dirty: null, remote: null };
  if (!repo.isGitRepository) return info;
  const out = (args: string[]) => {
    const result = git(repo.root, args);
    return result.status === 0 ? result.stdout.toString("utf8").trim() : null;
  };
  info.head = out(["rev-parse", "--verify", "-q", "HEAD"]);
  const branch = out(["symbolic-ref", "-q", "--short", "HEAD"]);
  info.branch = branch === "" ? null : branch;
  const status = out(["status", "--porcelain"]);
  info.dirty = status === null ? null : status !== "";
  const url = out(["remote", "get-url", "origin"]);
  info.remote = url ? cleanRemote(url) : null;
  if (repo.isPartialClone) info.partialClone = true;
  return info;
}

/** The repository's `origin`, cleaned, or null outside git or with no origin. */
export function readRemote(repo: RepoReader): string | null {
  if (!repo.isGitRepository) return null;
  const result = git(repo.root, ["remote", "get-url", "origin"]);
  const url = result.status === 0 ? result.stdout.toString("utf8").trim() : "";
  return url === "" ? null : cleanRemote(url);
}

/** `https://user:token@github.com/o/r.git` and `git@github.com:o/r.git` both become `github.com/o/r`. */
export function cleanRemote(url: string): string {
  let rest = url.trim();
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(rest);
  if (scheme) {
    rest = rest.slice(scheme[0].length);
    rest = rest.replace(/^[^@/]*@/, "");
  } else {
    const scp = /^(?:[^@/]+@)?([^:/]+):(.*)$/.exec(rest);
    if (scp) rest = `${scp[1]}/${scp[2]}`;
  }
  return rest.replace(/\.git\/?$/, "").replace(/\/+$/, "");
}
