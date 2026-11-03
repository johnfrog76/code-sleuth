import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** How a stub npm answers `npm outdated` and `npm audit`. */
export interface NpmScenario {
  /** What it prints: npm outdated's JSON, by package name. */
  outdated?: Record<string, { current?: string; wanted?: string; latest: string; type?: string }>;
  /** Its exit code; npm outdated exits 1 when something is outdated. */
  status?: number;
  /** Print this instead of JSON. */
  raw?: string;
  /** What `npm audit --json` prints: its report. With none, a report that finds nothing. */
  audit?: { vulnerabilities: Record<string, unknown> } | { raw: string };
  /** Its exit code; npm audit exits 1 when it finds something. */
  auditStatus?: number;
}

// The stub: node, standing in for npm. It logs each call (its arguments and folder) and answers from the
// scenario. Nothing reaches a registry.
const STUB = String.raw`
const fs = require("fs");
const scenario = JSON.parse(fs.readFileSync(process.env.STUB_NPM_SCENARIO, "utf8"));
fs.appendFileSync(process.env.STUB_NPM_LOG, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }) + "\n");
if (process.argv[2] === "audit") {
  const audit = scenario.audit ?? { vulnerabilities: {} };
  process.stdout.write(audit.raw !== undefined ? audit.raw : JSON.stringify({ auditReportVersion: 2, ...audit }));
  process.exit(scenario.auditStatus ?? (Object.keys(audit.vulnerabilities ?? {}).length > 0 ? 1 : 0));
}
if (scenario.raw !== undefined) process.stdout.write(scenario.raw);
else process.stdout.write(JSON.stringify(scenario.outdated ?? {}));
process.exit(scenario.status ?? (Object.keys(scenario.outdated ?? {}).length > 0 ? 1 : 0));
`;

export function stubNpm(folder: string, scenario: NpmScenario = {}) {
  const bin = join(folder, "npm-bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "npm"), `#!${process.execPath}\n${STUB}`);
  chmodSync(join(bin, "npm"), 0o755);
  const log = join(folder, "npm-calls.log");
  const scenarioFile = join(folder, "npm-scenario.json");
  writeFileSync(scenarioFile, JSON.stringify(scenario));
  return {
    env: { PATH: bin, STUB_NPM_LOG: log, STUB_NPM_SCENARIO: scenarioFile },
    calls: (): { argv: string[]; cwd: string }[] =>
      existsSync(log)
        ? readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .filter((l) => l !== "")
            .map((l) => JSON.parse(l))
        : [],
  };
}

/** How a stub gh answers `gh api /advisories`: the advisories it holds, or a failure. */
export interface GhScenario {
  /** GitHub's advisories. The stub answers each call with those that name an asked-for package. */
  advisories?: Record<string, unknown>[];
  /** Its exit code, for a gh that is not signed in or cannot reach GitHub. */
  status?: number;
  /** Print this instead of the advisories. */
  raw?: string;
}

// The stub: node, standing in for gh. It logs each call and answers from the scenario, one advisory per line
// as `--jq '.[]'` would print them. Nothing reaches GitHub.
const GH_STUB = String.raw`
const fs = require("fs");
const scenario = JSON.parse(fs.readFileSync(process.env.STUB_GH_SCENARIO, "utf8"));
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_GH_LOG, JSON.stringify({ argv, cwd: process.cwd() }) + "\n");
if (scenario.status !== undefined && scenario.status !== 0) {
  process.stderr.write("gh: To get started with GitHub CLI, please run: gh auth login\n");
  process.exit(scenario.status);
}
if (scenario.raw !== undefined) { process.stdout.write(scenario.raw); process.exit(0); }
const affects = (argv.find((a) => a.startsWith("affects=")) ?? "affects=").slice(8).split(",");
const names = new Set(affects.map((a) => a.slice(0, a.lastIndexOf("@"))));
for (const advisory of scenario.advisories ?? []) {
  if ((advisory.vulnerabilities ?? []).some((v) => names.has(v.package.name)))
    process.stdout.write(JSON.stringify(advisory) + "\n");
}
`;

export function stubGh(folder: string, scenario: GhScenario = {}) {
  const bin = join(folder, "gh-bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "gh"), `#!${process.execPath}\n${GH_STUB}`);
  chmodSync(join(bin, "gh"), 0o755);
  const log = join(folder, "gh-calls.log");
  const scenarioFile = join(folder, "gh-scenario.json");
  writeFileSync(scenarioFile, JSON.stringify(scenario));
  return {
    env: { PATH: bin, STUB_GH_LOG: log, STUB_GH_SCENARIO: scenarioFile },
    calls: (): { argv: string[]; cwd: string }[] =>
      existsSync(log)
        ? readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .filter((l) => l !== "")
            .map((l) => JSON.parse(l))
        : [],
  };
}
