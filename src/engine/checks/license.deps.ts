import type { Check, Evidence, Result } from "../check.js";
import { cleanOrUnread } from "../ecosystems.js";
import { hasAnyDependencies, npmProjects } from "../npmProjects.js";
import { cards, licenseDepsReasons, unreadableReasons, voices } from "../copy.js";
import { BUILT_IN_EXAMPLE_GLOBS, inExampleGlob } from "../examples.js";
import { isStrongCopyleft } from "../licenses.js";
import { lineContaining, manifestOf, readManifest } from "../manifest.js";

interface LockedPackage {
  license?: unknown;
  dev?: boolean;
  link?: boolean;
}

export const licenseDeps: Check = {
  id: "license.deps",
  title: "Dependency licenses",
  booksName: "license compliance",
  needs: [],
  voice: voices["license.deps"],
  card: cards["license.deps"],
  run(repo): Result {
    const lockfiles = repo.textFiles.filter((path) => path.split("/").at(-1) === "package-lock.json");
    if (lockfiles.length === 0) {
      // Only a package.json with dependencies has licenses to read; one with none needs no lockfile (#99).
      const npmWithoutLock = npmProjects(repo, hasAnyDependencies).length > 0;
      if (npmWithoutLock) return { verdict: "not-investigated", reason: licenseDepsReasons.noLockfile };
      return cleanOrUnread(repo, false);
    }

    const evidence: Evidence[] = [];
    // Each lockfile is read on its own: one that cannot be read leaves the others' findings standing, and is
    // named when nothing is found. One in an example location (a test's deliberate bait) is left out.
    let unread: string | undefined;
    for (const lockfile of lockfiles) {
      const text = repo.readText(lockfile) ?? "";
      const example = BUILT_IN_EXAMPLE_GLOBS.some((glob) => inExampleGlob(lockfile, glob));
      let lock: { lockfileVersion?: number; packages?: unknown };
      try {
        lock = JSON.parse(text) as typeof lock;
      } catch {
        if (!example) unread ??= licenseDepsReasons.unreadable(lockfile);
        continue;
      }
      if (typeof lock !== "object" || lock === null) {
        if (!example) unread ??= licenseDepsReasons.unreadable(lockfile);
        continue;
      }
      if (typeof lock.packages !== "object" || lock.packages === null) {
        if (!example) unread ??= licenseDepsReasons.oldLockfile(lockfile);
        continue;
      }
      const packages = lock.packages as Record<string, LockedPackage | null>;

      const folder = lockfile.includes("/") ? lockfile.slice(0, lockfile.lastIndexOf("/") + 1) : "";
      const ownRead = readManifest(repo, `${folder}package.json`);
      // Whether the project is itself copyleft decides what a copyleft dependency means: unread, it cannot be said.
      if (ownRead.state === "unreadable") {
        unread ??= unreadableReasons.manifest(ownRead.path);
        continue;
      }
      const own = manifestOf(ownRead)?.license;
      // A project that is itself under a strong copyleft license may take copyleft dependencies.
      if (typeof own === "string" && isStrongCopyleft(own)) continue;

      for (const [key, entry] of Object.entries(packages)) {
        // The root, links to local folders, and what only development installs are not shipped with it.
        if (key === "" || entry === null || typeof entry !== "object" || entry.link || entry.dev) continue;
        const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
        const license = typeof entry.license === "string" ? entry.license : undefined;
        const line = lineContaining(text, `"${key}"`);
        const where = { path: lockfile, ...(line ? { line } : {}) };
        if (license === undefined) evidence.push({ ...where, excerpt: name, rule: "no-license-stated" });
        else if (isStrongCopyleft(license))
          evidence.push({ ...where, excerpt: `${name}: ${license}`, rule: "strong-copyleft" });
      }
    }
    if (evidence.length > 0) return { verdict: "found", evidence };
    return unread === undefined ? cleanOrUnread(repo, true) : { verdict: "not-investigated", reason: unread };
  },
};
