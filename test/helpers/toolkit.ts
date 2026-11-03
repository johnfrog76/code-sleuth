import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** How a stub ToolKit answers. */
export interface Scenario {
  /** `absent`: NewPrompt does not resolve. `no-config`: it resolves, but $global:P20Config is not there. */
  probe?:
    | "absent"
    | "no-config"
    | {
        prefix: string;
        space: string;
        spaces: string[];
        /** Each Space's address; left out, the probe reports none, as an older ToolKit's would. */
        addresses?: { slug: string; org: string | null; repos: string[] }[];
      };
  /** Titles ToolKit refuses with exit 2 and its own Error: and Hint: lines. */
  refuse?: string[];
  /** Titles ToolKit fails on with exit 1 and no stated reason. */
  fail?: string[];
  /** Titles ToolKit files but answers in words Code Sleuth does not recognise. */
  garble?: string[];
}

export interface Call {
  shell: string;
  argv: string[];
  space: string | null;
}

// The stub shell: node, standing in for pwsh or powershell.exe. It reads the arguments handoff.ps1 would get,
// logs them, and answers as ToolKit's NewPrompt does, colour codes and all.
const STUB = String.raw`
const fs = require("fs");
const path = require("path");
const argv = process.argv.slice(2);
const log = process.env.STUB_LOG;
const scenario = JSON.parse(fs.readFileSync(process.env.STUB_SCENARIO, "utf8"));
fs.appendFileSync(log, JSON.stringify({ shell: path.basename(process.argv[1]), argv, space: process.env.P20_ACTIVE_SPACE ?? null }) + "\n");
const arg = (name) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
const probe = scenario.probe ?? { prefix: "tk", space: "widget", spaces: ["widget", "other"] };
if (probe === "absent") { process.stderr.write("ToolKit's tkNewPrompt is not available in this shell.\n"); process.exit(3); }
if (argv.includes("-Probe")) {
  if (probe === "no-config") { process.stdout.write('CODE-SLEUTH-PROBE {"prefix":null,"space":null,"spaces":null,"root":null}\n'); process.exit(0); }
  const asked = process.env.P20_ACTIVE_SPACE;
  // ToolKit falls back to another Space for a slug it does not declare.
  const space = asked && probe.spaces.includes(asked) ? asked : probe.spaces[0];
  process.stdout.write("Welcome noise from a profile-less start\n");
  process.stdout.write("CODE-SLEUTH-PROBE " + JSON.stringify({ prefix: probe.prefix, space, spaces: probe.spaces, addresses: probe.addresses ?? null, root: "/hub" }) + "\n");
  process.exit(0);
}
const title = arg("-Title");
if ((scenario.refuse ?? []).includes(title)) {
  process.stderr.write("Error: A card with that title is already in play.\nHint: Archive it first.\n");
  process.exit(2);
}
if ((scenario.fail ?? []).includes(title)) process.exit(1);
const counter = log + ".n";
const n = (fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0) + 1;
fs.writeFileSync(counter, String(n));
if ((scenario.garble ?? []).includes(title)) { process.stdout.write("Done, probably.\n"); process.exit(0); }
const id = "K7M" + n;
const type = arg("-Type");
const space = process.env.P20_ACTIVE_SPACE ?? (probe.space ?? "widget");
const file = type + id + "-card.prompt.md";
const esc = String.fromCharCode(27);
process.stdout.write("\n" + esc + "[32m[+] Created " + file + " in " + space + "/backlog/ -- " + type + " " + id + ", offline." + esc + "[0m\n");
process.stdout.write(esc + "[34m    Prompt: file:////hub/" + space + "/backlog/" + file + esc + "[0m\n");
process.exit(0);
`;

/** A folder of stub shells to put on the PATH, with a log of every call they get. */
export function stubToolkit(folder: string, shells: ("pwsh" | "powershell.exe")[], scenario: Scenario = {}) {
  const bin = join(folder, "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of shells) {
    const file = join(bin, name);
    writeFileSync(file, `#!${process.execPath}\n${STUB}`);
    chmodSync(file, 0o755);
  }
  const log = join(folder, "calls.log");
  const scenarioFile = join(folder, "scenario.json");
  writeFileSync(scenarioFile, JSON.stringify(scenario));
  return {
    env: { PATH: bin, STUB_LOG: log, STUB_SCENARIO: scenarioFile },
    calls: (): Call[] =>
      existsSync(log)
        ? readFileSync(log, "utf8")
            .trim()
            .split("\n")
            .filter((l) => l !== "")
            .map((l) => JSON.parse(l) as Call)
        : [],
  };
}
