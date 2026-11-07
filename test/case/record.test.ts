import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanRemote, readRepoInfo } from "../../src/case/repoInfo.js";
import { takeCase } from "../../src/case/write.js";
import type { Check } from "../../src/engine/check.js";
import { needReasons } from "../../src/engine/copy.js";
import { investigate } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

const needsGit: Check = {
  id: "test.needs-git",
  title: "A check that needs git",
  booksName: "test",
  needs: ["git"],
  voice: { clean: "clean", found: "found" },
  card: { title: "A test card", fix: "Nothing to fix." },
  run: () => ({ verdict: "clean" }),
};

describe("a not-investigated check in a case", () => {
  it("is counted, unboxed in case.md with its reason, and never makes a card", () => {
    withScratch((out) =>
      investigate("whole/bare", (repo, capabilities) => {
        const { path, record } = takeCase({
          repo,
          goal: { id: "public", checks: [{ id: needsGit.id, weight: "smoking-gun" }] },
          capabilities,
          casesFolder: out,
          chosen: true,
          table: [needsGit],
        });
        expect(record.counts["not-investigated"]).toBe(1);
        expect(record.verdict).toBe("met");
        expect(record.checks[0]).toEqual({
          id: needsGit.id,
          title: needsGit.title,
          booksName: "test",
          verdict: "not-investigated",
          reason: needReasons.git,
        });
        const md = readFileSync(join(path, "case.md"), "utf8");
        expect(md).toContain("## Not investigated");
        expect(md).toContain(
          `- [ ] **A check that needs git** (\`test.needs-git\`): Not investigated. ${needReasons.git}`,
        );
      }),
    );
  });
});

describe("the repository in a case", () => {
  it("says dirty when the tree has changes", () => {
    investigate("whole/bare", (repo) => expect(readRepoInfo(repo).dirty).toBe(true), {
      git: true,
      prepare: (root) => writeFileSync(join(root, "new.txt"), "new\n"),
    });
  });

  it("is null past its name outside git", () => {
    investigate("whole/bare", (repo) =>
      expect(readRepoInfo(repo)).toEqual({
        name: "bare",
        head: null,
        branch: null,
        dirty: null,
        remote: null,
      }),
    );
  });

  it.each([
    ["https://github.com/owner/widget.git", "github.com/owner/widget"],
    ["https://user:token@github.com/owner/widget.git", "github.com/owner/widget"],
    ["git@github.com:owner/widget.git", "github.com/owner/widget"],
    ["ssh://git@github.com/owner/widget", "github.com/owner/widget"],
    ["https://dev.azure.com/org/project/_git/widget", "dev.azure.com/org/project/_git/widget"],
  ])("writes the remote %s without a scheme or credentials", (url, expected) => {
    expect(cleanRemote(url)).toBe(expected);
  });
});
