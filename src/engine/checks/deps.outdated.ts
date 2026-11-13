import { join } from "node:path";
import type { Check, CheckContext, Evidence, Result } from "../check.js";
import { cleanOrUnread } from "../ecosystems.js";
import { callIn, cards, inFolder, outdatedReasons, unreadableReasons, voices } from "../copy.js";
import { lineContaining, manifestOf, readManifest, lockedOf } from "../manifest.js";
import { at, type NpmProject, npmProjects } from "../npmProjects.js";
import type { RepoReader } from "../repo.js";

interface Outdated {
  latest?: string;
  type?: string;
}

/** A version's breaking part: the major, or for 0.x the minor too, as npm's caret ranges read it. */
export function breakingPart(version: string): string | undefined {
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version);
  if (match === null) return undefined;
  return match[1] === "0" ? `0.${match[2]}` : match[1];
}

/** True when `latest` is at least one breaking version past `current`. */
export function majorBehind(current: string, latest: string): boolean {
  const [a, b] = [breakingPart(current), breakingPart(latest)];
  if (a === undefined || b === undefined) return false;
  const [cm, cn] = a.split(".").map(Number) as [number, number | undefined];
  const [lm, ln] = b.split(".").map(Number) as [number, number | undefined];
  return lm > cm || (lm === cm && cm === 0 && (ln ?? 0) > (cn ?? 0));
}

function directDependencies(manifest: Record<string, unknown>): { name: string; dev: boolean }[] {
  const names = (field: string) => {
    const value = manifest[field];
    return typeof value === "object" && value !== null ? Object.keys(value) : [];
  };
  return [
    ...names("dependencies").map((name) => ({ name, dev: false })),
    ...names("devDependencies").map((name) => ({ name, dev: true })),
  ];
}

/** Where a dependency comes from, by the spec package.json gives it. Only `registry` is looked up. */
export type DependencySource = "registry" | "git" | "path" | "url" | "alias" | "other";

/** A name npm's registry could hold: lower case, an optional @scope/, no path or URL characters. */
const REGISTRY_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

/**
 * Reads a dependency's spec as npm would, to keep every source but npm's registry from the lookup: a git
 * repository (`git+ssh:`, `github:`, `user/repo`), a path (`file:`, `link:`, `workspace:`, `./x`, a tarball), a
 * URL, or an `npm:` alias. Only a version, a range or a dist-tag, with a name the registry could hold, is
 * `registry`. An alias is left out too: its locked version is the target's, under another name.
 */
export function dependencySource(name: string, spec: unknown): DependencySource {
  if (!REGISTRY_NAME.test(name)) return "other";
  if (typeof spec !== "string") return "other";
  const value = spec.trim();
  if (/^npm:/i.test(value)) return "alias";
  if (/^(?:git\+|git:|github:|gitlab:|bitbucket:|gist:)/i.test(value)) return "git";
  if (/^(?:https?|ftp):/i.test(value)) return "url";
  if (/^(?:file|link|workspace|portal|patch):/i.test(value)) return "path";
  if (/^(?:\.|~[/\\]|[/\\]|[A-Za-z]:[\\/])/.test(value) || /\.(?:tgz|tar\.gz|tar)$/i.test(value))
    return "path";
  if (/^[\w.-]+\/[\w.#-]+/.test(value)) return "git";
  // What is left: a version, a range (`^1.2`, `>=1 <2`, `1.x || 2`), a dist-tag (`latest`, `next`), or `*`.
  if (/^[\w.*^~<>=|+\s-]*$/.test(value) && !value.includes(":")) return "registry";
  return "other";
}

/**
 * A package.json naming each direct dependency from npm's registry, as a plain dependency at `*`: no spec from
 * the repository reaches npm, and npm outdated asks the registry for each name's latest version alone. Every
 * other source is left out, and named.
 */
export function namesOnly(manifest: Record<string, unknown>): {
  manifest: string;
  names: number;
  leftOut: { name: string; source: Exclude<DependencySource, "registry"> }[];
} {
  const names: Record<string, string> = {};
  const leftOut: { name: string; source: Exclude<DependencySource, "registry"> }[] = [];
  for (const field of ["dependencies", "devDependencies"]) {
    const value = manifest[field];
    if (typeof value !== "object" || value === null) continue;
    for (const [name, spec] of Object.entries(value)) {
      const source = dependencySource(name, spec);
      if (source === "registry") names[name] = "*";
      else if (!leftOut.some((out) => out.name === name)) leftOut.push({ name, source });
    }
  }
  return {
    manifest: JSON.stringify({
      name: "code-sleuth-lookup",
      version: "0.0.0",
      private: true,
      dependencies: names,
    }),
    names: Object.keys(names).length,
    leftOut,
  };
}

/** One project's lookup: npm outdated in its folder, and which direct dependencies are a major version behind. */
function lookUp(repo: RepoReader, project: NpmProject, context: CheckContext): Result {
  const manifestPath = at(project.folder, "package.json");
  if (project.state === "unreadable")
    return { verdict: "not-investigated", reason: unreadableReasons.manifest(manifestPath) };
  if (project.state === "no-lockfile")
    return { verdict: "not-investigated", reason: outdatedReasons.noLockfile };
  if (project.state === "other-lockfile")
    return { verdict: "not-investigated", reason: outdatedReasons.otherLockfile };
  if (context.npm === undefined) return { verdict: "not-investigated", reason: outdatedReasons.noNpm };

  // Package names go to npm's configured registry; nothing from the repository's files is sent. npm is given
  // each direct dependency from its registry as a dependency at `*`, alone: with nothing installed, npm
  // outdated leaves out each missing devDependency, and the installed versions come from the lockfile below.
  const {
    manifest: lookupManifest,
    names,
    leftOut,
  } = namesOnly(manifestOf(readManifest(repo, manifestPath))!);
  if (names === 0) return { verdict: "not-investigated", reason: outdatedReasons.allLeftOut(leftOut) };
  const answer = context.npm.run(
    ["outdated", "--json", "--long"],
    join(repo.root, project.folder),
    lookupManifest,
  );
  // npm outdated exits 1 when something is outdated, and 0 when nothing is.
  if (answer.error !== undefined || (answer.status !== 0 && answer.status !== 1)) {
    return { verdict: "not-investigated", reason: outdatedReasons.failed };
  }
  let outdated: Record<string, Outdated>;
  try {
    // Nothing printed is "nothing behind" only with exit 0: npm exits 1 for a failure too.
    if (answer.stdout.trim() === "" && answer.status !== 0)
      return { verdict: "not-investigated", reason: outdatedReasons.failed };
    outdated = answer.stdout.trim() === "" ? {} : (JSON.parse(answer.stdout) as Record<string, Outdated>);
  } catch {
    return { verdict: "not-investigated", reason: outdatedReasons.failed };
  }
  if ("error" in outdated) return { verdict: "not-investigated", reason: outdatedReasons.failed };

  const lockfile = project.lockfile!;
  let locked: Record<string, { version?: string }>;
  try {
    locked = lockedOf(JSON.parse(repo.readText(lockfile) ?? "{}"));
  } catch {
    return { verdict: "not-investigated", reason: outdatedReasons.unreadableLockfile(lockfile) };
  }

  const manifestText = repo.readText(manifestPath) ?? "";
  const evidence: Evidence[] = [];
  for (const { name, dev } of directDependencies(manifestOf(readManifest(repo, manifestPath))!)) {
    const current = locked[`node_modules/${name}`]?.version;
    const latest = outdated[name]?.latest;
    if (current === undefined || latest === undefined || !majorBehind(current, latest)) continue;
    const line = lineContaining(manifestText, `"${name}"`);
    evidence.push({
      path: manifestPath,
      ...(line === undefined ? {} : { line }),
      excerpt: `${name} ${current}, latest ${latest}${dev ? " (dev)" : ""}`,
      rule: "major-behind",
    });
  }
  if (evidence.length > 0) return { verdict: "found", evidence };
  // Clean on what was asked; with a dependency from another source unread, it is not a clean bill.
  return leftOut.length === 0
    ? { verdict: "clean" }
    : { verdict: "not-investigated", reason: outdatedReasons.leftOut(leftOut) };
}

const hasDirect = (manifest: Record<string, unknown>) => directDependencies(manifest).length > 0;

export const depsOutdated: Check = {
  id: "deps.outdated",
  title: "Dependencies a major version behind",
  booksName: "outdated dependency",
  // npm first, so a run without npm says so, whether or not it is offline.
  needs: ["npm", "network"],
  voice: voices["deps.outdated"],
  card: cards["deps.outdated"],
  // One lookup per npm project, each named by its folder.
  outgoing: (repo) =>
    npmProjects(repo, hasDirect)
      .filter((project) => project.state === "ready")
      .map((project) => callIn(project.folder, outdatedReasons.outgoing)),
  run(repo, context): Result {
    const projects = npmProjects(repo, hasDirect);
    // No package.json with dependencies anywhere: nothing can be behind, and no call is made.
    if (projects.length === 0) return cleanOrUnread(repo, false);
    const results = projects.map((project) => ({ project, result: lookUp(repo, project, context) }));
    const evidence = results.flatMap(({ result }) => (result.verdict === "found" ? result.evidence : []));
    if (evidence.length > 0) return { verdict: "found", evidence };
    // Clean would claim a project nobody could look up.
    const unread = results.find(({ result }) => result.verdict === "not-investigated");
    if (unread !== undefined && unread.result.verdict === "not-investigated")
      return { verdict: "not-investigated", reason: inFolder(unread.project.folder, unread.result.reason) };
    return cleanOrUnread(repo, true);
  },
};
