import type { Check, Evidence } from "../check.js";
import { cards, licenseDepsReasons, voices } from "../copy.js";
import { isStrongCopyleft } from "../licenses.js";
import { lineContaining, readPackageJson } from "../manifest.js";

/** Manifests of ecosystems whose dependency licenses are not read yet. */
const OTHER_MANIFESTS = [
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "composer.json",
];

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
  run(repo) {
    const lockfiles = repo.textFiles.filter((path) => path.split("/").at(-1) === "package-lock.json");
    if (lockfiles.length === 0) {
      const others = repo.textFiles.filter((path) => OTHER_MANIFESTS.includes(path.split("/").at(-1)!));
      const npmWithoutLock = repo.textFiles.some((path) => path.split("/").at(-1) === "package.json");
      if (npmWithoutLock) return { verdict: "not-investigated", reason: licenseDepsReasons.noLockfile };
      if (others.length > 0)
        return { verdict: "not-investigated", reason: licenseDepsReasons.otherEcosystem(others[0]!) };
      return { verdict: "clean" };
    }

    const evidence: Evidence[] = [];
    for (const lockfile of lockfiles) {
      const text = repo.readText(lockfile) ?? "";
      let lock: { lockfileVersion?: number; packages?: Record<string, LockedPackage> };
      try {
        lock = JSON.parse(text) as typeof lock;
      } catch {
        return { verdict: "not-investigated", reason: licenseDepsReasons.unreadable(lockfile) };
      }
      if (lock.packages === undefined)
        return { verdict: "not-investigated", reason: licenseDepsReasons.oldLockfile(lockfile) };

      const folder = lockfile.includes("/") ? lockfile.slice(0, lockfile.lastIndexOf("/") + 1) : "";
      const own = readPackageJson(repo, `${folder}package.json`)?.license;
      // A project that is itself under a strong copyleft license may take copyleft dependencies.
      if (typeof own === "string" && isStrongCopyleft(own)) continue;

      for (const [key, entry] of Object.entries(lock.packages)) {
        // The root, links to local folders, and what only development installs are not shipped with it.
        if (key === "" || entry.link || entry.dev) continue;
        const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
        const license = typeof entry.license === "string" ? entry.license : undefined;
        const line = lineContaining(text, `"${key}"`);
        const where = { path: lockfile, ...(line ? { line } : {}) };
        if (license === undefined) evidence.push({ ...where, excerpt: name, rule: "no-license-stated" });
        else if (isStrongCopyleft(license))
          evidence.push({ ...where, excerpt: `${name}: ${license}`, rule: "strong-copyleft" });
      }
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
