import { spawnSync } from "node:child_process";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { stubGh } from "../helpers/npm.js";
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
          expect(toolkit.calls().some((call) => call.argv.includes("-Title"))).toBe(true);
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
});
