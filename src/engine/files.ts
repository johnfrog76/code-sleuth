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
    const matches = repo.files.filter((path) => {
      if (!path.startsWith(base)) return false;
      const name = path.slice(base.length);
      return !name.includes("/") && name.toLowerCase().startsWith(wanted);
    });
    // The plain one first: README.md over README-ja.md, which sorts ahead of it by its bytes.
    const plain = matches.find((path) => {
      const name = path.slice(base.length).toLowerCase();
      return name === wanted || name.startsWith(`${wanted}.`);
    });
    if (plain !== undefined || matches[0] !== undefined) return plain ?? matches[0];
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
