#!/usr/bin/env node
// Reads what Code Sleuth did with the decoy case (scripts/make-decoy-case.mjs) and says, one line per check,
// whether each expected result holds. The periodic-audit workflow runs it; docs/TESTING.md runs it by hand.
//
//   node scripts/check-decoy-case.mjs --before <decoy folder> <runs folder>
//   node scripts/check-decoy-case.mjs <decoy folder> <runs folder>
//
// --before fingerprints every file under the decoy folder, .git included, into <runs folder>/fingerprint.json.
// Run it after making the decoy case and before any run. The runs folder then holds, for each decoy <name>:
//
//   <name>.txt     everything the run printed, standard output and standard error together
//   <name>.exit    its exit code
//   cases/         the --out folder every run wrote its case to
//
// and, beside them, make.txt (what make-decoy-case printed) and toolkit-offline.txt and .exit (a run on the
// env decoy with --offline --toolkit, which must be refused). Prints PASS or FAIL, with the reason, for each
// check, and exits 1 on any FAIL. A decoy the builder skipped (it says SKIPPED, on Windows) is skipped here too.
//
// The expected words are Code Sleuth's own, copied from src/engine/copy.ts, src/case/copy.ts and
// src/cli/copy.ts; test/decoy.test.ts holds them to those files.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Every decoy make-decoy-case makes. Two are POSIX only. */
const DECOYS = ["npmrc", "index", "huge", "names", "env", "bidi", "replace", "slowgit"];

/** Code Sleuth's words this checker expects, each from the copy file named. */
const WORDS = {
  // src/engine/copy.ts, refusedReasons.leadsOutside("../outside.txt", 0)
  leadsOutside:
    "The index lists ../outside.txt leading outside the repository, so I didn't read it, and can't call this clean.",
  // src/engine/copy.ts, tooLargeReasons.text("big.txt", 0)
  tooLargeText: "big.txt is over 5 MB, so I didn't read it, and can't call this clean.",
  // src/engine/copy.ts, tooLargeReasons.history
  tooLargeHistory:
    "The history is larger than I read (over 64 MB of changes, or two million added lines), so I didn't read it, and can't call it clean.",
  // src/engine/copy.ts, needReasons.network and needReasons.denyList
  needNetwork: "This makes a call off the machine, and --offline is set.",
  needDenyList: "This needs a deny list: give one with --deny <file>.",
  // src/case/copy.ts, verdictLine for the env decoy, after the stamp
  envVerdict: "NOT MET  By my checklist: not met for public facing. Four smoking guns, six loose ends.",
  // src/cli/copy.ts, run.polish, the label the Polish line starts with
  polishLabel: "Polish",
  // src/case/copy.ts, how polish.keySet starts: the words for a key that was found
  keySet: "an API key is set",
  // src/cli/copy.ts, toolkit.offline and toolkit.offlineHint, as src/cli/refusal.ts prints them
  toolkitOffline:
    "Error: --toolkit can't go with --offline: filing needs PowerShell to find ToolKit, and under --offline I don't start it.",
  toolkitOfflineHint:
    "Hint: Leave out --offline to file the cards in ToolKit, or leave out --toolkit: the cards are in the case file either way.",
};

/** The verdict stamps, src/case/copy.ts, each followed by two spaces at the start of the verdict line. */
const STAMP = /^(MET|NEARLY MET|NOT MET) {2}/;

/** What never belongs in a written file or the terminal: C0 controls but tab, LF and CR, DEL, C1, bidi and
 * every invisible format character. Code Sleuth writes U+FFFD (in files) or ? (on screen) in their place. */
// eslint-disable-next-line no-control-regex -- finding control characters is the point
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]|\p{Cf}/u;

const args = process.argv.slice(2);
const before = args[0] === "--before";
if (before) args.shift();
if (args.length !== 2) {
  console.error("Usage: node scripts/check-decoy-case.mjs [--before] <decoy folder> <runs folder>");
  process.exit(2);
}
const decoyDir = resolve(args[0]);
const runsDir = resolve(args[1]);
const casesDir = join(runsDir, "cases");

/** Every entry under a folder, with a hash of each file, its link target, or its kind. A FIFO is never opened. */
function fingerprint(root) {
  const entries = {};
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const key = rel === "" ? name : `${rel}/${name}`;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) entries[key] = `link ${readlinkSync(path)}`;
      else if (stat.isDirectory()) {
        entries[key] = "folder";
        walk(path, key);
      } else if (stat.isFile()) {
        entries[key] = `file ${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
      } else entries[key] = `other ${stat.mode.toString(8)}`;
    }
  };
  walk(root, "");
  return entries;
}

if (before) {
  writeFileSync(join(runsDir, "fingerprint.json"), JSON.stringify(fingerprint(decoyDir), null, 2) + "\n");
  console.log(`Fingerprinted ${decoyDir} into ${join(runsDir, "fingerprint.json")}.`);
  process.exit(0);
}

let failed = 0;
function report(ok, label, why) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || why === undefined ? "" : `: ${why}`}`);
}
/** Runs one check; a throw is a FAIL with its message. */
function check(label, fn) {
  try {
    const why = fn();
    report(why === undefined, label, why);
  } catch (error) {
    report(false, label, error instanceof Error ? error.message : String(error));
  }
}

/** Every file under a folder, as [path, bytes]. */
function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir, { recursive: true })) {
    const path = join(dir, name);
    if (lstatSync(path).isFile()) out.push([path, readFileSync(path)]);
  }
  return out;
}

function read(path) {
  return readFileSync(path, "utf8");
}

/** The one case folder a decoy's run wrote, and its record. */
function caseOf(name) {
  const repoDirs = readdirSync(casesDir).filter((n) => n.startsWith(`${name}-`));
  if (repoDirs.length !== 1)
    throw new Error(`expected one case folder for ${name}, found ${repoDirs.length}`);
  const caseDirs = readdirSync(join(casesDir, repoDirs[0]));
  if (caseDirs.length !== 1) throw new Error(`expected one case for ${name}, found ${caseDirs.length}`);
  const dir = join(casesDir, repoDirs[0], caseDirs[0]);
  return { dir, record: JSON.parse(read(join(dir, "case.json"))), md: read(join(dir, "case.md")) };
}

function checkById(record, id) {
  const found = record.checks.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no ${id} in case.json`);
  return found;
}

/** Where a check found something, as path:line only: an excerpt could hold what this checker looks for. */
function where(c) {
  const at = (c.evidence ?? []).map((e) =>
    JSON.stringify(e.line === undefined ? e.path : `${e.path}:${e.line}`),
  );
  return at.length === 0 ? "no evidence" : `evidence at ${at.join(", ")}`;
}

function expectEqual(actual, expected, what) {
  return actual === expected
    ? undefined
    : `${what} is ${JSON.stringify(actual)}, not ${JSON.stringify(expected)}`;
}

// S1: the builder listed every decoy, or said SKIPPED, and no trap had fired yet. A skip counts only on
// Windows, and only for names and slowgit (each skipped whole) and bidi's control-character file name.
const make = existsSync(join(runsDir, "make.txt")) ? read(join(runsDir, "make.txt")) : "";
const windows = process.platform === "win32";
const SKIPPABLE = ["names", "slowgit", "bidi"];
const present = [];
const wrongSkips = [];
let bidiNameSkipped = false;
for (const name of DECOYS) {
  const line = make.split(/\r?\n/).find((l) => l.trimStart().startsWith(`${name} `));
  if (line !== undefined && line.includes("SKIPPED")) {
    if (!windows || !SKIPPABLE.includes(name)) wrongSkips.push(name);
    else if (name === "bidi") {
      bidiNameSkipped = true;
      console.log("SKIP  bidi's control-character file name: the builder skipped it on Windows");
    } else {
      console.log(`SKIP  ${name}: the builder skipped it on Windows`);
      continue;
    }
  }
  present.push(name);
}
check("S1 the builder listed every decoy it made, and no trap had fired", () => {
  if (wrongSkips.length > 0) return `SKIPPED where no skip counts: ${wrongSkips.join(", ")}`;
  for (const name of present) if (!existsSync(join(decoyDir, name, ".git"))) return `${name} is missing`;
  if (!make.includes("none does now")) return 'make.txt does not say "none does now"';
});

/** Everything the runs wrote or printed: every file under the cases folder, and each run's output. */
function written() {
  return [
    ...filesUnder(casesDir),
    ...filesUnder(runsDir).filter(([p]) => p.endsWith(".txt") && !p.endsWith("make.txt")),
  ];
}

/** Every key and string value in a parsed JSON document. */
function jsonStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) jsonStrings(item, out);
  else if (value !== null && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      out.push(key);
      jsonStrings(item, out);
    }
  return out;
}

// Every run exited 0.
for (const name of present) {
  check(`run ${name} exited 0`, () =>
    expectEqual(read(join(runsDir, `${name}.exit`)).trim(), "0", `${name}.exit`),
  );
}

// D1: the npmrc trap never ran: npm never read the decoy's .npmrc.
check("D1 npmrc: no FIRED-npmrc.txt, so the decoy's .npmrc was never read", () => {
  if (existsSync(join(decoyDir, "FIRED-npmrc.txt"))) return `${join(decoyDir, "FIRED-npmrc.txt")} exists`;
  caseOf("npmrc");
});

// D2: the index names ../outside.txt. Nothing reads clean, every check that would says why, and the outside
// file's text is nowhere.
check("D2 index: no check reads clean, and each that would says the index leads outside", () => {
  const { record } = caseOf("index");
  const other = new Set([WORDS.needNetwork, WORDS.needDenyList]);
  for (const c of record.checks) {
    if (c.verdict === "clean") return `${c.id} reads clean`;
    if (c.verdict === "not-investigated" && !other.has(c.reason) && c.reason !== WORDS.leadsOutside)
      return `${c.id} says ${JSON.stringify(c.reason)}`;
  }
  return expectEqual(checkById(record, "secrets.tree").reason, WORDS.leadsOutside, "secrets.tree's reason");
});
check("D2 index: OUTSIDE-MARKER is in no case file and not in the terminal", () => {
  const { dir } = caseOf("index");
  for (const [path, bytes] of filesUnder(dir))
    if (bytes.includes("OUTSIDE-MARKER")) return `${path} holds it`;
  if (read(join(runsDir, "index.txt")).includes("OUTSIDE-MARKER")) return "index.txt holds it";
});

// D3: a committed 99 MB file is found, and what is too large to read says so.
check("D3 huge: files.large finds big.txt; secrets.tree and secrets.history say it is too large", () => {
  const { record } = caseOf("huge");
  const large = checkById(record, "files.large");
  if (large.verdict !== "found" || !large.evidence?.some((e) => e.path === "big.txt"))
    return `files.large is ${large.verdict} with ${where(large)}`;
  const tree = checkById(record, "secrets.tree");
  const history = checkById(record, "secrets.history");
  return (
    expectEqual(tree.verdict, "not-investigated", "secrets.tree") ??
    expectEqual(tree.reason, WORDS.tooLargeText, "secrets.tree's reason") ??
    expectEqual(history.verdict, "not-investigated", "secrets.history") ??
    expectEqual(history.reason, WORDS.tooLargeHistory, "secrets.history's reason")
  );
});
check("D3 huge: the run took under a minute", () => {
  const { record } = caseOf("huge");
  const seconds = (Date.parse(record.closedAt) - Date.parse(record.openedAt)) / 1000;
  if (!(seconds < 60)) return `it took ${seconds} s`;
});

// D4: a file name holding a fake MET verdict line stays one line, under paths.machine.
if (present.includes("names")) {
  check("D4 names: paths.machine finds the file, and the only verdict line is the real one", () => {
    const { record } = caseOf("names");
    const paths = checkById(record, "paths.machine");
    if (paths.verdict !== "found" || !paths.evidence?.some((e) => e.path.startsWith("notes")))
      return `paths.machine is ${paths.verdict} with ${where(paths)}`;
    const stamped = read(join(runsDir, "names.txt"))
      .split(/\r?\n/)
      .filter((l) => STAMP.test(l));
    if (stamped.length !== 1 || !stamped[0].startsWith("NOT MET  By my checklist: "))
      return `the lines starting with a stamp are ${JSON.stringify(stamped)}`;
  });
}

// D5: the planted .env and token. Found, masked only, and the decoy's .env never read for a key.
const tokenMatch = /"(gh[^"]*)"/.exec(read(join(decoyDir, "env", "config", "dev.ts")));
const keyMatch = /ANTHROPIC_API_KEY=(\S+)/.exec(read(join(decoyDir, "env", ".env")));
check("D5 env: the verdict is the one the docs show, with four smoking guns", () => {
  const { record } = caseOf("env");
  const line = read(join(runsDir, "env.txt"))
    .split(/\r?\n/)
    .find((l) => STAMP.test(l));
  return (
    expectEqual(record.verdict, "not-met", "the verdict") ??
    expectEqual(record.counts["smoking-gun"], 4, "the smoking guns") ??
    expectEqual(line, WORDS.envVerdict, "the verdict line")
  );
});
check("D5 env: secrets.tree shows the token and the key masked, ending in their last two characters", () => {
  if (tokenMatch === null || keyMatch === null)
    return "the decoy's made-up values are not where they were put";
  const { record } = caseOf("env");
  const excerpts = (checkById(record, "secrets.tree").evidence ?? []).map((e) => e.excerpt ?? "");
  const token = `${tokenMatch[1].slice(0, 4)}****${tokenMatch[1].slice(-2)}`;
  const key = `${keyMatch[1].slice(0, 4)}****${keyMatch[1].slice(-2)}`;
  if (!excerpts.some((e) => e.includes(token))) return `no excerpt holds ${token}`;
  if (!excerpts.some((e) => e.includes(key))) return `no excerpt holds ${key}`;
});
check(
  "D5 every decoy: no made-up value, whole or any 12 characters of its middle, in any case file or output",
  () => {
    if (tokenMatch === null || keyMatch === null)
      return "the decoy's made-up values are not where they were put";
    // The middle is all but the first four characters and the last two, the ones a mask shows.
    const pieces = [];
    for (const value of [tokenMatch[1], keyMatch[1]]) {
      pieces.push(value);
      const middle = value.slice(4, -2);
      for (let at = 0; at + 12 <= middle.length; at += 6) pieces.push(middle.slice(at, at + 12));
    }
    for (const [path, bytes] of written())
      for (const piece of pieces) if (bytes.includes(piece)) return `${path} holds part of one`;
  },
);
check("D5 env: polish is off, and no key came from the decoy's .env", () => {
  const { record } = caseOf("env");
  const polish = record.enhancements?.polish;
  if (polish?.state !== "off") return `polish is ${JSON.stringify(polish)}`;
  if (polish.keyFrom !== undefined && polish.keyFrom !== "the environment")
    return `the key came from ${polish.keyFrom}`;
  const line = read(join(runsDir, "env.txt"))
    .split(/\r?\n/)
    .find((l) => l.startsWith(WORDS.polishLabel));
  if (line === undefined) return "no Polish line";
  if (line.includes(join(decoyDir, "env"))) return `the Polish line names the decoy: ${line}`;
  if (polish.keyFrom === undefined && line.includes(WORDS.keySet)) return `it says ${line}`;
});

// D6: no control, bidi or invisible character in anything written or printed, and case.md marks where they were.
check(
  "D6 every decoy: no raw control, bidi or zero-width character or lone carriage return in any case file or output",
  () => {
    for (const [path, bytes] of written()) {
      const text = bytes.toString("utf8");
      const at = text.search(CONTROLS);
      if (at >= 0) return `${path} holds U+${text.codePointAt(at).toString(16)} at ${at}`;
      const cr = text.search(/\r(?!\n)/);
      if (cr >= 0) return `${path} holds a lone carriage return at ${cr}`;
    }
  },
);
// JSON writes a control character as the text \u001b, which the byte check above cannot see.
check(
  "D6 every decoy: no control, bidi, zero-width or lone carriage return in any key or string of a .json",
  () => {
    for (const [path, bytes] of written()) {
      if (!path.endsWith(".json")) continue;
      for (const text of jsonStrings(JSON.parse(bytes.toString("utf8")))) {
        const at = text.search(CONTROLS);
        if (at >= 0) return `${path} holds U+${text.codePointAt(at).toString(16)} in a string`;
        if (/\r(?!\n)/.test(text)) return `${path} holds a lone carriage return in a string`;
      }
    }
  },
);
if (bidiNameSkipped) console.log("SKIP  D6 bidi: the control-character file name, skipped by the builder");
else {
  check(
    "D6 bidi: paths.machine finds the control-character file under docs/, and case.md holds U+FFFD",
    () => {
      const { record, md } = caseOf("bidi");
      const paths = checkById(record, "paths.machine");
      if (paths.verdict !== "found" || !paths.evidence?.some((e) => e.path.startsWith("docs/")))
        return `paths.machine is ${paths.verdict} with ${where(paths)}`;
      if (!md.includes("\uFFFD")) return "case.md holds no U+FFFD";
    },
  );
}
check("D6 bidi: quality.markers finds src/app.ts, with U+FFFD where the controls were", () => {
  const { record } = caseOf("bidi");
  const markers = checkById(record, "quality.markers");
  const hit = markers.evidence?.find((e) => e.path === "src/app.ts");
  if (markers.verdict !== "found" || hit === undefined) return `quality.markers is ${markers.verdict}`;
  if (!hit.excerpt?.includes("\uFFFD")) return "its excerpt holds no U+FFFD";
});

// D7: a replacement object does not hide the commit that added the token.
check("D7 replace: secrets.history finds secret.ts:1, a smoking gun", () => {
  const { record } = caseOf("replace");
  const history = checkById(record, "secrets.history");
  if (history.verdict !== "found") return `secrets.history is ${history.verdict}`;
  if (!history.evidence?.some((e) => e.path === "secret.ts" && e.line === 1))
    return `its evidence is ${where(history)}`;
  return expectEqual(history.weight, "smoking-gun", "its weight");
});

// D8: git never answers. The run ends, and what needs git is never called clean. The reason's words are not
// pinned here: they say what git did, and that may be put better.
if (present.includes("slowgit")) {
  check("D8 slowgit: the run ends, and secrets.history is not investigated, never clean", () => {
    const { record } = caseOf("slowgit");
    return expectEqual(checkById(record, "secrets.history").verdict, "not-investigated", "secrets.history");
  });
}

// D9: nothing under the decoy folder changed, .git included.
check("D9 every decoy: the decoy folder is byte for byte what it was before the runs", () => {
  const was = JSON.parse(read(join(runsDir, "fingerprint.json")));
  const now = fingerprint(decoyDir);
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)]))
    if (was[key] !== now[key]) return `${key} was ${was[key] ?? "not there"}, is ${now[key] ?? "not there"}`;
});

// G4: --toolkit with --offline is refused, exit 2, one Error: line and one Hint: line. Lines npm itself prints
// around a run (npx's own warnings) are not Code Sleuth's and are left out.
check("G4 --toolkit with --offline is refused: exit 2, its Error: and Hint: lines", () => {
  const lines = read(join(runsDir, "toolkit-offline.txt"))
    .split(/\r?\n/)
    .filter((l) => l.startsWith("Error:") || l.startsWith("Hint:"));
  return (
    expectEqual(read(join(runsDir, "toolkit-offline.exit")).trim(), "2", "the exit code") ??
    expectEqual(lines.join("\n"), `${WORDS.toolkitOffline}\n${WORDS.toolkitOfflineHint}`, "the output")
  );
});

console.log(failed === 0 ? "Every check passed." : `${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
