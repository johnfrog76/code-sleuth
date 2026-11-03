import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Enhancements } from "../../src/case/record.js";
import { takeCase } from "../../src/case/write.js";
import { findGoal } from "../../src/engine/goals.js";
import { investigate, type InvestigateOptions } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

const GOLDEN = fileURLToPath(new URL("../fixtures/cases/", import.meta.url));
const UPDATE = process.env.UPDATE_GOLDEN === "1";

/** Every file in a case folder, by its path inside it. */
function readCase(folder: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(join(folder, prefix), { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(files, readCase(folder, path));
    else files[path] = readFileSync(join(folder, path), "utf8");
  }
  return files;
}

interface RunOptions {
  git?: boolean;
  all?: boolean;
  now?: () => Date;
  denyList?: readonly string[];
  commits?: InvestigateOptions["commits"];
  enhancements?: Enhancements;
}

function run(fixture: string, goal: string, options: RunOptions = {}) {
  return withScratch((out) =>
    investigate(
      `whole/${fixture}`,
      (repo, capabilities) => {
        const { path } = takeCase({
          repo,
          goal: findGoal(goal)!,
          capabilities,
          casesFolder: out,
          chosen: true,
          all: options.all ?? false,
          ...(options.now ? { now: options.now } : {}),
          ...(options.denyList ? { denyList: options.denyList } : {}),
          ...(options.enhancements ? { enhancements: options.enhancements } : {}),
        });
        return { path, files: readCase(path) };
      },
      { git: options.git ?? false, ...(options.commits ? { commits: options.commits } : {}) },
    ),
  );
}

const fixed = () => new Date("2026-10-31T14:02:11Z");

// What each golden case says about ToolKit: not there, there with nothing filed, and a filing.
const NO_TOOLKIT: Enhancements = {
  polish: { state: "off", reason: "no --polish, no key" },
  toolkit: { state: "not-installed" },
};
const FOUND: Enhancements = {
  polish: { state: "off", reason: "no --polish" },
  toolkit: { state: "detected", via: "cli", shell: "pwsh", prefix: "tk", space: "widget" },
};
const FILED: Enhancements = {
  polish: { state: "off", reason: "no key" },
  toolkit: {
    state: "detected",
    via: "cli",
    shell: "pwsh",
    prefix: "tk",
    space: "widget",
    filing: {
      filed: [{ check: "names.deny", card: "Bug K7M2", folder: "widget/backlog" }],
      skipped: [{ check: "paths.machine", card: "Task H3RE", date: "2026-10-30" }],
    },
  },
};

describe.each([
  ["bare", "public", { git: true, enhancements: FOUND }],
  ["bare", "public", { git: true, all: true }],
  ["bare", "quality", { git: true }],
  ["kept", "public", { git: false, enhancements: NO_TOOLKIT }],
  // Every hygiene check, tripped at once, with a deny list and a commit message that names its word.
  [
    "messy",
    "public",
    {
      git: true,
      denyList: ["# Names that stay private", "Globex"],
      commits: [{ message: "Ship the Globex build", files: { "CHANGELOG.md": "# Changelog\n" } }],
      enhancements: FILED,
    },
  ],
] as const)("the case for %s under %s", (fixture, goal, options) => {
  const name = `${fixture}-${goal}${"all" in options ? "-all" : ""}`;

  it("matches its golden files", () => {
    const { files } = run(fixture, goal, { ...options, now: fixed });
    const golden = join(GOLDEN, name);
    if (UPDATE) {
      rmSync(golden, { recursive: true, force: true });
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(golden, path, ".."), { recursive: true });
        writeFileSync(join(golden, path), text);
      }
    }
    expect(existsSync(golden), `no golden files for ${name}: run with UPDATE_GOLDEN=1`).toBe(true);
    expect(files).toEqual(readCase(golden));
  });

  it("is written as UTF-8 with LF endings and no byte-order mark", () => {
    const { files } = run(fixture, goal, options);
    for (const text of Object.values(files)) {
      expect(text.includes("\r")).toBe(false);
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
    }
  });
});

describe("determinism", () => {
  /** Two real runs, with the real clock, compared once the times and the case id are taken out. */
  it.each([
    ["bare", true],
    ["kept", false],
  ])("gives the same case file twice for %s", (fixture, git) => {
    const normalise = (files: Record<string, string>) => {
      const record = JSON.parse(files["case.json"]!) as Record<string, unknown>;
      const id = record.case as string;
      delete record.openedAt;
      delete record.closedAt;
      delete record.case;
      const rest = Object.fromEntries(
        Object.entries(files)
          .filter(([path]) => path !== "case.json")
          .map(([path, text]) => [path, text.split(id).join("<case>")]),
      );
      return { record, ...rest };
    };

    const [first, second] = withScratch((out) =>
      investigate(
        `whole/${fixture}`,
        (repo, capabilities) =>
          [1, 2].map(() => {
            const { path } = takeCase({
              repo,
              goal: findGoal("public")!,
              capabilities,
              casesFolder: out,
              chosen: true,
            });
            return readCase(path);
          }),
        { git },
      ),
    );
    expect(JSON.parse(first!["case.json"]!).case).not.toBe(JSON.parse(second!["case.json"]!).case);
    expect(normalise(second!)).toEqual(normalise(first!));
  });
});

describe("taking a case", () => {
  it("refuses before writing anything when --out is inside the repository", () => {
    investigate("whole/bare", (repo, capabilities) => {
      expect(() =>
        takeCase({
          repo,
          goal: findGoal("public")!,
          capabilities,
          casesFolder: join(repo.root, "cases"),
          chosen: true,
        }),
      ).toThrow(/inside the repository/);
    });
  });

  it("never writes into the repository it investigates", () => {
    // investigate() holds the tree and git status byte-identical around the run.
    const { path } = run("bare", "public", { git: true });
    expect(path).not.toContain("whole/bare");
  });
});
