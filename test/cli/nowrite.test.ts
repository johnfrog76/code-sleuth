import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { copy as caseCopy } from "../../src/case/copy.js";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { stubGh, stubNpm } from "../helpers/npm.js";
import { stubToolkit } from "../helpers/toolkit.js";

// AGENTS rule 1, held over a whole run: git, npm, gh and the ToolKit hand-off all run, and the tree is
// byte-identical afterwards. investigateAsync snapshots every file before the run and fails on any change.

const hasNpm = spawnSync("npm", ["--version"], { stdio: "ignore" }).status === 0;

const project = {
  "package.json": JSON.stringify({
    name: "widget",
    version: "1.0.0",
    dependencies: { "left-pad": "^1.3.0" },
  }),
  "package-lock.json": JSON.stringify({
    name: "widget",
    lockfileVersion: 3,
    packages: { "": { name: "widget" }, "node_modules/left-pad": { version: "1.3.0", license: "WTFPL" } },
  }),
  "README.md": "# widget\n",
};

describe("a whole run writes nothing into the repository", () => {
  // npm writes its cache and a debug log on every command: a hostile .npmrc points both into the tree.
  it.skipIf(!hasNpm || process.platform === "win32").each([
    ["with no .npmrc", {}],
    [
      "with an .npmrc that points npm's cache and logs into the tree",
      { ".npmrc": "cache=./x\nlogs-dir=./y\n" },
    ],
  ])("%s", (_name, npmrc) =>
    withScratch(async (scratch) => {
      const toolkit = stubToolkit(scratch, ["pwsh"]);
      await investigateAsync(
        { name: "widget", files: { ...project, ...npmrc } },
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--out", join(scratch, "cases"), "--toolkit", "--yes"],
            {
              casesFolder: join(scratch, "default"),
              npmFolder: join(scratch, "npm"),
              // npm's own offline mode: the real npm runs, and nothing leaves the machine.
              env: {
                ...toolkit.env,
                PATH: `${toolkit.env.PATH}${delimiter}${process.env.PATH ?? ""}`,
                HOME: process.env.HOME,
                npm_config_offline: "true",
              },
            },
          );
          expect(result.stdout).toContain("npm");
          expect(toolkit.calls().some((call) => call.argv.some((a) => a.startsWith("-Title")))).toBe(true);
        },
        { git: true },
      );
    }),
  );

  it.skipIf(process.platform === "win32")("with gh asked in place of npm", () =>
    withScratch(async (scratch) => {
      const toolkit = stubToolkit(scratch, ["pwsh"]);
      const gh = stubGh(scratch);
      await investigateAsync(
        { name: "widget", files: { ...project, ".npmrc": "cache=./x\nlogs-dir=./y\n" } },
        async (root) => {
          await sleuth([root, "--goal", "public", "--out", join(scratch, "cases")], {
            casesFolder: join(scratch, "default"),
            npmFolder: join(scratch, "npm"),
            env: { ...toolkit.env, ...gh.env, PATH: `${toolkit.env.PATH}${delimiter}${gh.env.PATH}` },
          });
          expect(gh.calls().length).toBeGreaterThan(0);
        },
        { git: true },
      );
    }),
  );

  it.skipIf(process.platform === "win32")(
    "refuses a repository that holds Code Sleuth's own npm folder, as `code-sleuth ~ --out elsewhere` would be",
    () =>
      withScratch(async (scratch) => {
        const home = join(scratch, "home");
        const npmFolder = join(home, "Library", "Application Support", "code-sleuth", "npm");
        mkdirSync(home);
        writeFileSync(join(home, "README.md"), "# home\n");
        const npm = stubNpm(scratch);
        const result = await sleuth([home, "--goal", "public", "--out", join(scratch, "cases")], {
          casesFolder: join(scratch, "default"),
          npmFolder,
          env: npm.env,
        });
        expect(isRefusal(result)).toBe(true);
        expect(result.stderr).toContain(caseCopy.npmFolderInRepo(home));
        expect(existsSync(npmFolder)).toBe(false);
        expect(npm.calls()).toEqual([]);
      }),
  );

  it.skipIf(process.platform === "win32")("runs there with --offline, since npm then writes nothing", () =>
    withScratch(async (scratch) => {
      const home = join(scratch, "home");
      mkdirSync(home);
      writeFileSync(join(home, "README.md"), "# home\n");
      const result = await sleuth([home, "--goal", "public", "--offline", "--out", join(scratch, "cases")], {
        casesFolder: join(scratch, "default"),
        npmFolder: join(home, "npm"),
        env: stubNpm(scratch).env,
      });
      expect(result.code).toBe(0);
    }),
  );

  it("writes through the one guard: only the case writer, the cases folder and the ledger write files", () => {
    const src = fileURLToPath(new URL("../../src", import.meta.url));
    const writers = (readdirSync(src, { recursive: true }) as string[])
      .map((name) => name.split("\\").join("/"))
      .filter((name) => name.endsWith(".ts"))
      .filter((name) =>
        /\b(writeFileSync|appendFileSync|mkdirSync|copyFileSync|renameSync)\(/.test(
          readFileSync(join(src, name), "utf8"),
        ),
      )
      .sort();
    // engine/npm.ts writes only in npm's own folder, which the guard holds outside the repository; cli/keyFile.ts
    // only the .env.example template beside Code Sleuth's own .env, never over a file and never in the repository.
    expect(writers).toEqual([
      "case/folder.ts",
      "case/write.ts",
      "cli/keyFile.ts",
      "engine/npm.ts",
      "toolkit/ledger.ts",
    ]);
  });
});
