import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRepoInfo } from "../src/case/repoInfo.js";
import { git, openRepo } from "../src/engine/repo.js";
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
});
