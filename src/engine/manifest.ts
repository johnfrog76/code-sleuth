import type { RepoReader } from "./repo.js";

/** The root `package.json`, parsed, or undefined when there is none or it is not JSON. */
export function readPackageJson(
  repo: RepoReader,
  path = "package.json",
): Record<string, unknown> | undefined {
  const text = repo.readText(path);
  if (text === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** The 1-based line of the first line containing `needle`, or undefined. */
export function lineContaining(text: string, needle: string): number | undefined {
  const index = text.split(/\r?\n/).findIndex((line) => line.includes(needle));
  return index < 0 ? undefined : index + 1;
}
