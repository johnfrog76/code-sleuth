import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultCasesFolder } from "../../src/case/folder.js";
import { type Captured, isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// Built from the character's code, so no regex here holds a control character.
const ESC = String.fromCharCode(27);
const ESCAPE = new RegExp(`${ESC}\\[`);
const STYLES = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

/** The CLI over a copy of a fixture, with a scratch cases folder. Read-only is held around the whole run. */
function onFixture(
  fixture: string,
  argv: (root: string, out: string) => string[],
  io: {
    terminal?: { stdin: boolean; stdout: boolean; stderr: boolean };
    ask?: (q: string) => Promise<string>;
    env?: NodeJS.ProcessEnv;
  } = {},
  options: { git?: boolean; prepare?: (root: string) => void } = {},
): Promise<Captured & { out: string }> {
  return withScratch((out) =>
    investigateAsync(
      `whole/${fixture}`,
      async (root) => ({
        ...(await sleuth(argv(root, out), { ...io, casesFolder: join(out, "default") })),
        out,
      }),
      options,
    ),
  );
}

describe("investigating", () => {
  it("prints the opening, the stakeout, the verdict, the checklist and where the case went", async () => {
    const { code, stdout, stderr } = await onFixture(
      "bare",
      (root, out) => [root, "--goal", "public", "--out", out],
      {},
      { git: true },
    );
    expect(code).toBe(0);
    expect(stderr).toBe("");
    const lines = stdout.split("\n");
    expect(lines[0]).toMatch(/^Code Sleuth -- case \d{4}-\d{2}-\d{2}-public-1$/);
    expect(lines[2]).toBe("So, you want to know what's going on with your repo?");
    expect(stdout).toMatch(/^ {2}Repo {2}bare \(main @ [0-9a-f]{7}, clean\)$/m);
    expect(stdout).toContain("  Goal  public facing\n");
    expect(stdout).toContain(`Taking my time. 24 leads to run down ${".".repeat(24)} done.\n`);
    expect(stdout).toContain("NOT READY  By my checklist: not ready to be public facing. One smoking gun,");
    expect(stdout).toMatch(/^Smoking guns\n {2}\[ \] license\.file {3,}No license/m);
    expect(stdout).toMatch(/^Clean\n {2}\[x\] \S+ +.+ {2}\.\.\. and \d+ more$/m);
    expect(stdout).toMatch(/^Case file {2}.*case\.md$/m);
    expect(stdout).toMatch(/^Cards {6}\d+ in cards\/ \(hunches get cards with --all\)$/m);
  });

  it("writes the case file to the cases folder, never into the repository", async () => {
    const { code, out } = await onFixture("bare", (root, out) => [root, "--goal", "public", "--out", out]);
    expect(code).toBe(0);
    expect(out).not.toBe("");
    // investigateAsync has already held the repository byte-identical.
  });

  it("asks the goal in a terminal, and takes Enter for the first choice", async () => {
    let asked = "";
    const { code, stdout } = await onFixture("kept", (root, out) => [root, "--out", out], {
      terminal: { stdin: true, stdout: true, stderr: true },
      env: { NO_COLOR: "1" },
      ask: async (question) => {
        asked = question;
        return "";
      },
    });
    expect(code).toBe(0);
    expect(asked).toBe("Pick a number [1]: ");
    expect(
      stdout.startsWith(
        "So, you want to know what's going on with your repo?\n\nWhich do you want to know?\n  1. Is it ready to be public facing?\n",
      ),
    ).toBe(true);
    expect(stdout.match(/So, you want to know/g)).toHaveLength(1);
    expect(stdout).toContain("READY  By my checklist: ready to be public facing.");
    expect(stdout).toContain(
      "Nothing on my checklist stands in the way. Every case is different: the call is yours.",
    );
  });

  it("refuses an answer that is not a choice", async () => {
    const result = await onFixture("kept", (root, out) => [root, "--out", out], {
      terminal: { stdin: true, stdout: true, stderr: true },
      ask: async () => "7",
    });
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^Error: 7 isn't one of the choices\.\nHint: /);
  });

  it("colours only a terminal without NO_COLOR, and every line still carries its word", async () => {
    const terminal = { stdin: false, stdout: true, stderr: true };
    const coloured = await onFixture("bare", (root, out) => [root, "--goal", "public", "--out", out], {
      terminal,
      env: {},
    });
    expect(coloured.stdout).toMatch(ESCAPE);
    expect(coloured.stdout.replace(STYLES, "")).toContain("Smoking guns\n");

    const plain = await onFixture("bare", (root, out) => [root, "--goal", "public", "--out", out], {
      terminal,
      env: { NO_COLOR: "1" },
    });
    expect(plain.stdout).not.toMatch(ESCAPE);
    const piped = await onFixture("bare", (root, out) => [root, "--goal", "public", "--out", out], {
      env: {},
    });
    expect(piped.stdout).not.toMatch(ESCAPE);
  });
});

describe("--json", () => {
  it("prints case.json to stdout, equal to the file written, and the rest to stderr", async () => {
    await withScratch((out) =>
      investigateAsync(
        "whole/messy",
        async (root) => {
          const { code, stdout, stderr } = await sleuth([root, "--goal", "public", "--out", out, "--json"], {
            casesFolder: join(out, "default"),
          });
          expect(code).toBe(0);
          const record = JSON.parse(stdout) as { case: string };
          expect(stderr).toContain(`Code Sleuth -- case ${record.case}`);
          const [repoFolder] = readdirSync(out).filter((name) => name.startsWith("messy-"));
          expect(stdout).toBe(readFileSync(join(out, repoFolder!, record.case, "case.json"), "utf8"));
        },
        { git: true },
      ),
    );
  });
});

describe("--fail-on", () => {
  // kept, less one community file: loose ends only.
  const withoutContributing = (root: string) => rmSync(join(root, "CONTRIBUTING.md"));

  it.each([
    ["a smoking gun, failing on smoking-gun", "bare", "smoking-gun", 1, undefined],
    ["a smoking gun, failing on loose-end", "bare", "loose-end", 1, undefined],
    ["loose ends only, failing on smoking-gun", "kept", "smoking-gun", 0, withoutContributing],
    ["loose ends only, failing on loose-end", "kept", "loose-end", 1, withoutContributing],
    ["a clean case, failing on loose-end", "kept", "loose-end", 0, undefined],
  ])("exits right for %s", async (_, fixture, weight, expected, prepare) => {
    const { code } = await onFixture(
      fixture,
      (root, out) => [root, "--goal", "public", "--out", out, "--fail-on", weight],
      {},
      prepare ? { prepare } : {},
    );
    expect(code).toBe(expected);
  });

  it("refuses a weight it does not know", async () => {
    expect(
      isRefusal(
        await onFixture("kept", (root, out) => [
          root,
          "--goal",
          "public",
          "--out",
          out,
          "--fail-on",
          "hunch",
        ]),
      ),
    ).toBe(true);
  });
});

describe("--deny", () => {
  it("reads a list beside the repository", async () => {
    const { code, stdout } = await withScratch((outside) => {
      writeFileSync(join(outside, "deny.txt"), "Globex\n");
      return onFixture(
        "messy",
        (root, out) => [root, "--goal", "public", "--out", out, "--deny", join(outside, "deny.txt")],
        {},
        { git: true },
      );
    });
    expect(code).toBe(0);
    expect(stdout).toMatch(/\[ \] names\.deny/);
    expect(stdout.toLowerCase()).not.toContain("globex");
  });

  it("refuses a list inside the repository, and one reached through a link into it", async () => {
    for (const where of ["inside", "link"]) {
      const result = await withScratch((outside) =>
        onFixture("kept", (root, out) => {
          if (where === "link") symlinkSync(root, join(outside, "into-repo"), "dir");
          return [
            root,
            "--goal",
            "public",
            "--out",
            out,
            "--deny",
            where === "inside" ? join(root, "README.md") : join(outside, "into-repo", "README.md"),
          ];
        }),
      );
      expect(isRefusal(result)).toBe(true);
      expect(result.stderr).toContain("Keep the deny list outside the repository");
    }
  });

  it("refuses a list it cannot read", async () => {
    const result = await onFixture("kept", (root, out) => [
      root,
      "--goal",
      "public",
      "--out",
      out,
      "--deny",
      join(out, "missing.txt"),
    ]);
    expect(isRefusal(result)).toBe(true);
    expect(result.stderr).toContain("deny list");
  });
});

describe("every refusal", () => {
  const refusal = async (argv: (root: string, out: string) => string[], io = {}) => {
    const result = await onFixture("kept", argv, io);
    expect(isRefusal(result), `${result.code}\n${result.stdout}${result.stderr}`).toBe(true);
    return result.stderr;
  };

  it("refuses a path that does not exist", async () => {
    expect(await refusal((root, out) => [join(root, "nowhere"), "--goal", "public", "--out", out])).toContain(
      "can't find",
    );
  });

  it("refuses a file in place of a folder", async () => {
    expect(
      await refusal((root, out) => [join(root, "README.md"), "--goal", "public", "--out", out]),
    ).toContain("not a folder");
  });

  it("refuses a folder it cannot read", async () => {
    const stderr = await withScratch(async (locked) => {
      mkdirSync(join(locked, "sealed"));
      chmodSync(join(locked, "sealed"), 0o000);
      try {
        return await refusal((_, out) => [join(locked, "sealed"), "--goal", "public", "--out", out]);
      } finally {
        chmodSync(join(locked, "sealed"), 0o700);
      }
    });
    expect(stderr).toContain("can't read");
  });

  it.each(["https://github.com/owner/widget", "git@github.com:owner/widget.git"])(
    "refuses the URL %s",
    async (url) => {
      expect(await refusal((_, out) => [url, "--goal", "public", "--out", out])).toContain("git clone");
    },
  );

  it("refuses an unknown goal, and a goal not ready to investigate", async () => {
    expect(await refusal((root, out) => [root, "--goal", "nope", "--out", out])).toContain(
      "don't know the goal nope",
    );
    expect(await refusal((root, out) => [root, "--goal", "security", "--out", out])).toContain(
      "planned for a later release",
    );
  });

  it("refuses to guess the goal with no terminal to ask in", async () => {
    expect(await refusal((root, out) => [root, "--out", out])).toContain("--goal public");
  });

  it("refuses an --out inside the repository", async () => {
    expect(await refusal((root) => [root, "--goal", "public", "--out", join(root, "cases")])).toContain(
      "inside the repository",
    );
  });

  it("refuses a repository that holds the cases folder, as code-sleuth ~ would", async () => {
    const stderr = await withScratch(async (home) => {
      const result = await sleuth([home, "--goal", "public"], {
        casesFolder: defaultCasesFolder("darwin", {}, home),
      });
      expect(isRefusal(result)).toBe(true);
      return result.stderr;
    });
    expect(stderr).toContain("holds my cases folder");
  });
});
