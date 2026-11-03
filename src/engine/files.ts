import type { RepoReader } from "./repo.js";

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

/** A line, trimmed and cut to the excerpt limit. */
export function excerptOf(text: string): string {
  const trimmed = text.trim();
  return trimmed.length <= EXCERPT_LIMIT ? trimmed : `${trimmed.slice(0, EXCERPT_LIMIT)}...`;
}

/** A text file's lines, or none for a binary file. */
export function readableLines(repo: RepoReader, path: string): string[] {
  return repo.isBinary(path) ? [] : (repo.readText(path) ?? "").split(/\r?\n/);
}
