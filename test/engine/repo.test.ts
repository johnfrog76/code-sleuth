import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { investigate } from "../helpers/investigate.js";

describe("the repository reader", () => {
  it("reads every file under the root when it is not a repository, sorted", () => {
    investigate("reader/plain", (repo) => {
      expect(repo.isGitRepository).toBe(false);
      expect(repo.files).toEqual(["B.txt", "a.txt"]);
      expect(repo.readText("a.txt")).toBe("one\n");
      expect(repo.has("a.txt")).toBe(true);
      expect(repo.readText("missing.txt")).toBeUndefined();
    });
  });

  it("reads tracked files only in a repository: not untracked ones, not deleted ones", () => {
    investigate(
      "reader/plain",
      (repo) => {
        expect(repo.isGitRepository).toBe(true);
        expect(repo.files).toEqual(["a.txt"]);
        expect(repo.readText("untracked.txt")).toBeUndefined();
      },
      {
        git: true,
        prepare: (root) => {
          writeFileSync(join(root, "untracked.txt"), "new\n");
          rmSync(join(root, "B.txt"));
        },
      },
    );
  });

  it.each([false, true])("uses / in paths and skips the build folders for text checks (git: %s)", (git) => {
    investigate(
      "reader/nested",
      (repo) => {
        expect(repo.files).toEqual([
          "build/b.txt",
          "node_modules/pkg/package.json",
          "src/deep/file.ts",
          "src/dist/out.js",
        ]);
        expect(repo.textFiles).toEqual(["src/deep/file.ts"]);
      },
      { git },
    );
  });

  it("never lists anything inside .git", () => {
    investigate("reader/plain", (repo) => expect(repo.files.some((f) => f.startsWith(".git/"))).toBe(false), {
      git: true,
    });
  });
});
