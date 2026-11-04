import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRepoInfo } from "../src/case/repoInfo.js";
import { CHECKS } from "../src/engine/checks/index.js";
import { historyPartial, historyUnreadable } from "../src/engine/copy.js";
import { runCheck, secretHasher } from "../src/engine/engine.js";
import {
  GIT_SAFE_CONFIG,
  git,
  gitSafeConfig,
  helperNamesIn,
  openRepo,
  parseGitVersion,
  takesEnvConfig,
} from "../src/engine/repo.js";
import { withScratch } from "./helpers/scratch.js";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

/** A scratch repository with one commit, built with the test's own git, never Code Sleuth's. */
function repoWith(
  folder: string,
  setup: (root: string, marker: string) => void,
): { root: string; marker: string } {
  const root = join(folder, "repo");
  const marker = join(folder, "MARKER");
  mkdirSync(root);
  const run = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  run("init", "-q");
  writeFileSync(join(root, "a.txt"), "one\n");
  run("add", "a.txt");
  run("-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "one");
  setup(root, marker);
  // A changed file, so status has something to compare and a filter something to clean.
  writeFileSync(join(root, "a.txt"), "two\n");
  return { root, marker };
}

const config = (root: string, ...args: string[]) => execFileSync("git", ["config", ...args], { cwd: root });

/** Everything Code Sleuth asks git in a run: the file list, the history, the commit messages, the case's facts. */
function readEverything(root: string) {
  const repo = openRepo(root);
  repo.addedLines?.();
  repo.commitMessages?.();
  readRepoInfo(repo);
  git(root, ["status", "--porcelain"]);
}

const touch = (marker: string) => `touch '${marker}'`;

/** A submodule whose own config names a filter, and a file whose stat is newer than its index. Built once. */
function submoduleWithFilter(root: string, marker: string): void {
  const source = join(root, "..", "sub-source");
  if (!existsSync(source)) {
    mkdirSync(source);
    const run = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
    run(source, "init", "-q");
    writeFileSync(join(source, ".gitattributes"), "* filter=sly\n");
    writeFileSync(join(source, "b.txt"), "one\n");
    run(source, "add", ".");
    run(source, "-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "one");
    run(root, "-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "sub");
    config(join(root, "sub"), "filter.sly.clean", `sh -c "${touch(marker)}; cat"`);
  }
  // Newer than the index holds, so status must look again, and would clean the file through the filter.
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(root, "sub", "b.txt"), later, later);
}

const ROWS: [string, (root: string, marker: string) => void][] = [
  ["a file-system monitor", (root, marker) => config(root, "core.fsmonitor", `${touch(marker)}; false`)],
  [
    "a filter's clean command",
    (root, marker) => {
      writeFileSync(join(root, ".gitattributes"), "* filter=sly\n");
      config(root, "filter.sly.clean", `sh -c "${touch(marker)}; cat"`);
    },
  ],
  [
    "a filter's long-running process",
    (root, marker) => {
      writeFileSync(join(root, ".gitattributes"), "* filter=sly\n");
      config(root, "filter.sly.process", `sh -c "${touch(marker)}"`);
    },
  ],
  [
    "a required filter, as git-lfs sets one",
    (root, marker) => {
      writeFileSync(join(root, ".gitattributes"), "* filter=lfsish\n");
      config(root, "filter.lfsish.clean", `sh -c "${touch(marker)}; cat"`);
      config(root, "filter.lfsish.required", "true");
    },
  ],
  [
    "a filter named in an included config file",
    (root, marker) => {
      writeFileSync(join(root, ".gitattributes"), "* filter=sly.two\n");
      writeFileSync(
        join(root, ".git", "extra.cfg"),
        // Quoted, so the ; is part of the value, not the start of a comment.
        `[filter "sly.two"]\n\tclean = "sh -c 'touch ${marker}; cat'"\n`,
      );
      config(root, "include.path", "extra.cfg");
    },
  ],
  [
    "a filter whose name holds an =, which a -c setting would split",
    (root, marker) => {
      writeFileSync(join(root, ".gitattributes"), "* filter=a=b\n");
      config(root, "filter.a=b.clean", `sh -c "${touch(marker)}; cat"`);
    },
  ],
  ["a filter named in a submodule's own config", (root, marker) => submoduleWithFilter(root, marker)],
  [
    "a filter in a submodule the repository's config says to look into (submodule.<name>.ignore=none)",
    (root, marker) => {
      submoduleWithFilter(root, marker);
      config(root, "submodule.sub.ignore", "none");
    },
  ],
  [
    "a signature program (a second line: no read Code Sleuth makes reaches one today)",
    (root, marker) => {
      config(root, "log.showSignature", "true");
      config(root, "gpg.program", `sh -c "${touch(marker)}"`);
    },
  ],
  [
    "a hook in its own hooks folder (a second line: no read Code Sleuth makes runs one today)",
    (root, marker) => {
      const hooks = join(root, ".git", "sly-hooks");
      mkdirSync(hooks);
      for (const hook of ["post-index-change", "post-checkout", "pre-auto-gc"]) {
        writeFileSync(join(hooks, hook), `#!/bin/sh\n${touch(marker)}\n`);
        chmodSync(join(hooks, hook), 0o755);
      }
      config(root, "core.hooksPath", hooks);
    },
  ],
];

describe("git never runs a command the investigated repository chose", () => {
  it.skipIf(process.platform === "win32").each(ROWS)("never runs %s", (_name, setup) =>
    withScratch((folder) => {
      const { root, marker } = repoWith(folder, setup);
      readEverything(root);
      expect(existsSync(marker)).toBe(false);
    }),
  );

  it.skipIf(process.platform === "win32")("still reads status with a required filter on a changed file", () =>
    withScratch((folder) => {
      const { root, marker } = repoWith(folder, (r, m) => {
        writeFileSync(join(r, ".gitattributes"), "* filter=lfsish\n");
        config(r, "filter.lfsish.clean", `sh -c "${touch(m)}; cat"`);
        config(r, "filter.lfsish.required", "true");
      });
      const status = git(root, ["status", "--porcelain"]);
      expect(status.status).toBe(0);
      expect(status.stdout.toString()).toContain("a.txt");
      expect(existsSync(marker)).toBe(false);
    }),
  );

  it.skipIf(process.platform === "win32")("still reads the repository with every one of them set", () =>
    withScratch((folder) => {
      const { root } = repoWith(folder, (r, marker) => ROWS.forEach(([, setup]) => setup(r, marker)));
      const repo = openRepo(root);
      expect(repo.isGitRepository).toBe(true);
      expect(repo.textFiles).toContain("a.txt");
      expect(readRepoInfo(repo).dirty).toBe(true);
    }),
  );

  it("builds a git argument list in one place: only src/engine/repo.ts spawns git", () => {
    const sources = (folder: string): string[] =>
      readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) return sources(path);
        return entry.name.endsWith(".ts") ? [path] : [];
      });
    const spawnsGit = sources(SRC)
      .filter((file) => /spawnChild\(\s*["']git["']/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file).split(sep).join("/"));
    expect(spawnsGit).toEqual(["engine/repo.ts"]);
  });

  describe("a partial clone", () => {
    /** A source with two commits, and a blobless clone of it: the first commit's blob is not in the clone. */
    function partial(folder: string) {
      const source = join(folder, "source");
      mkdirSync(source);
      const run = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" });
      run(source, "init", "-q");
      writeFileSync(join(source, "a.txt"), "one\n");
      run(source, "add", "a.txt");
      run(source, "-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "one");
      writeFileSync(join(source, "a.txt"), "two\n");
      run(source, "-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qam", "two");
      run(source, "config", "uploadpack.allowFilter", "true");
      const root = join(folder, "clone");
      run(folder, "clone", "-q", "--filter=blob:none", `file://${source}`, root);
      const missing = () =>
        execFileSync("git", ["rev-list", "--objects", "--missing=print", "--all"], {
          cwd: root,
          env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
        })
          .toString()
          .split("\n")
          .filter((line) => line.startsWith("?")).length;
      return { root, missing };
    }

    it.skipIf(process.platform === "win32")(
      "fetches nothing in a whole run, and says the history was not read",
      () =>
        withScratch((folder) => {
          const { root, missing } = partial(folder);
          const before = missing();
          expect(before).toBeGreaterThan(0);
          const repo = openRepo(root);
          expect(repo.isPartialClone).toBe(true);
          readEverything(root);
          const history = runCheck(
            CHECKS.find((c) => c.id === "secrets.history")!,
            repo,
            new Set(["git"]),
            secretHasher(Buffer.alloc(32)),
          );
          expect(history).toEqual({ verdict: "not-investigated", reason: historyPartial });
          expect(readRepoInfo(repo).partialClone).toBe(true);
          expect(missing()).toBe(before);
        }),
    );

    it.skipIf(process.platform === "win32")(
      "fetches nothing when the repository's own config re-allows the file transport",
      () =>
        withScratch((folder) => {
          const { root, missing } = partial(folder);
          execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: root });
          const before = missing();
          readEverything(root);
          expect(missing()).toBe(before);
          // And as on a git too old for GIT_NO_LAZY_FETCH: only the -c settings, against the repository's own.
          const env = { ...process.env };
          delete env.GIT_NO_LAZY_FETCH;
          const flags = GIT_SAFE_CONFIG.flatMap((setting) => ["-c", setting]);
          const log = spawnSync("git", [...flags, "log", "-p", "--all"], { cwd: root, env });
          expect(log.status).not.toBe(0);
          expect(missing()).toBe(before);
        }),
    );

    it.skipIf(process.platform === "win32")(
      "fetches nothing with only protocol.allow=never, as on a git too old for GIT_NO_LAZY_FETCH",
      () =>
        withScratch((folder) => {
          const { root, missing } = partial(folder);
          const before = missing();
          expect(GIT_SAFE_CONFIG).toContain("protocol.allow=never");
          const env = { ...process.env };
          delete env.GIT_NO_LAZY_FETCH;
          const log = spawnSync("git", ["-c", "protocol.allow=never", "log", "-p", "--all"], {
            cwd: root,
            env,
          });
          expect(log.status).not.toBe(0);
          expect(missing()).toBe(before);
        }),
    );

    it.skipIf(process.platform === "win32")(
      "says the history could not be read, not that it is partial, when git log fails on a full clone",
      () =>
        withScratch((folder) => {
          const { root } = repoWith(folder, () => {});
          const repo = { ...openRepo(root), addedLines: () => undefined };
          expect(repo.isPartialClone).toBe(false);
          const history = runCheck(
            CHECKS.find((c) => c.id === "secrets.history")!,
            repo,
            new Set(["git"]),
            secretHasher(Buffer.alloc(32)),
          );
          expect(history).toEqual({ verdict: "not-investigated", reason: historyUnreadable });
        }),
    );

    it.skipIf(process.platform === "win32")("is not a partial clone when nothing is a promisor", () =>
      withScratch((folder) => {
        const { root } = repoWith(folder, () => {});
        expect(openRepo(root).isPartialClone).toBe(false);
      }),
    );
  });

  describe("every transport, by name", () => {
    it("turns off git's own transports and the helpers it ships, ftp, ftps and fd among them", () => {
      for (const name of ["file", "git", "ssh", "http", "https", "ext", "fd", "ftp", "ftps"])
        expect(GIT_SAFE_CONFIG).toContain(`protocol.${name}.allow=never`);
    });

    it.skipIf(process.platform === "win32")(
      "refuses the ftp transport before any connection, though the repository's own config allows it",
      () =>
        withScratch((folder) => {
          const { root } = repoWith(folder, (r) => config(r, "protocol.ftp.allow", "always"));
          const flags = gitSafeConfig().flatMap((setting) => ["-c", setting]);
          const env = { ...process.env, GIT_NO_LAZY_FETCH: "1" };
          const listed = spawnSync("git", [...flags, "ls-remote", "ftp://127.0.0.1:9/none"], {
            cwd: root,
            env,
          });
          expect(listed.status).not.toBe(0);
          expect(listed.stderr.toString()).toMatch(/transport 'ftp' not allowed/);
        }),
    );

    it.skipIf(process.platform === "win32")(
      "finds a git-remote-<name> helper on the PATH, and names it",
      () =>
        withScratch((folder) => {
          writeFileSync(join(folder, "git-remote-sly"), "#!/bin/sh\n");
          writeFileSync(join(folder, "git-remote-https"), "#!/bin/sh\n");
          expect(helperNamesIn([folder, join(folder, "missing")])).toEqual(["sly"]);
        }),
    );
  });
});

describe("a git too old to take its settings from the environment", () => {
  const MAIN = fileURLToPath(new URL("../dist/cli/main.js", import.meta.url));

  /** A git that answers --version as `version` and passes everything else to the real git, logging each call. */
  function oldGit(folder: string, version: string) {
    const bin = join(folder, "git-bin");
    mkdirSync(bin);
    const real = execFileSync("sh", ["-c", "command -v git"]).toString().trim();
    const log = join(folder, "git-calls.log");
    writeFileSync(
      join(bin, "git"),
      `#!/bin/sh\necho "$*" >> '${log}'\nif [ "$1" = "--version" ]; then echo "git version ${version}"; exit 0; fi\nexec '${real}' "$@"\n`,
    );
    chmodSync(join(bin, "git"), 0o755);
    return { bin, calls: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []) };
  }

  function runWith(folder: string, version: string) {
    const { root } = repoWith(folder, () => {});
    const stub = oldGit(folder, version);
    const result = spawnSync(
      process.execPath,
      [MAIN, root, "--goal", "public", "--offline", "--out", join(folder, "cases")],
      { env: { ...process.env, PATH: `${stub.bin}:${process.env.PATH ?? ""}` }, encoding: "utf8" },
    );
    return { result, calls: stub.calls() };
  }

  it.skipIf(process.platform === "win32")("refuses git 2.30, and asks it nothing but its version", () =>
    withScratch((folder) => {
      const { result, calls } = runWith(folder, "2.30.9");
      expect(result.status).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "Error: git 2.30.9 is too old for me: it would ignore the settings that keep a repository from running its own commands.\n" +
          "Hint: Install git 2.31 or newer, then run me again.\n",
      );
      expect(calls).toEqual(["--version"]);
    }),
  );

  it.skipIf(process.platform === "win32").each(["2.31.0", "2.56.0 (Apple Git-200)", "3.0.0"])(
    "investigates with git %s",
    (version) =>
      withScratch((folder) => {
        const { result, calls } = runWith(folder, version);
        expect(result.status).toBe(0);
        expect(calls.length).toBeGreaterThan(1);
      }),
  );

  it("reads a version only from git's own answer", () => {
    expect(parseGitVersion("git version 2.39.3 (Apple Git-145)")).toEqual({
      major: 2,
      minor: 39,
      shown: "2.39.3",
    });
    expect(parseGitVersion("git version 2.45.1.windows.1")).toEqual({
      major: 2,
      minor: 45,
      shown: "2.45.1.windows.1",
    });
    expect(parseGitVersion("hub version 2.14")).toBeUndefined();
    expect(takesEnvConfig({ major: 2, minor: 30 })).toBe(false);
    expect(takesEnvConfig({ major: 2, minor: 31 })).toBe(true);
    expect(takesEnvConfig({ major: 3, minor: 0 })).toBe(true);
    expect(takesEnvConfig({ major: 1, minor: 99 })).toBe(false);
  });
});
