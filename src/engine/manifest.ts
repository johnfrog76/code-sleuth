import type { RepoReader } from "./repo.js";

/**
 * A `package.json`, read: absent, unreadable (not a JSON object), or read. The two that are not read are kept
 * apart on purpose: absent means there is nothing to check, unreadable means there is something nobody read, and a
 * check must never read clean on the second.
 */
export type Manifest =
  | { state: "absent" }
  | { state: "unreadable"; path: string }
  | { state: "read"; manifest: Record<string, unknown> };

export function readManifest(repo: RepoReader, path = "package.json"): Manifest {
  const text = repo.readText(path);
  if (text === undefined) return { state: "absent" };
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? { state: "read", manifest: parsed as Record<string, unknown> }
      : { state: "unreadable", path };
  } catch {
    return { state: "unreadable", path };
  }
}

/** The manifest when it was read, else undefined. Only for a caller that has already handled `unreadable`. */
export function manifestOf(read: Manifest): Record<string, unknown> | undefined {
  return read.state === "read" ? read.manifest : undefined;
}

/** The 1-based line of the first line containing `needle`, or undefined. */
export function lineContaining(text: string, needle: string): number | undefined {
  const index = text.split(/\r?\n/).findIndex((line) => line.includes(needle));
  return index < 0 ? undefined : index + 1;
}
