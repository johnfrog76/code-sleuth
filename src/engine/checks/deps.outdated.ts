import type { Check, Evidence, Result } from "../check.js";
import { cleanOrUnread } from "../ecosystems.js";
import { cards, outdatedReasons, unreadableReasons, voices } from "../copy.js";
import { lineContaining, manifestOf, readManifest } from "../manifest.js";

/** The lockfiles npm writes, which hold each direct dependency's installed version. */
const NPM_LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json"];
const OTHER_LOCKFILES = ["yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];

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

/** Whether there is anything for npm to look up: a package.json with dependencies, beside an npm lockfile. */
function lookup(
  repo: Parameters<Check["run"]>[0],
): "nothing" | "unreadable" | "no-lockfile" | "other-lockfile" | "ready" {
  const read = readManifest(repo);
  if (read.state === "unreadable") return "unreadable";
  const manifest = manifestOf(read);
  if (manifest === undefined || directDependencies(manifest).length === 0) return "nothing";
  if (NPM_LOCKFILES.some((file) => repo.has(file))) return "ready";
  return OTHER_LOCKFILES.some((file) => repo.has(file)) ? "other-lockfile" : "no-lockfile";
}

export const depsOutdated: Check = {
  id: "deps.outdated",
  title: "Dependencies a major version behind",
  booksName: "outdated dependency",
  // npm first, so a run without npm says so, whether or not it is offline.
  needs: ["npm", "network"],
  voice: voices["deps.outdated"],
  card: cards["deps.outdated"],
  outgoing: (repo) => (lookup(repo) === "ready" ? outdatedReasons.outgoing : undefined),
  run(repo, context): Result {
    const state = lookup(repo);
    // No package.json, or no dependencies in it: nothing can be behind, and no call is made.
    if (state === "nothing") return cleanOrUnread(repo, false);
    if (state === "unreadable")
      return { verdict: "not-investigated", reason: unreadableReasons.manifest("package.json") };
    if (state === "no-lockfile") return { verdict: "not-investigated", reason: outdatedReasons.noLockfile };
    if (state === "other-lockfile")
      return { verdict: "not-investigated", reason: outdatedReasons.otherLockfile };
    if (context.npm === undefined) return { verdict: "not-investigated", reason: outdatedReasons.noNpm };

    // Package names go to npm's configured registry; nothing from the repository's files is sent.
    const answer = context.npm.run(["outdated", "--json", "--long"], repo.root);
    // npm outdated exits 1 when something is outdated, and 0 when nothing is.
    if (answer.error !== undefined || (answer.status !== 0 && answer.status !== 1)) {
      return { verdict: "not-investigated", reason: outdatedReasons.failed };
    }
    let outdated: Record<string, Outdated>;
    try {
      outdated = answer.stdout.trim() === "" ? {} : (JSON.parse(answer.stdout) as Record<string, Outdated>);
    } catch {
      return { verdict: "not-investigated", reason: outdatedReasons.failed };
    }
    if ("error" in outdated) return { verdict: "not-investigated", reason: outdatedReasons.failed };

    const lockfile = NPM_LOCKFILES.find((file) => repo.has(file))!;
    let locked: Record<string, { version?: string }> = {};
    try {
      locked = (JSON.parse(repo.readText(lockfile) ?? "{}") as { packages?: typeof locked }).packages ?? {};
    } catch {
      return { verdict: "not-investigated", reason: outdatedReasons.unreadableLockfile(lockfile) };
    }

    const manifestText = repo.readText("package.json") ?? "";
    const evidence: Evidence[] = [];
    for (const { name, dev } of directDependencies(manifestOf(readManifest(repo))!)) {
      const current = locked[`node_modules/${name}`]?.version;
      const latest = outdated[name]?.latest;
      if (current === undefined || latest === undefined || !majorBehind(current, latest)) continue;
      const line = lineContaining(manifestText, `"${name}"`);
      evidence.push({
        path: "package.json",
        ...(line === undefined ? {} : { line }),
        excerpt: `${name} ${current}, latest ${latest}${dev ? " (dev)" : ""}`,
        rule: "major-behind",
      });
    }
    return evidence.length === 0 ? cleanOrUnread(repo, true) : { verdict: "found", evidence };
  },
};
