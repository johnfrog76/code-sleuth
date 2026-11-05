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

/** Each locked package, by its node path (`node_modules/a`, `node_modules/a/node_modules/b`), and its version. */
export type LockedPackages = Record<string, { version?: string; [key: string]: unknown }>;

/**
 * The packages a parsed npm lockfile locks: `packages` in a v2 or v3 lockfile, or, in a v1 lockfile, its
 * `dependencies` tree laid out the same way. A v1 lockfile is not "nothing locked".
 */
export function lockedOf(lock: unknown): LockedPackages {
  if (typeof lock !== "object" || lock === null) return {};
  const { packages, dependencies } = lock as { packages?: unknown; dependencies?: unknown };
  if (typeof packages === "object" && packages !== null) return packages as LockedPackages;
  const locked: LockedPackages = {};
  const walk = (tree: unknown, prefix: string) => {
    if (typeof tree !== "object" || tree === null) return;
    for (const [name, entry] of Object.entries(tree)) {
      if (typeof entry !== "object" || entry === null) continue;
      const node = `${prefix}node_modules/${name}`;
      const { version, dependencies: nested } = entry as { version?: unknown; dependencies?: unknown };
      locked[node] = typeof version === "string" ? { version } : {};
      walk(nested, `${node}/`);
    }
  };
  walk(dependencies, "");
  return locked;
}
