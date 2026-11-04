import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy as cliCopy } from "../../src/cli/copy.js";
import { prepareToolkit } from "../../src/cli/toolkit.js";
import { cards as cardCopy } from "../../src/engine/copy.js";
import { confirmsSpace, detectToolkit } from "../../src/toolkit/detect.js";
import { fileCard, readCreated, UNKNOWN_CARD } from "../../src/toolkit/file.js";
import { findShell } from "../../src/toolkit/shell.js";
import { type Captured, isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { type Scenario, stubToolkit } from "../helpers/toolkit.js";

type Shells = ("pwsh" | "powershell.exe")[];

/** The CLI over a copy of `bare`, with stub shells on the PATH and a scratch cases folder. */
async function onBare(
  extra: string[],
  setup: {
    shells?: Shells;
    scenario?: Scenario;
    ask?: (q: string) => Promise<string>;
    runs?: string[][];
    /** The copy's `origin` remote. */
    origin?: string;
  } = {},
) {
  return withScratch(async (scratch) => {
    const stub = stubToolkit(scratch, setup.shells ?? ["pwsh"], setup.scenario ?? {});
    const out = join(scratch, "cases");
    const runs: Captured[] = [];
    await investigateAsync(
      "whole/bare",
      async (root) => {
        for (const argv of [...(setup.runs ?? []), extra]) {
          runs.push(
            await sleuth([root, "--goal", "public", "--out", out, ...argv], {
              casesFolder: join(scratch, "default"),
              env: stub.env,
              ...(setup.ask ? { ask: setup.ask, terminal: { stdin: true, stdout: true, stderr: true } } : {}),
            }),
          );
        }
      },
      {
        git: true,
        ...(setup.origin === undefined
          ? {}
          : {
              prepare: (root: string) => {
                spawnSync("git", ["remote", "add", "origin", setup.origin!], { cwd: root });
              },
            }),
      },
    );
    const repoFolder = readdirSync(out).find((name) => name.startsWith("bare-"))!;
    const ledgerFile = join(out, repoFolder, "filed.json");
    const ledger = (() => {
      try {
        return (JSON.parse(readFileSync(ledgerFile, "utf8")) as { filed: { check: string; card: string }[] })
          .filed;
      } catch {
        return [];
      }
    })();
    const latest = readdirSync(join(out, repoFolder))
      .filter((n) => n.startsWith("20"))
      .sort()
      .at(-1)!;
    const caseJson = JSON.parse(readFileSync(join(out, repoFolder, latest, "case.json"), "utf8")) as {
      enhancements: { toolkit: Record<string, unknown> & { filing?: Record<string, unknown> } };
    };
    const caseMd = readFileSync(join(out, repoFolder, latest, "case.md"), "utf8");
    return { runs, last: runs.at(-1)!, calls: stub.calls(), ledger, caseJson, caseMd };
  });
}

const filings = <T extends { argv: string[] }>(calls: T[]) => calls.filter((c) => !c.argv.includes("-Probe"));
const titleOf = (argv: string[]) => argv[argv.indexOf("-Title") + 1];
const LICENSE = cardCopy["license.file"].title;
const README = cardCopy["docs.readme"].title;

describe("detection", () => {
  it("asks pwsh first, then powershell.exe, and finds nothing with neither", () => {
    withScratch((scratch) => {
      expect(findShell(stubToolkit(join(scratch, "a"), ["pwsh", "powershell.exe"]).env)?.name).toBe("pwsh");
      expect(findShell(stubToolkit(join(scratch, "b"), ["powershell.exe"]).env)?.name).toBe("powershell.exe");
      expect(findShell({ PATH: join(scratch, "nowhere") })).toBeUndefined();
    });
  });

  it("reads the probe's prefix, Space and Spaces through any noise, with Windows PowerShell 5.1 alone", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["powershell.exe"]);
      expect(detectToolkit({ env: stub.env })).toMatchObject({
        state: "detected",
        via: "cli",
        shell: { name: "powershell.exe" },
        prefix: "tk",
        space: "widget",
        spaces: ["widget", "other"],
      });
    });
  });

  it("is not installed when NewPrompt does not resolve", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"], { probe: "absent" });
      expect(detectToolkit({ env: stub.env }).state).toBe("not-installed");
    });
  });

  it("confirms a Space only when ToolKit reports it active and declares it", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"]);
      expect(confirmsSpace(detectToolkit({ env: stub.env, space: "other" }), "other")).toBe(true);
      // An undeclared slug falls back to another Space in ToolKit, so it is not confirmed.
      expect(confirmsSpace(detectToolkit({ env: stub.env, space: "nope" }), "nope")).toBe(false);
      expect(stub.calls().map((c) => c.space)).toEqual(["other", "nope"]);
    });
  });
});

describe("the call", () => {
  it("passes every value as its own argument: a hostile title and body arrive intact", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"]);
      const detection = detectToolkit({ env: stub.env });
      if (detection.state !== "detected") throw new Error("expected a stub ToolKit");
      const title = `Fix "it"; rm -rf / & echo $(whoami) \`id\`\nsecond line`;
      const body = "A body with 'quotes', $env:PATH, @(splat) and\nmore lines";
      const result = fileCard(detection, { title, type: "Bug", body }, { env: stub.env });
      expect(result.status).toBe("filed");
      const [call] = filings(stub.calls());
      expect(call!.argv.slice(call!.argv.indexOf("-Prefix"))).toEqual([
        "-Prefix",
        "tk",
        "-Title",
        title,
        "-Type",
        "Bug",
        "-Description",
        body,
      ]);
      expect(call!.argv).toContain("-NoProfile");
      expect(call!.argv).not.toContain("-Now");
      expect(call!.argv).not.toContain("-Force");
    });
  });

  it("reads the card's id and folder from the first success line and its path from the Prompt: line", () => {
    const esc = String.fromCharCode(27);
    expect(
      readCreated(
        `\n${esc}[32m[+] Created Task7-x.prompt.md in widget/backlog/ -- Task K7M2, offline.${esc}[0m\n    Prompt: file:////hub/widget/backlog/Task7-x.prompt.md\n`,
      ),
    ).toEqual({ card: "Task K7M2", folder: "widget/backlog", path: "/hub/widget/backlog/Task7-x.prompt.md" });
    expect(
      readCreated(
        "[+] Created B-x.md in w/current/ -- Bug 9X2A, offline.\r\n    Prompt: file:///C:/hub/w/current/B-x.md\r\n",
      ),
    ).toEqual({
      card: "Bug 9X2A",
      folder: "w/current",
      path: "C:/hub/w/current/B-x.md",
    });
    expect(readCreated("Done, probably.")).toEqual({ card: UNKNOWN_CARD });
  });
});

describe("--toolkit", () => {
  it("files every card with --yes, in the case's order, and records each on the ledger and in the case", async () => {
    const { last, calls, ledger, caseJson, caseMd } = await onBare(["--toolkit", "--yes"]);
    expect(last.code).toBe(0);
    const titles = filings(calls).map((c) => titleOf(c.argv));
    expect(titles[0]).toBe(LICENSE);
    expect(titles).toContain(README);
    expect(ledger.map((e) => e.card)).toEqual(
      titles.map((_, i) => `${i === 0 ? "Bug" : "Task"} K7M${i + 1}`),
    );
    expect(last.stdout).toMatch(/^ {2}Filed {4}license\.file as Bug K7M1, in widget\/backlog\/$/m);
    expect(caseJson.enhancements.toolkit).toMatchObject({
      state: "detected",
      via: "cli",
      shell: "pwsh",
      prefix: "tk",
      space: "widget",
    });
    expect((caseJson.enhancements.toolkit.filing as { filed: unknown[] }).filed).toHaveLength(titles.length);
    expect(caseMd.trimEnd().split("\n").at(-1)).toMatch(
      /^ToolKit: found \(tk, Space 'widget', the active one: no Space matches this repository\); filed \d+ cards in the Space 'widget' \(Bug K7M1, /,
    );
  });

  it("asks once, naming the count and the Space, and files only on yes", async () => {
    const asked: string[] = [];
    const no = await onBare(["--toolkit"], { ask: async (q) => (asked.push(q), "n") });
    expect(filings(no.calls)).toEqual([]);
    expect(no.caseMd).toContain("nothing filed: you said no");
    expect(asked).toEqual([
      expect.stringMatching(/^File \d+ cards in ToolKit, in the Space 'widget'\? \[y\/N\] $/),
    ]);

    const yes = await onBare(["--toolkit"], { ask: async () => "y" });
    expect(filings(yes.calls).length).toBeGreaterThan(0);
  });

  it("does not file without a terminal and without --yes, and says how", async () => {
    const { last, calls } = await onBare(["--toolkit"]);
    expect(last.code).toBe(0);
    expect(filings(calls)).toEqual([]);
    expect(last.stdout).toContain("add --yes to file without asking.");
  });

  it("files a check once: a later run skips it, and --refile files it again", async () => {
    const { runs, calls, ledger } = await onBare(["--toolkit", "--yes", "--refile"], {
      runs: [
        ["--toolkit", "--yes"],
        ["--toolkit", "--yes"],
      ],
    });
    const [first, second, third] = runs;
    expect(first!.stdout).toContain("  Filed    license.file as Bug K7M1");
    expect(second!.stdout).toMatch(
      /^ {2}Skipped {2}license\.file: already filed as Bug K7M1 on \d{4}-\d{2}-\d{2}; --refile to file it again$/m,
    );
    expect(second!.stdout).toMatch(/^ToolKit {4}found .*every card is already filed\.$/m);
    expect(third!.stdout).toContain("  Filed    license.file as Bug K7M");
    // The first and the third run filed every card; the second filed none.
    const perRun = filings(calls).length / 2;
    expect(
      filings(calls)
        .map((c) => titleOf(c.argv))
        .slice(0, perRun),
    ).toEqual(
      filings(calls)
        .map((c) => titleOf(c.argv))
        .slice(perRun),
    );
    // One check, one entry: --refile replaced the first.
    expect(new Set(ledger.map((e) => e.check)).size).toBe(ledger.length);
    expect(ledger.find((e) => e.check === "license.file")!.card).not.toBe("Bug K7M1");
  });

  it("stops at ToolKit's first refusal, keeps what was filed, and says it once, as exit 2", async () => {
    const { last, calls, ledger, caseJson } = await onBare(["--toolkit", "--yes"], {
      scenario: { refuse: [README] },
    });
    expect(filings(calls).map((c) => titleOf(c.argv))).toEqual([LICENSE, README]);
    expect(ledger.map((e) => e.check)).toEqual(["license.file"]);
    expect(last.code).toBe(2);
    expect(last.stderr).toBe(
      "Error: ToolKit refused the card for docs.readme: A card with that title is already in play.\n" +
        "Hint: The cards before it are filed and on the ledger, and the rest were not. Fix what ToolKit says, then run with --toolkit again.\n",
    );
    expect(caseJson.enhancements.toolkit.filing!.stopped).toEqual({
      check: "docs.readme",
      sentence: "A card with that title is already in play.",
    });
  });

  it("names a failure that said nothing, and where to look", async () => {
    const { last } = await onBare(["--toolkit", "--yes"], { scenario: { fail: [LICENSE] } });
    expect(last.code).toBe(2);
    expect(last.stderr).toMatch(
      /^Error: ToolKit failed on the card for license\.file: exit code 1\nHint: .*tkLog -Errors/,
    );
  });

  it("records a card whose success line it cannot read as filed, with its id unknown", async () => {
    const { ledger } = await onBare(["--toolkit", "--yes"], { scenario: { garble: [LICENSE] } });
    expect(ledger[0]).toMatchObject({ check: "license.file", card: UNKNOWN_CARD });
  });

  it("files in the Space --toolkit-space names, through P20_ACTIVE_SPACE in the child only", async () => {
    const { calls, caseJson } = await onBare(["--toolkit", "--yes", "--toolkit-space", "other"]);
    expect(calls.every((c) => c.space === "other")).toBe(true);
    expect(caseJson.enhancements.toolkit.space).toBe("other");
  });
});

describe("the refusals", () => {
  const refusal = (extra: string[], shells: Shells, scenario: Scenario = {}) =>
    withScratch(async (scratch) => {
      const stub = stubToolkit(scratch, shells, scenario);
      return investigateAsync("whole/bare", async (root) => {
        const result = await sleuth([root, "--goal", "public", "--out", join(scratch, "cases"), ...extra], {
          casesFolder: join(scratch, "default"),
          env: stub.env,
        });
        return { result, filed: filings(stub.calls()).length };
      });
    });

  it.each([
    [["--toolkit", "--yes", "--toolkit-space", "nope"], ["pwsh"], {}, "doesn't confirm the Space 'nope'"],
    [
      ["--toolkit", "--yes", "--toolkit-space", "widget"],
      ["pwsh"],
      { probe: "no-config" },
      "doesn't confirm the Space 'widget'",
    ],
    [["--toolkit"], [], {}, "ToolKit isn't here"],
    [["--toolkit"], ["pwsh"], { probe: "absent" }, "ToolKit isn't here"],
    [["--yes"], ["pwsh"], {}, "--yes only goes with --toolkit"],
    [["--refile"], ["pwsh"], {}, "--refile only goes with --toolkit"],
  ] as const)("refuses %j before taking the case", async (extra, shells, scenario, words) => {
    const { result, filed } = await refusal([...extra], [...shells], scenario as Scenario);
    expect(isRefusal(result)).toBe(true);
    expect(result.stderr).toContain(words);
    expect(filed).toBe(0);
  });
});

describe("without --toolkit", () => {
  it("ends with the command that would file the cards, when ToolKit is there", async () => {
    const { last, calls, caseMd } = await onBare([]);
    expect(filings(calls)).toEqual([]);
    expect(last.stdout.trimEnd().split("\n").at(-1)).toBe(
      "ToolKit    found (tk, Space 'widget', the active one: no Space matches this repository). To file these cards: `code-sleuth --goal public --toolkit`",
    );
    expect(caseMd.trimEnd().split("\n").at(-1)).toBe(
      "ToolKit: found (tk, Space 'widget', the active one: no Space matches this repository). To file these cards: `code-sleuth --goal public --toolkit`",
    );
  });

  it("ends with exactly one upsell line, in the terminal and the case, when ToolKit is not there", async () => {
    const { last, caseMd } = await onBare([], { shells: [] });
    for (const text of [last.stdout, caseMd]) {
      expect(text.match(/That's what ToolKit is for/g)).toHaveLength(1);
      expect(text.trimEnd().split("\n").at(-1)).toMatch(
        /^Want these as real cards, .* That's what ToolKit is for: https:\/\//,
      );
    }
  });
});

/** The footer's ToolKit lines: there is one on every path. */
const toolkitLines = (stdout: string) => stdout.split("\n").filter((line) => line.startsWith("ToolKit "));

describe("the footer's one ToolKit line", () => {
  it("with --toolkit and no terminal to ask in: one line, naming the Space, why nothing was filed, and how", async () => {
    const { last, calls } = await onBare(["--toolkit"]);
    expect(filings(calls)).toEqual([]);
    expect(toolkitLines(last.stdout)).toEqual([
      "ToolKit    found (tk, Space 'widget', the active one: no Space matches this repository); nothing filed: there's no terminal to ask in, so add --yes to file without asking.",
    ]);
  });

  it("on the interactive path, answered no: one line", async () => {
    const { last } = await onBare(["--toolkit"], { ask: async () => "n" });
    expect(toolkitLines(last.stdout)).toEqual([
      "ToolKit    found (tk, Space 'widget', the active one: no Space matches this repository); nothing filed: you said no.",
    ]);
  });

  it("with --yes: one line, naming what was filed", async () => {
    const { last } = await onBare(["--toolkit", "--yes"]);
    const lines = toolkitLines(last.stdout);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^ToolKit {4}found \(tk, Space 'widget', the active one: no Space matches this repository\); filed \d+ cards in the Space 'widget' \(Bug K7M1(, Task K7M\d+)+\)\.$/,
    );
  });

  it("with nothing left to file: one line", async () => {
    const { last } = await onBare(["--toolkit", "--yes"], { runs: [["--toolkit", "--yes"]] });
    const lines = toolkitLines(last.stdout);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^ToolKit {4}found \(tk, Space 'widget', the active one: no Space matches this repository\); \d+ were already filed; nothing filed: every card is already filed\.$/,
    );
  });
});

describe("the Space --toolkit files in", () => {
  const A = "the active one: no Space matches this repository";
  // ToolKit's active Space is widget; this repository's own may be another.
  const scenario: Scenario = {
    probe: {
      prefix: "tk",
      space: "widget",
      spaces: ["widget", "other"],
      addresses: [
        { slug: "widget", org: "https://github.com/owner/widget", repos: [] },
        { slug: "other", org: "https://github.com/owner/other", repos: [] },
      ],
    },
  };
  const spacesFiledIn = (calls: { argv: string[]; space: string | null }[]) => [
    ...new Set(filings(calls).map((c) => c.space)),
  ];

  it("is the repository's own when a Space's address is its origin, though another Space is active", async () => {
    const { last, calls, caseJson } = await onBare(["--toolkit", "--yes"], {
      scenario,
      origin: "git@github.com:Owner/Other.git",
    });
    expect(spacesFiledIn(calls)).toEqual(["other"]);
    expect(caseJson.enhancements.toolkit).toMatchObject({ space: "other", spaceFrom: "origin" });
    expect(toolkitLines(last.stdout)[0]).toMatch(
      /^ToolKit {4}found \(tk, Space 'other', this repository's own\); filed \d+ cards in the Space 'other' /,
    );
  });

  it("is the repository's own when that is also the active Space", async () => {
    const { calls, caseJson } = await onBare(["--toolkit", "--yes"], {
      scenario,
      origin: "https://github.com/owner/widget",
    });
    expect(spacesFiledIn(calls)).toEqual(["widget"]);
    expect(caseJson.enhancements.toolkit).toMatchObject({ space: "widget", spaceFrom: "origin" });
  });

  it("falls back to the active Space when no Space's address is the origin, and says so", async () => {
    const { last, calls, caseJson } = await onBare(["--toolkit", "--yes"], {
      scenario,
      origin: "https://github.com/owner/nothing-like-it.git",
    });
    expect(spacesFiledIn(calls)).toEqual([null]);
    expect(caseJson.enhancements.toolkit).toMatchObject({ space: "widget", spaceFrom: "active" });
    expect(toolkitLines(last.stdout)[0]).toContain(`found (tk, Space 'widget', ${A}); filed `);
  });

  it("is --toolkit-space when given, whatever the origin says", async () => {
    const { last, calls, caseJson } = await onBare(["--toolkit", "--yes", "--toolkit-space", "widget"], {
      scenario,
      origin: "https://github.com/owner/other",
    });
    expect(spacesFiledIn(calls)).toEqual(["widget"]);
    expect(caseJson.enhancements.toolkit).toMatchObject({ space: "widget", spaceFrom: "flag" });
    expect(toolkitLines(last.stdout)[0]).toMatch(/^ToolKit {4}found \(tk, Space 'widget'\); filed /);
  });

  it("names the repository's own Space in the command a case ends with", async () => {
    const { last } = await onBare([], { scenario, origin: "https://github.com/owner/other" });
    expect(last.stdout.trimEnd().split("\n").at(-1)).toBe(
      "ToolKit    found (tk, Space 'other', this repository's own). To file these cards: `code-sleuth --goal public --toolkit`",
    );
  });
});

describe("--toolkit with the hub inside the repository", () => {
  const flags = { toolkit: true, yes: true, refile: false };

  it.skipIf(process.platform === "win32").each([
    ["is the repository", (repo: string) => repo],
    ["is inside the repository", (repo: string) => join(repo, "hub")],
  ])("refuses when the hub %s, so a card would land in it, before anything is filed", (_name, hubOf) =>
    withScratch((scratch) => {
      const repo = join(scratch, "repo");
      mkdirSync(join(repo, "hub"), { recursive: true });
      const stub = stubToolkit(scratch, ["pwsh"], { root: hubOf(repo) });
      expect(() =>
        prepareToolkit(flags, { env: stub.env, stdout: () => {}, stderr: () => {} }, null, repo),
      ).toThrow(expect.objectContaining({ message: cliCopy.toolkit.hubInsideRepo }));
      expect(stub.calls().filter((call) => call.argv.includes("-Title"))).toEqual([]);
    }),
  );

  it.skipIf(process.platform === "win32")(
    "files as usual when the hub holds the repository and cards land in a folder beside it, as ToolKit's default hub does",
    () =>
      withScratch((scratch) => {
        const repo = join(scratch, "repo");
        mkdirSync(repo);
        const stub = stubToolkit(scratch, ["pwsh"], { root: scratch });
        expect(
          prepareToolkit(flags, { env: stub.env, stdout: () => {}, stderr: () => {} }, null, repo).detection
            .state,
        ).toBe("detected");
      }),
  );

  it.skipIf(process.platform === "win32")("files as usual when the hub is elsewhere", () =>
    withScratch((scratch) => {
      const repo = join(scratch, "repo");
      mkdirSync(repo);
      const stub = stubToolkit(scratch, ["pwsh"], { root: join(scratch, "hub") });
      expect(
        prepareToolkit(flags, { env: stub.env, stdout: () => {}, stderr: () => {} }, null, repo).detection
          .state,
      ).toBe("detected");
    }),
  );

  it.skipIf(process.platform === "win32")(
    "refuses when ToolKit does not say where the cards would land",
    () =>
      withScratch((scratch) => {
        const repo = join(scratch, "repo");
        mkdirSync(repo);
        const stub = stubToolkit(scratch, ["pwsh"], { probe: "no-config" });
        expect(() =>
          prepareToolkit(flags, { env: stub.env, stdout: () => {}, stderr: () => {} }, null, repo),
        ).toThrow(expect.objectContaining({ message: cliCopy.toolkit.foldersUnknown }));
        expect(stub.calls().filter((call) => call.argv.includes("-Title"))).toEqual([]);
      }),
  );
});
