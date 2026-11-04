import type { Check, Evidence, Need } from "../check.js";
import { advisoriesReasons, cards, voices } from "../copy.js";
import { cleanOrUnread } from "../ecosystems.js";
import { lineContaining, readPackageJson } from "../manifest.js";
import type { RepoReader } from "../repo.js";

/** The lockfiles npm writes, which hold every installed package's name and version. */
const NPM_LOCKFILES = ["package-lock.json", "npm-shrinkwrap.json"];
const OTHER_LOCKFILES = ["yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];

/** npm's severities, heaviest first. GitHub says `medium` where npm says `moderate`. */
export const SEVERITIES = ["critical", "high", "moderate", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** How many packages one `gh api` call asks about, so the query stays a short URL. */
const GH_BATCH = 50;

interface Advisory {
  name: string;
  version: string | undefined;
  /** Where the package sits in the lockfile, for the line. */
  node: string | undefined;
  severity: Severity;
  title: string;
}

/** Whether there is anything to look up: a package.json with dependencies, beside an npm lockfile. */
function lookup(repo: RepoReader): "nothing" | "no-lockfile" | "other-lockfile" | "ready" {
  const manifest = readPackageJson(repo);
  if (manifest === undefined || !hasDependencies(manifest)) return "nothing";
  if (NPM_LOCKFILES.some((file) => repo.has(file))) return "ready";
  return OTHER_LOCKFILES.some((file) => repo.has(file)) ? "other-lockfile" : "no-lockfile";
}

function hasDependencies(manifest: Record<string, unknown>): boolean {
  return ["dependencies", "devDependencies", "optionalDependencies"].some((field) => {
    const value = manifest[field];
    return typeof value === "object" && value !== null && Object.keys(value).length > 0;
  });
}

/** The tool this run would ask: npm when it has npm, else gh. */
function tool(capabilities: ReadonlySet<Need>): "npm" | "gh" | undefined {
  if (capabilities.has("npm")) return "npm";
  return capabilities.has("gh") ? "gh" : undefined;
}

export function severityOf(text: unknown): Severity | undefined {
  if (text === "medium") return "moderate";
  return SEVERITIES.find((s) => s === text);
}

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);

/** A lockfile key's package name: the part after the last `node_modules/`. */
function packageName(key: string): string {
  return key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
}

type Locked = Record<string, { version?: string; link?: boolean }>;

/** A version's numbers and its pre-release tag, or undefined when it is not `x.y.z`. */
function parse(version: string): { numbers: number[]; pre: string } | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(version.trim());
  if (match === null) return undefined;
  return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? "" };
}

function compare(a: string, b: string): number | undefined {
  const [x, y] = [parse(a), parse(b)];
  if (x === undefined || y === undefined) return undefined;
  for (let i = 0; i < 3; i++) if (x.numbers[i] !== y.numbers[i]) return x.numbers[i]! - y.numbers[i]!;
  if (x.pre === y.pre) return 0;
  // A pre-release comes before its release.
  if (x.pre === "") return 1;
  if (y.pre === "") return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * Whether a version is inside one of GitHub's ranges: conditions such as `>= 1.0.0, < 1.2.6`, all of which
 * hold. A range it cannot read counts as inside: GitHub already matched the package and version it was asked.
 */
export function inRange(version: string, range: string): boolean {
  for (const condition of range
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "")) {
    const match = /^(<=|>=|<|>|=)?\s*(\S+)$/.exec(condition);
    if (match === null) return true;
    const order = compare(version, match[2]!);
    if (order === undefined) return true;
    const op = match[1] ?? "=";
    const holds =
      op === "<"
        ? order < 0
        : op === "<="
          ? order <= 0
          : op === ">"
            ? order > 0
            : op === ">="
              ? order >= 0
              : order === 0;
    if (!holds) return false;
  }
  return true;
}

/** npm audit's report: each vulnerable package, with the advisories against it among its `via`. */
function fromNpmAudit(stdout: string, locked: Locked): Advisory[] | undefined {
  let report: { vulnerabilities?: Record<string, unknown>; error?: unknown };
  try {
    report = JSON.parse(stdout) as typeof report;
  } catch {
    return undefined;
  }
  if (typeof report !== "object" || report === null || "error" in report) return undefined;
  const found: Advisory[] = [];
  for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
    const { via, nodes } = entry as { via?: unknown[]; nodes?: unknown[] };
    // A package that is only vulnerable through another is listed under that one: its own advisories are the
    // objects in `via`, and a string there names the package that carries them.
    const own = (via ?? []).filter(
      (v): v is { title?: unknown; severity?: unknown } => typeof v === "object" && v !== null,
    );
    const node = typeof nodes?.[0] === "string" ? nodes[0] : undefined;
    for (const advisory of own) {
      const severity = severityOf(advisory.severity);
      if (severity === undefined) continue;
      found.push({
        name,
        version: node === undefined ? undefined : locked[node]?.version,
        node,
        severity,
        title: typeof advisory.title === "string" ? advisory.title : "",
      });
    }
  }
  return found;
}

/** GitHub's advisories, one per line, credited to each package and version asked about that is in range. */
function fromGh(
  lines: string[],
  asked: Map<string, { version: string; node: string }[]>,
): Advisory[] | undefined {
  const found: Advisory[] = [];
  for (const line of lines) {
    let advisory: {
      severity?: unknown;
      summary?: unknown;
      withdrawn_at?: unknown;
      vulnerabilities?: unknown[];
    };
    try {
      advisory = JSON.parse(line) as typeof advisory;
    } catch {
      return undefined;
    }
    const severity = severityOf(advisory.severity);
    if (severity === undefined || (advisory.withdrawn_at !== null && advisory.withdrawn_at !== undefined))
      continue;
    const credited = new Set<string>();
    for (const v of advisory.vulnerabilities ?? []) {
      const { package: pkg, vulnerable_version_range: range } = v as {
        package?: { ecosystem?: string; name?: string };
        vulnerable_version_range?: string;
      };
      if (pkg?.ecosystem !== "npm" || pkg.name === undefined) continue;
      for (const { version, node } of asked.get(pkg.name) ?? []) {
        const key = `${pkg.name}@${version}`;
        if (credited.has(key) || (typeof range === "string" && !inRange(version, range))) continue;
        credited.add(key);
        found.push({
          name: pkg.name,
          version,
          node,
          severity,
          title: typeof advisory.summary === "string" ? advisory.summary : "",
        });
      }
    }
  }
  return found;
}

/** Each locked package and version once, by name, with the first place it sits. */
function lockedPackages(locked: Locked): Map<string, { version: string; node: string }[]> {
  const byName = new Map<string, { version: string; node: string }[]>();
  for (const [node, entry] of Object.entries(locked)) {
    if (node === "" || !node.includes("node_modules/") || entry.link === true || entry.version === undefined)
      continue;
    const name = packageName(node);
    const versions = byName.get(name) ?? [];
    if (!versions.some((v) => v.version === entry.version)) versions.push({ version: entry.version, node });
    byName.set(name, versions);
  }
  return byName;
}

/** One piece of evidence per package and version, at its heaviest advisory, with how many more it has. */
function evidenceFor(found: Advisory[], lockfile: string, lockText: string): Evidence[] {
  const byPackage = new Map<string, Advisory[]>();
  for (const advisory of found) {
    const key = `${advisory.name}@${advisory.version ?? ""}`;
    byPackage.set(key, [...(byPackage.get(key) ?? []), advisory]);
  }
  return [...byPackage.values()]
    .map((advisories) => advisories.sort((a, b) => rank(a.severity) - rank(b.severity)))
    .sort((a, b) => rank(a[0]!.severity) - rank(b[0]!.severity) || a[0]!.name.localeCompare(b[0]!.name))
    .map((advisories) => {
      const top = advisories[0]!;
      const line = top.node === undefined ? undefined : lineContaining(lockText, `"${top.node}"`);
      const weighed =
        top.severity === "moderate"
          ? "moderate"
          : top.severity === "low" || top.severity === "info"
            ? "low"
            : undefined;
      return {
        path: lockfile,
        ...(line === undefined ? {} : { line }),
        excerpt: advisoriesReasons.excerpt(
          top.name,
          top.version,
          top.severity,
          top.title,
          advisories.length - 1,
        ),
        rule: "advisory",
        ...(weighed === undefined ? {} : { weighed }),
      } satisfies Evidence;
    });
}

export const depsAdvisories: Check = {
  id: "deps.advisories",
  title: "Known advisories in dependencies",
  booksName: "known vulnerable component",
  // npm or gh, whichever the run has, is chosen in the run: a need is all-of, and this is one-of.
  needs: ["network"],
  voice: voices["deps.advisories"],
  card: cards["deps.advisories"],
  outgoing(repo, capabilities) {
    if (lookup(repo) !== "ready") return undefined;
    const using = tool(capabilities);
    return using === undefined ? undefined : advisoriesReasons.outgoing[using];
  },
  run(repo, context) {
    const state = lookup(repo);
    // No package.json, or no dependencies in it: nothing can carry an advisory, and no call is made.
    if (state === "nothing") return cleanOrUnread(repo, false);
    if (state === "no-lockfile") return { verdict: "not-investigated", reason: advisoriesReasons.noLockfile };
    if (state === "other-lockfile")
      return { verdict: "not-investigated", reason: advisoriesReasons.otherLockfile };

    const lockfile = NPM_LOCKFILES.find((file) => repo.has(file))!;
    const lockText = repo.readText(lockfile) ?? "";
    let locked: Locked;
    try {
      locked = (JSON.parse(lockText) as { packages?: Locked }).packages ?? {};
    } catch {
      return { verdict: "not-investigated", reason: advisoriesReasons.unreadableLockfile(lockfile) };
    }

    let found: Advisory[] | undefined;
    if (context.npm !== undefined) {
      // npm audit sends the lockfile's names and versions to npm's configured registry, as it always does.
      const answer = context.npm.run(["audit", "--json"], repo.root);
      // npm audit exits 1 when it finds something, and 0 when it does not.
      if (answer.error !== undefined || (answer.status !== 0 && answer.status !== 1))
        return { verdict: "not-investigated", reason: advisoriesReasons.npmFailed };
      found = fromNpmAudit(answer.stdout, locked);
      if (found === undefined) return { verdict: "not-investigated", reason: advisoriesReasons.npmFailed };
    } else if (context.gh !== undefined) {
      const asked = lockedPackages(locked);
      const names = [...asked.entries()].flatMap(([name, versions]) =>
        versions.map((v) => `${name}@${v.version}`),
      );
      const lines: string[] = [];
      for (let i = 0; i < names.length; i += GH_BATCH) {
        // Only names and versions go to GitHub; the matching to the lockfile is done here.
        const answer = context.gh.run(
          [
            "api",
            "-X",
            "GET",
            "/advisories",
            "-f",
            "ecosystem=npm",
            "-f",
            `affects=${names.slice(i, i + GH_BATCH).join(",")}`,
            "-f",
            "per_page=100",
            "--paginate",
            "--jq",
            ".[]",
          ],
          repo.root,
        );
        if (answer.error !== undefined || answer.status !== 0)
          return { verdict: "not-investigated", reason: advisoriesReasons.ghFailed };
        lines.push(...answer.stdout.split("\n").filter((l) => l.trim() !== ""));
      }
      found = fromGh(lines, asked);
      if (found === undefined) return { verdict: "not-investigated", reason: advisoriesReasons.ghFailed };
    } else {
      return { verdict: "not-investigated", reason: advisoriesReasons.noTool };
    }

    const evidence = evidenceFor(found, lockfile, lockText);
    return evidence.length === 0 ? cleanOrUnread(repo, true) : { verdict: "found", evidence };
  },
};
