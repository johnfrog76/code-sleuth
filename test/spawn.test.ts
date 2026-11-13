import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { git } from "../src/engine/repo.js";
import { findGh, findNpm } from "../src/engine/npm.js";
import { KEY_VARIABLE, onPath, pathFolders, spawnChild, withoutKey } from "../src/spawn.js";
import { detectToolkit } from "../src/toolkit/detect.js";
import { stubGh, stubNpm } from "./helpers/npm.js";
import { FAKE_KEY } from "./helpers/polish.js";
import { withScratch } from "./helpers/scratch.js";
import { stubToolkit } from "./helpers/toolkit.js";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("the model key never reaches a child process", () => {
  it("is taken out of the environment a child gets, and nothing else is", () => {
    const env = { [KEY_VARIABLE]: FAKE_KEY, PATH: "/bin", OTHER: "kept" };
    expect(withoutKey(env)).toEqual({ PATH: "/bin", OTHER: "kept" });
    expect(env[KEY_VARIABLE]).toBe(FAKE_KEY);
  });

  // Windows matches names without regard to case, so every casing goes, on every platform.
  it.each(["anthropic_api_key", "Anthropic_Api_Key", "ANTHROPIC_api_KEY"])(
    "is taken out when it is spelled %s",
    (name) => {
      expect(withoutKey({ [name]: FAKE_KEY, Path: "C:\\bin" })).toEqual({ Path: "C:\\bin" });
    },
  );

  it("keeps a variable that only starts or ends like the key", () => {
    const env = { [`${KEY_VARIABLE}_FILE`]: "kept", [`MY_${KEY_VARIABLE}`]: "kept" };
    expect(withoutKey(env)).toEqual(env);
  });

  it.skipIf(process.platform === "win32")("never reaches npm, with the key in the environment", () =>
    withScratch((folder) => {
      const npm = stubNpm(folder);
      writeFileSync(join(folder, "package.json"), "{}");
      findNpm({ ...npm.env, [KEY_VARIABLE]: FAKE_KEY })!.run(["outdated", "--json", "--long"], folder);
      expect(npm.calls()).toHaveLength(1);
      expect(npm.calls()[0]!.key).toBeNull();
    }),
  );

  it.skipIf(process.platform === "win32")("never reaches a child in another casing either", () =>
    withScratch((folder) => {
      const npm = stubNpm(folder);
      writeFileSync(join(folder, "package.json"), "{}");
      findNpm({ ...npm.env, anthropic_api_key: FAKE_KEY })!.run(["outdated", "--json", "--long"], folder);
      expect(npm.calls()).toHaveLength(1);
      expect(npm.calls()[0]!.lowerKey).toBeNull();
    }),
  );

  it.skipIf(process.platform === "win32")("never reaches gh, with the key in the environment", () =>
    withScratch((folder) => {
      const gh = stubGh(folder);
      findGh({ ...gh.env, [KEY_VARIABLE]: FAKE_KEY })!.run(["api", "/advisories"], folder);
      expect(gh.calls()).toHaveLength(1);
      expect(gh.calls()[0]!.key).toBeNull();
    }),
  );

  it.skipIf(process.platform === "win32")(
    "never reaches ToolKit's shell, with the key in the environment",
    () =>
      withScratch((folder) => {
        const toolkit = stubToolkit(folder, ["pwsh"]);
        detectToolkit({ env: { ...toolkit.env, [KEY_VARIABLE]: FAKE_KEY } });
        expect(toolkit.calls().length).toBeGreaterThan(0);
        expect(toolkit.calls().every((call) => call.key === null)).toBe(true);
      }),
  );

  it.skipIf(process.platform === "win32")(
    "never reaches git, with the key in the process's own environment",
    () =>
      withScratch((folder) => {
        const before = process.env[KEY_VARIABLE];
        process.env[KEY_VARIABLE] = FAKE_KEY;
        try {
          // A shell alias prints the child's own value of the variable, or nothing.
          const result = git(folder, ["-c", `alias.key=!printenv ${KEY_VARIABLE} || true`, "key"]);
          expect(result.status).toBe(0);
          expect(result.stdout.toString()).toBe("");
        } finally {
          if (before === undefined) delete process.env[KEY_VARIABLE];
          else process.env[KEY_VARIABLE] = before;
        }
      }),
  );

  it("starts every child through one helper: no other file in src/ uses node:child_process", () => {
    const users = sources(SRC)
      .filter((file) => /["']node:child_process["']|["']child_process["']/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file).split(sep).join("/"));
    expect(users).toEqual(["spawn.ts"]);
  });

  it("never starts a shell, even when a caller asks for one: the arguments reach the program as they are", () => {
    const word = "$HOME;%PATH%|x";
    const result = spawnChild(process.execPath, ["-e", "console.log(process.argv[1])", word], {
      encoding: "utf8",
      shell: true,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(word);
  });
});

describe("a command is found in the PATH's absolute folders only, never in the repository", () => {
  const MAIN = fileURLToPath(new URL("../dist/cli/main.js", import.meta.url));

  it("keeps only absolute folders, on both platforms", () => {
    expect(pathFolders({ PATH: ".:./bin::node_modules/.bin:/usr/bin:/bin" }, "linux")).toEqual([
      "/usr/bin",
      "/bin",
    ]);
    expect(pathFolders({ Path: "C:\\Git\\cmd;.\\bin;;tools;D:\\x" }, "win32")).toEqual([
      "C:\\Git\\cmd",
      "D:\\x",
    ]);
  });

  it("gives every child a PATH of absolute folders", () =>
    withScratch((folder) => {
      const shown = spawnChild("sh", ["-c", 'printf %s "$PATH"'], {
        cwd: folder,
        env: { PATH: `./x::node_modules/.bin:/bin:/usr/bin` },
        encoding: "utf8",
      });
      expect(shown.stdout).toBe("/bin:/usr/bin");
    }));

  it("starts nothing for a name it cannot find, and looks for it nowhere else", () =>
    withScratch((folder) => {
      writeFileSync(join(folder, "sly"), "#!/bin/sh\ntouch MARKER\n");
      chmodSync(join(folder, "sly"), 0o755);
      const result = spawnChild("sly", [], { cwd: folder, env: { PATH: "/usr/bin:/bin" }, encoding: "utf8" });
      expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe("ENOENT");
      expect(existsSync(join(folder, "MARKER"))).toBe(false);
    }));

  it.skipIf(process.platform !== "win32")("finds a Windows program by its .exe, by its full path", () =>
    withScratch((folder) => {
      writeFileSync(join(folder, "git.exe"), "");
      expect(onPath("git", { PATH: folder }, "win32")).toBe(win32.join(folder, "git.exe"));
    }),
  );

  // The code review's high finding 8: with ./node_modules/.bin on the PATH, the repository's own `git` ran.
  it.skipIf(process.platform === "win32").each([
    ["./node_modules/.bin on the PATH", "./node_modules/.bin", join("node_modules", ".bin")],
    ["an empty entry on the PATH, read as the current folder", "", "."],
  ])("never runs the repository's own git with %s", (_name, entry, at) =>
    withScratch((folder) => {
      const root = join(folder, "repo");
      mkdirSync(join(root, at), { recursive: true });
      const run = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
      run("init", "-q");
      writeFileSync(join(root, "README.md"), "# repo\n");
      run("add", "README.md");
      run("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "one");
      const marker = join(folder, "MARKER");
      writeFileSync(join(root, at, "git"), `#!/bin/sh\ntouch '${marker}'\nexit 1\n`);
      chmodSync(join(root, at, "git"), 0o755);
      const result = spawnSync(
        process.execPath,
        [MAIN, root, "--goal", "public", "--offline", "--out", join(folder, "cases")],
        { cwd: root, env: { ...process.env, PATH: `${entry}:${process.env.PATH ?? ""}` }, encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      expect(existsSync(marker)).toBe(false);
    }),
  );
});
