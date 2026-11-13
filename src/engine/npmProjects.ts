import { matchesGlob } from "node:path";
import { BUILT_IN_EXAMPLE_GLOBS, inExampleGlob } from "./examples.js";
import { manifestOf, readManifest } from "./manifest.js";
import type { RepoReader } from "./repo.js";

/** The lockfiles npm writes, which hold every installed package's name and version. */
export const NPM_LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json"];
/** Lockfiles of other package managers, which the npm lookups do not read. */
export const OTHER_LOCKFILES = ["yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];

/** A file in a folder of the repository: `package.json` at the root, `web/package.json` below it. */
export const at = (folder: string, file: string) => (folder === "" ? file : `${folder}/${file}`);

/** One npm project the deps lookups read: a folder, and whether it can be looked up. */
export interface NpmProject {
  /** Relative to the repository root, with `/`; "" for the root. */
  folder: string;
  /** `ready`: dependencies beside an npm lockfile, here or at a workspace root above. */
  state: "ready" | "unreadable" | "no-lockfile" | "other-lockfile";
  /** The npm lockfile, when ready. */
  lockfile?: string;
}

/**
 * Every npm project in the tracked files, root first, then by path: each folder whose package.json has
 * dependencies, outside the example folders and the folders the text checks skip. A workspace member is read
 * through its workspace root, the nearest folder above it with a lockfile: one lookup there covers it, as npm's
 * own does. An unreadable package.json is a project that could not be read.
 */
export function npmProjects(
  repo: Pick<RepoReader, "textFiles" | "readText" | "has" | "isBinary">,
  hasDependencies: (manifest: Record<string, unknown>) => boolean,
): NpmProject[] {
  const manifests = repo.textFiles
    .filter((path) => path.split("/").at(-1) === "package.json")
    .filter((path) => !BUILT_IN_EXAMPLE_GLOBS.some((glob) => inExampleGlob(path, glob)))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const projects = new Map<string, NpmProject>();
  for (const path of manifests) {
    const folder = path.split("/").slice(0, -1).join("/");
    const read = readManifest(repo as RepoReader, path);
    if (read.state === "unreadable") {
      projects.set(folder, { folder, state: "unreadable" });
      continue;
    }
    const manifest = manifestOf(read);
    if (manifest === undefined || !hasDependencies(manifest)) continue;
    // Its own lockfile first; else the nearest folder above with one reads it, but only when that folder's
    // package.json names it as a workspace. A folder no workspace names, with no lockfile, has none.
    const parts = folder === "" ? [] : folder.split("/");
    const candidates = parts.map((_, i) => parts.slice(0, parts.length - i).join("/")).concat("");
    let project: NpmProject = { folder, state: "no-lockfile" };
    for (const candidate of candidates) {
      const npm = NPM_LOCKFILES.find((lock) => repo.has(at(candidate, lock)));
      const other = OTHER_LOCKFILES.some((lock) => repo.has(at(candidate, lock)));
      if (npm === undefined && !other) continue;
      if (candidate !== folder && !namesWorkspace(repo, candidate, folder)) break;
      project =
        npm !== undefined
          ? { folder: candidate, state: "ready", lockfile: at(candidate, npm) }
          : { folder: candidate, state: "other-lockfile" };
      break;
    }
    if (!projects.has(project.folder)) projects.set(project.folder, project);
  }
  return [...projects.values()].sort((a, b) =>
    a.folder === "" ? -1 : b.folder === "" ? 1 : a.folder.localeCompare(b.folder),
  );
}

/** True when the package.json in `root` names `member` among its workspaces (`workspaces` or `workspaces.packages`). */
function namesWorkspace(repo: Pick<RepoReader, "readText">, root: string, member: string): boolean {
  const manifest = manifestOf(readManifest(repo as RepoReader, at(root, "package.json")));
  const field = manifest?.workspaces;
  const globs = Array.isArray(field)
    ? field
    : typeof field === "object" && field !== null && Array.isArray((field as { packages?: unknown }).packages)
      ? (field as { packages: unknown[] }).packages
      : [];
  const relative = root === "" ? member : member.slice(root.length + 1);
  return globs.some((glob) => typeof glob === "string" && matchesGlob(relative, glob.replace(/\/$/, "")));
}

/** A manifest's dependencies, devDependencies or optionalDependencies, when any holds one. */
export function hasAnyDependencies(manifest: Record<string, unknown>): boolean {
  return ["dependencies", "devDependencies", "optionalDependencies"].some((field) => {
    const value = manifest[field];
    return typeof value === "object" && value !== null && Object.keys(value).length > 0;
  });
}
