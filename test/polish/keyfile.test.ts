import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultKeyFile } from "../../src/case/folder.js";
import { readKeyFile, shownPath } from "../../src/cli/keyFile.js";
import type { PolishClient } from "../../src/polish/client.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { stubNpm } from "../helpers/npm.js";
import { FAKE_KEY } from "../helpers/polish.js";
import { withScratch } from "../helpers/scratch.js";

/** A second fake key, from pieces, so the environment's and the file's can be told apart. */
const OTHER_KEY = ["sk", "-ant-", "test-", "1".repeat(24)].join("");
const MAIN = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));

const app = {
  "README.md": "# widget\n",
  "package.json":
    JSON.stringify({ name: "widget", version: "1.0.0", dependencies: { left: "1.0.0" } }) + "\n",
  "package-lock.json":
    JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/left": { version: "1.0.0" } } }) +
    "\n",
};

/** Writes a .env holding `text`, readable by its owner alone unless `mode` says otherwise. */
function keyFile(folder: string, text: string, mode = 0o600): string {
  const path = join(folder, "code-sleuth", ".env");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  chmodSync(path, mode);
  return path;
}

/** Every file under a folder, as one text. */
function everyFile(folder: string): string {
  return (readdirSync(folder, { recursive: true }) as string[])
    .map((name) => {
      try {
        return readFileSync(join(folder, name), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

/** A --polish run over a built tree, with a stub npm and a client that records the key it was given. */
async function polishRun(options: {
  env?: NodeJS.ProcessEnv;
  file?: string;
  files?: Record<string, string>;
  argv?: string[];
}) {
  return withScratch(async (scratch) => {
    const npm = stubNpm(scratch);
    const keys: string[] = [];
    const client = (key: string): PolishClient => {
      keys.push(key);
      return async (card) => ({ ok: true, card });
    };
    const out = join(scratch, "cases");
    const result = await investigateAsync({ name: "widget", files: options.files ?? app }, (root) =>
      sleuth([root, "--goal", "public", "--out", out, ...(options.argv ?? ["--polish"])], {
        casesFolder: join(scratch, "default"),
        env: { ...npm.env, ...options.env },
        polishClient: client,
        ...(options.file === undefined ? {} : { keyFile: options.file }),
      }),
    );
    return { result, keys, cases: everyFile(out), npmCalls: npm.calls() };
  });
}

describe("the model key from Code Sleuth's own .env", () => {
  it("is read from the file alone, and the Polish line says where from, never what", async () => {
    await withScratch(async (home) => {
      const file = keyFile(home, `# mine\nANTHROPIC_API_KEY=${FAKE_KEY}\nOTHER=x\n`);
      const { result, keys } = await polishRun({ file });
      expect(keys).toEqual([FAKE_KEY]);
      expect(result.stdout).toMatch(
        new RegExp(`Polish .*, with the API key from ${escape(shownPath(file))}`),
      );
      expect(result.stdout + result.stderr).not.toContain(FAKE_KEY);
    });
  });

  it("is read from the environment alone, and says so", async () => {
    const { result, keys } = await polishRun({ env: { ANTHROPIC_API_KEY: FAKE_KEY } });
    expect(keys).toEqual([FAKE_KEY]);
    expect(result.stdout).toMatch(/Polish .*, with the API key from the environment/);
  });

  it("gives way to the environment when both hold a key", async () => {
    await withScratch(async (home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY=${OTHER_KEY}\n`);
      const { result, keys } = await polishRun({ env: { ANTHROPIC_API_KEY: FAKE_KEY }, file });
      expect(keys).toEqual([FAKE_KEY]);
      expect(result.stdout).toContain("with the API key from the environment");
    });
  });

  it("names its source without --polish too", async () => {
    await withScratch(async (home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`);
      const { result, keys } = await polishRun({ file, argv: [] });
      expect(keys).toEqual([]);
      expect(result.stdout).toContain(`an API key is set (from ${shownPath(file)}): add --polish`);
    });
  });

  it("never reads a .env in the investigated repository", async () => {
    const { result, keys } = await polishRun({
      files: { ...app, ".env": `ANTHROPIC_API_KEY=${FAKE_KEY}\n` },
    });
    expect(keys).toEqual([]);
    expect(result.stdout).toContain("Polish     No API key. The cards are as the sleuth wrote them.");
  });

  it("never reaches the case file, and never reaches a child's environment", async () => {
    await withScratch(async (home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`);
      const { keys, cases, npmCalls } = await polishRun({ file });
      expect(keys).toEqual([FAKE_KEY]);
      expect(cases).not.toContain(FAKE_KEY);
      expect(npmCalls.length).toBeGreaterThan(0);
      expect(npmCalls.every((call) => call.key === null)).toBe(true);
    });
  });

  it.skipIf(process.platform === "win32")(
    "warns once, with the chmod that fixes it, when others can read the file",
    async () => {
      await withScratch(async (home) => {
        const loose = keyFile(home, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`, 0o644);
        const { result } = await polishRun({ file: loose });
        const warnings = result.stderr.split("\n").filter((line) => line.startsWith("Warning: "));
        expect(warnings).toEqual([
          `Warning: ${loose} can be read by other people on this machine. Make it yours alone: chmod 600 '${loose}'`,
        ]);
        chmodSync(loose, 0o600);
        expect((await polishRun({ file: loose })).result.stderr).not.toContain("Warning: ");
      });
    },
  );
});

describe("what a person reads", () => {
  // The variable's name is for .env.example and CONFIGURATION.md: the output says "API key".
  it("never prints the variable's name, with a key or without, from the file or the environment", async () => {
    await withScratch(async (home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`);
      const runs = [
        await polishRun({}),
        await polishRun({ argv: [] }),
        await polishRun({ env: { ANTHROPIC_API_KEY: FAKE_KEY } }),
        await polishRun({ env: { ANTHROPIC_API_KEY: FAKE_KEY }, argv: [] }),
        await polishRun({ file }),
        await polishRun({ file, argv: [] }),
        await polishRun({ file: join(home, "missing", ".env"), argv: [] }),
      ];
      for (const { result } of runs) expect(result.stdout + result.stderr).not.toContain("ANTHROPIC_API_KEY");
      const help = await sleuth(["--help"], { casesFolder: join(home, "cases") });
      expect(help.stdout + help.stderr).not.toContain("ANTHROPIC_API_KEY");
    });
  });
});

describe("reading the .env", () => {
  it("takes only the model key, trimmed, and nothing from a file that is not there", () => {
    withScratch((home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY="  ${FAKE_KEY}  "\nPATH=/nowhere\n`);
      expect(readKeyFile(file, "linux")).toEqual({ key: FAKE_KEY });
      expect(readKeyFile(join(home, "missing", ".env"), "linux")).toEqual({});
      expect(readKeyFile(keyFile(home, "ANTHROPIC_API_KEY=\n"), "linux")).toEqual({});
    });
  });

  it("is not checked for permissions on Windows", () => {
    withScratch((home) => {
      const file = keyFile(home, `ANTHROPIC_API_KEY=${FAKE_KEY}\n`, 0o644);
      expect(readKeyFile(file, "win32")).toEqual({ key: FAKE_KEY });
    });
  });

  it("lives in Code Sleuth's own folder, beside the cases folder", () => {
    expect(defaultKeyFile("darwin", {}, "/h")).toBe(
      join("/h", "Library", "Application Support", "code-sleuth", ".env"),
    );
    expect(defaultKeyFile("linux", {}, "/h")).toBe(join("/h", ".local", "share", "code-sleuth", ".env"));
    expect(defaultKeyFile("linux", { XDG_DATA_HOME: "/x" }, "/h")).toBe(join("/x", "code-sleuth", ".env"));
    expect(defaultKeyFile("win32", { LOCALAPPDATA: "C:/L" }, "C:/h")).toBe(
      join("C:/L", "code-sleuth", ".env"),
    );
  });
});

describe("the command, as a person runs it", () => {
  // The built command in a child process, with a scratch home, so its default .env is a scratch file.
  const command = (cwd: string, args: string[], home: string) =>
    spawnSync(process.execPath, [MAIN, ...args], {
      cwd,
      encoding: "utf8",
      env: { HOME: home, USERPROFILE: home, LOCALAPPDATA: join(home, "AppData", "Local"), PATH: "" },
    });

  it("reads the .env in its own folder, and never one in the folder it is run from", () => {
    withScratch((scratch) => {
      const home = join(scratch, "home");
      const here = join(scratch, "here");
      mkdirSync(home, { recursive: true });
      mkdirSync(here, { recursive: true });
      writeFileSync(join(here, "README.md"), "# here\n");
      writeFileSync(join(here, ".env"), `ANTHROPIC_API_KEY=${FAKE_KEY}\n`);
      const out = join(scratch, "cases");
      const args = [".", "--goal", "public", "--offline", "--out", out];

      const before = command(here, args, home);
      expect(before.stdout).toContain(`off. Add an API key (copy .env.example to ~`);

      const own = defaultKeyFile(process.platform, { LOCALAPPDATA: join(home, "AppData", "Local") }, home);
      mkdirSync(dirname(own), { recursive: true });
      writeFileSync(own, `ANTHROPIC_API_KEY=${OTHER_KEY}\n`, { mode: 0o600 });
      const after = command(here, args, home);
      expect(after.stdout).toContain("an API key is set (from ~");
      expect(after.stdout + after.stderr).not.toContain(OTHER_KEY);
      expect(after.stdout + after.stderr).not.toContain(FAKE_KEY);
    });
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
