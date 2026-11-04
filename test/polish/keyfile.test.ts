import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultKeyFile } from "../../src/case/folder.js";
import { copyCommand, exampleFile, readKeyFile, shownPath } from "../../src/cli/keyFile.js";
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
  /** Stand in a .env.example that is not there. */
  noExample?: boolean;
  /** The home folder paths are shown from, and an example to use in place of the package's. */
  home?: string;
  example?: string;
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
        ...(options.noExample ? { keyExample: join(scratch, "nowhere", ".env.example") } : {}),
        ...(options.example === undefined ? {} : { keyExample: options.example }),
        ...(options.home === undefined ? {} : { home: options.home }),
      }),
    );
    const caseFiles = (readdirSync(out, { recursive: true }) as string[]).filter((f) =>
      /case\.(md|json)$/.test(f),
    );
    const records = caseFiles.map((f) => readFileSync(join(out, f), "utf8")).join("\n");
    return { result, keys, cases: everyFile(out), records, npmCalls: npm.calls() };
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
  // The variable's name is for .env.example alone, and the rules (AGENTS.md, SECURITY.md, the spec): what a
  // person reads, the output and the docs, says "API key".
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

  it("never names the variable in the docs, only in .env.example", () => {
    const root = new URL("../../", import.meta.url);
    const docs = [
      "README.md",
      "CHANGELOG.md",
      ...readdirSync(new URL("docs/", root))
        .filter((name) => name.endsWith(".md"))
        .map((name) => `docs/${name}`),
    ];
    expect(docs).toEqual(
      expect.arrayContaining([
        "README.md",
        "docs/QUICKSTART.md",
        "docs/CONFIGURATION.md",
        "docs/POLISH.md",
        "docs/CLI.md",
      ]),
    );
    const naming = docs.filter((doc) =>
      readFileSync(new URL(doc, root), "utf8").includes("ANTHROPIC_API_KEY"),
    );
    expect(naming).toEqual([]);
    expect(readFileSync(new URL(".env.example", root), "utf8")).toContain("ANTHROPIC_API_KEY=");
  });
});

describe("where an API key goes, when there is none", () => {
  it("prints the line runnable, both paths in full, in the terminal", async () => {
    await withScratch(async (home) => {
      const file = join(home, "code-sleuth", ".env");
      const { result } = await polishRun({ file });
      const line = `Polish     No API key. The cards are as the sleuth wrote them. To add one, run \`${copyCommand(exampleFile()!, file)}\` and fill it in.`;
      expect(result.stdout).toContain(line + "\n");
    });
  });

  it("keeps the case file free of the home folder: the line is there in its ~ form", async () => {
    await withScratch(async (home) => {
      const file = join(home, "Library", "Application Support", "code-sleuth", ".env");
      const example = join(home, "tools", "code-sleuth", ".env.example");
      mkdirSync(dirname(example), { recursive: true });
      writeFileSync(example, readFileSync(exampleFile()!, "utf8"));
      for (const argv of [["--polish"], []]) {
        const { result, records } = await polishRun({ file, example, home, argv });
        expect(result.stdout).toContain(copyCommand(example, file));
        expect(records).not.toContain(home);
        const shown = copyCommand(shownPath(example, home), shownPath(file, home));
        expect(records).toContain(shown);
        expect(shown).toContain("'~");
      }
    });
  });

  it("says where without the command when the example is not there", async () => {
    await withScratch(async (home) => {
      const file = join(home, "code-sleuth", ".env");
      const { result } = await polishRun({ file, argv: [], noExample: true });
      expect(result.stdout).toContain(`To add one, copy .env.example to ${shownPath(file)} and fill it in.`);
    });
  });

  it("finds the example beside the command, at the package's root", () => {
    expect(exampleFile()).toBe(fileURLToPath(new URL("../../.env.example", import.meta.url)));
    expect(readFileSync(exampleFile()!, "utf8")).toMatch(/^ANTHROPIC_API_KEY=$/m);
  });

  it.each([
    [
      "darwin",
      "/pkg/it's/.env.example",
      "/Users/a b/Library/Application Support/code-sleuth/.env",
      "mkdir -p '/Users/a b/Library/Application Support/code-sleuth' && cp '/pkg/it'\\''s/.env.example' '/Users/a b/Library/Application Support/code-sleuth/.env' && chmod 600 '/Users/a b/Library/Application Support/code-sleuth/.env'",
    ],
    [
      "win32",
      "C:\\pkg\\it's\\.env.example",
      "C:\\Users\\a b\\AppData\\Local\\code-sleuth\\.env",
      "New-Item -ItemType Directory -Force 'C:\\Users\\a b\\AppData\\Local\\code-sleuth' | Out-Null; Copy-Item 'C:\\pkg\\it''s\\.env.example' 'C:\\Users\\a b\\AppData\\Local\\code-sleuth\\.env'",
    ],
  ] as const)("quotes both paths for %s's shell", (platform, example, file, command) => {
    expect(copyCommand(example, file, platform)).toBe(command);
  });

  it.skipIf(process.platform === "win32")(
    "gives a command that works, and leaves the file yours alone",
    () => {
      withScratch((home) => {
        const file = join(home, "a folder's name", "code-sleuth", ".env");
        const ran = spawnSync("sh", ["-c", copyCommand(exampleFile()!, file)], { encoding: "utf8" });
        expect(ran.status).toBe(0);
        expect(readFileSync(file, "utf8")).toBe(readFileSync(exampleFile()!, "utf8"));
        expect(statSync(file).mode & 0o777).toBe(0o600);
      });
    },
  );
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
      // With no key, it says where one goes, with the line that copies the example beside the command.
      expect(before.stdout).toContain(
        "off. Add an API key and --polish to have the cards reworded. To add one, run `mkdir -p '",
      );
      expect(before.stdout).toContain(`cp '${exampleFile()}' '`);

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
