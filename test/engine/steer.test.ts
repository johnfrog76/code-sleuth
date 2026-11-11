import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultCasesFolder, defaultKeyFile } from "../../src/case/folder.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { refusedReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { GIT_HISTORY_TIMEOUT_MS, GIT_TIMEOUT_MS, gitEnv, leadsOutside } from "../../src/engine/repo.js";
import { OWN_FOLDER } from "../../src/spawn.js";
import { sleuth } from "../helpers/cli.js";
import { investigate, investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { stubToolkit } from "../helpers/toolkit.js";

// ETU3 card 3: what a repository can make Code Sleuth read or do. A repository handed over whole (a folder, an
// archive) carries its own index and git settings, and a person's own environment can be odd. Neither steers a
// read: what Code Sleuth reads, and where its children start, come from it and from the person, never from a
// string the repository supplies.

describe("a path the index lists", () => {
  it.each([
    ["../outside", true],
    ["a/../../b", true],
    ["/etc/passwd", true],
    ["a//b", true],
    ["./a", true],
    ["a/.", true],
    ["", true],
    ["a\0b", true],
    ["src/app.ts", false],
    ["..cases/x", false],
    ["a/..b/c", false],
  ])("%j leads outside: %s", (path, outside) => {
    expect(leadsOutside(path, "linux")).toBe(outside);
  });

  it.each(["a\\..\\b", "C:/x", "a:b"])("%j leads outside on Windows", (path) => {
    expect(leadsOutside(path, "win32")).toBe(true);
  });

  it("makes a check that would read clean read not investigated, naming it", () => {
    const check = CHECKS.find((c) => c.id === "docs.changelog")!;
    const result = investigate(
      { name: "widget", files: { "CHANGELOG.md": "# Changes\n" } },
      (repo, capabilities) => {
        const clean = runCheck(check, repo, capabilities, secretHasher(Buffer.alloc(32)));
        const refused = runCheck(
          check,
          { ...repo, refused: ["../.ssh/id_rsa", "../../x"] },
          capabilities,
          secretHasher(Buffer.alloc(32)),
        );
        return { clean, refused };
      },
    );
    expect(result.clean.verdict).toBe("clean");
    expect(result.refused).toEqual({
      verdict: "not-investigated",
      reason: refusedReasons.leadsOutside("../.ssh/id_rsa", 1),
    });
  });

  it("refuses none in a plain repository", () => {
    const refused = investigate(
      { name: "widget", files: { "a.txt": "a\n", "..cases/b.txt": "b\n" } },
      (repo) => repo.refused,
      { git: true },
    );
    expect(refused).toEqual([]);
  });
});

describe("git's history, as its commits hold it", () => {
  it("takes no replacement object and no graft", () => {
    const env = gitEnv();
    expect(env.GIT_NO_REPLACE_OBJECTS).toBe("1");
    expect(env.GIT_GRAFT_FILE).toBeDefined();
  });

  it("reads each added line's path whatever diff prefix the repository's config sets", () => {
    const paths = investigate(
      { name: "widget", files: { "src/a.ts": "one\n" } },
      (repo) => [...new Set(repo.addedLines()!.map((line) => line.path))],
      {
        git: true,
        prepare: (root) =>
          writeFileSync(
            join(root, ".git", "config"),
            "[diff]\n\tsrcPrefix = q/\n\tdstPrefix = z/\n\tnoprefix = true\n",
            { flag: "a" },
          ),
      },
    );
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("stops a git call that would never end: a minute, or ten to read the whole history", () => {
    expect(GIT_TIMEOUT_MS).toBe(60_000);
    expect(GIT_HISTORY_TIMEOUT_MS).toBe(600_000);
  });
});

describe("Code Sleuth's own folder", () => {
  it("is not taken from a relative or empty setting", () => {
    expect(defaultKeyFile("linux", { XDG_DATA_HOME: "." }, "/h")).toBe(
      join("/h", ".local", "share", "code-sleuth", ".env"),
    );
    expect(defaultKeyFile("linux", { XDG_DATA_HOME: "" }, "/h")).toBe(
      join("/h", ".local", "share", "code-sleuth", ".env"),
    );
    expect(defaultCasesFolder("linux", { XDG_DATA_HOME: "data" }, "/h")).toBe(
      join("/h", ".local", "share", "code-sleuth", "cases"),
    );
    expect(defaultKeyFile("win32", { LOCALAPPDATA: "" }, "C:/h")).toBe(
      join("C:/h", "AppData", "Local", "code-sleuth", ".env"),
    );
    expect(defaultKeyFile("win32", { LOCALAPPDATA: "L" }, "C:/h")).toBe(
      join("C:/h", "AppData", "Local", "code-sleuth", ".env"),
    );
    expect(defaultKeyFile("linux", { XDG_DATA_HOME: "/x" }, "/h")).toBe(join("/x", "code-sleuth", ".env"));
  });

  it("never reads a key from a .env inside the repository, wherever a setting puts it", async () => {
    const keys: string[] = [];
    await withScratch(async (scratch) => {
      await investigateAsync(
        { name: "widget", files: { "planted/.env": "ANTHROPIC_API_KEY=planted-value-for-the-test\n" } },
        async (root) => {
          const run = await sleuth(
            [root, "--goal", "public", "--offline", "--polish", "--out", join(scratch, "cases")],
            {
              casesFolder: join(scratch, "default"),
              keyFile: join(root, "planted", ".env"),
              // A stand-in that records the key it was given: no request ever leaves a test.
              polishClient: (key: string) => {
                keys.push(key);
                return async (card) => ({ ok: true, card });
              },
              env: { NO_COLOR: "1" },
            },
          );
          expect(run.code).toBe(0);
          // The tree's .env is a finding (files.sensitive); it is never where the key comes from.
          const polishLine = run.stdout.split("\n").find((line) => line.startsWith("Polish"));
          expect(polishLine).toBeDefined();
          expect(polishLine).not.toMatch(/Polish\s+on/);
          expect(polishLine).not.toContain("planted");
          expect(keys).toEqual([]);
        },
      );
    });
  });
});

describe("PowerShell and gh", () => {
  it("start in Code Sleuth's own folder, never the repository or the working folder", async () => {
    expect(realpathSync(join(OWN_FOLDER, "handoff.ps1"))).toBeTruthy();
    await withScratch(async (scratch) => {
      const toolkit = stubToolkit(scratch, ["pwsh"]);
      await investigateAsync({ name: "widget", files: { "a.txt": "a\n" } }, async (root) => {
        // No --offline, which starts no PowerShell: the stub alone is on the PATH, so no npm or gh is found.
        await sleuth([root, "--goal", "public", "--out", join(scratch, "cases")], {
          casesFolder: join(scratch, "default"),
          env: {
            ...toolkit.env,
            PATH: toolkit.env.PATH,
            NO_COLOR: "1",
          },
        });
      });
      const calls = toolkit.calls();
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(realpathSync(call.cwd)).toBe(realpathSync(OWN_FOLDER));
    });
  });
});
