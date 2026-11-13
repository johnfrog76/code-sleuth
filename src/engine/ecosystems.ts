import type { Result } from "./check.js";
import { ecosystemReasons } from "./copy.js";
import type { RepoReader } from "./repo.js";

/** A manifest Code Sleuth knows the ecosystem of, and does not read yet. */
export interface OtherManifest {
  /** Relative to the repository root, always with `/`. */
  path: string;
  ecosystem: string;
}

/** The manifests of ecosystems whose dependencies the deps checks do not read yet, by file name. */
export const OTHER_MANIFESTS: Readonly<Record<string, string>> = {
  "requirements.txt": "Python",
  "pyproject.toml": "Python",
  Pipfile: "Python",
  "go.mod": "Go",
  "Cargo.toml": "Rust",
  Gemfile: "Ruby",
  "pom.xml": "Java",
  "build.gradle": "Java",
  "build.gradle.kts": "Java",
  "composer.json": "PHP",
};

/** Every manifest of another ecosystem in the tracked files, at any depth, in path order. */
export function otherManifests(repo: Pick<RepoReader, "textFiles">): OtherManifest[] {
  return repo.textFiles
    .filter((path) => Object.hasOwn(OTHER_MANIFESTS, path.split("/").at(-1)!))
    .map((path) => ({ path, ecosystem: OTHER_MANIFESTS[path.split("/").at(-1)!]! }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * A deps check's clean, held to what it read. With no manifest of any other ecosystem, clean stands: nothing is
 * left unread. With one, clean would claim a side that was never read, so the check reads not investigated and
 * names what it found. `npmRead` says whether an npm side was checked and found clean first.
 */
export function cleanOrUnread(
  repo: Pick<RepoReader, "textFiles" | "readText" | "has">,
  npmRead: boolean,
): Result {
  const [first] = otherManifests(repo);
  if (first === undefined) return { verdict: "clean" };
  const reason = npmRead
    ? ecosystemReasons.npmCleanOtherUnread(first.path, first.ecosystem)
    : ecosystemReasons.otherOnly(first.path, first.ecosystem);
  return { verdict: "not-investigated", reason };
}
