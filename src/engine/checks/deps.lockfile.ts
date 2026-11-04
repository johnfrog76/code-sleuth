import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { readPackageJson } from "../manifest.js";

export const LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
];

const hasEntries = (value: unknown) =>
  typeof value === "object" && value !== null && Object.keys(value).length > 0;

export const depsLockfile: Check = {
  id: "deps.lockfile",
  title: "A lockfile",
  booksName: "dependency pinning",
  needs: [],
  voice: voices["deps.lockfile"],
  card: cards["deps.lockfile"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    for (const path of repo.textFiles.filter((p) => p.split("/").at(-1) === "package.json")) {
      const manifest = readPackageJson(repo, path);
      if (!hasEntries(manifest?.dependencies) && !hasEntries(manifest?.devDependencies)) continue;
      // A workspace member's lockfile is its workspace root's, in a folder above it.
      const folders = path.split("/").slice(0, -1);
      const locked = folders
        .map((_, i) => folders.slice(0, folders.length - i).join("/"))
        .concat("")
        .some((folder) => LOCKFILES.some((lock) => repo.has(folder === "" ? lock : `${folder}/${lock}`)));
      if (!locked) evidence.push({ path, rule: "no-lockfile" });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
