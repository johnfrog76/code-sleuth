import type { RepoReader } from "./repo.js";
import { maskSecrets } from "./secrets/scan.js";

/**
 * The first file, in folder order, directly in one of `folders` whose name starts with `prefix`, ignoring
 * case: `CHANGELOG.md`, `changelog`, `Changelog.txt`. `""` is the root.
 */
export function findDoc(repo: RepoReader, prefix: string, folders: readonly string[]): string | undefined {
  const wanted = prefix.toLowerCase();
  for (const folder of folders) {
    const base = folder === "" ? "" : `${folder}/`;
    const match = repo.files.find((path) => {
      if (!path.startsWith(base)) return false;
      const name = path.slice(base.length);
      return !name.includes("/") && name.toLowerCase().startsWith(wanted);
    });
    if (match !== undefined) return match;
  }
  return undefined;
}

/** Where GitHub looks for a community file. */
export const COMMUNITY_FOLDERS: readonly string[] = ["", ".github", "docs"];

/** The longest excerpt a finding keeps. */
export const EXCERPT_LIMIT = 160;

/**
 * A line, trimmed, masked, then cut to the excerpt limit. Masked first: a secret the cut would split no longer
 * matches its rule, and would go out with most of it in clear.
 */
export function excerptOf(text: string, path: string): string {
  const masked = maskSecrets(text.trim(), path);
  return masked.length <= EXCERPT_LIMIT ? masked : `${masked.slice(0, EXCERPT_LIMIT)}...`;
}

/** A text file's lines, or none for a binary file. */
export function readableLines(repo: RepoReader, path: string): string[] {
  return repo.isBinary(path) ? [] : (repo.readText(path) ?? "").split(/\r?\n/);
}
