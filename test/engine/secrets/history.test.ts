import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "../../../src/engine/checks/index.js";
import { denyReasons, historyShallow, historyUnreadable } from "../../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../../src/engine/engine.js";
import { investigate, type InvestigateOptions } from "../../helpers/investigate.js";
import { SECRETS } from "../../helpers/secrets.js";

// The code review's high findings 7a to 7d: secrets.history read clean when it had not read the history.

const github = SECRETS["github-token"]!;
const added = `${github.line(github.value)}\n`;

const git = (root: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=t", ...args], {
    cwd: root,
    stdio: "pipe",
  })
    .toString()
    .trim();

function history(files: Record<string, string>, options: InvestigateOptions, id = "secrets.history") {
  return investigate(
    { name: "repo", files },
    (repo, capabilities) =>
      runCheck(
        CHECKS.find((c) => c.id === id)!,
        repo,
        new Set([...capabilities, "denyList" as const]),
        {
          ...secretHasher(Buffer.alloc(32)),
          denyList: ["widget-internal"],
        },
      ),
    options,
  );
}

describe("the history, read whole or said not to be", () => {
  it("reads a secret added and removed in a file the repository marks -diff", () => {
    const result = history(
      { "README.md": "# repo\n", ".gitattributes": "*.txt -diff\n" },
      { git: true, commits: [{ "conf.txt": added }, { "conf.txt": null }] },
    );
    expect(result).toMatchObject({
      verdict: "found",
      evidence: [{ path: "conf.txt", rule: "github-token" }],
    });
  });

  it("reads it with every file binary by the repository's own core.bigFileThreshold", () => {
    const result = history(
      { "README.md": "# repo\n" },
      {
        git: true,
        commits: [{ "conf.txt": added }, { "conf.txt": null }],
        prepare: (root) => git(root, "config", "core.bigFileThreshold", "1"),
      },
    );
    expect(result).toMatchObject({ verdict: "found", evidence: [{ path: "conf.txt" }] });
  });

  it("reads a secret added in resolving a merge, and removed after", () => {
    const result = history(
      { "README.md": "# repo\n" },
      {
        git: true,
        prepare: (root) => {
          const main = git(root, "symbolic-ref", "--short", "HEAD");
          git(root, "checkout", "-q", "-b", "side");
          writeFileSync(join(root, "side.txt"), "side\n");
          git(root, "add", "side.txt");
          git(root, "commit", "-qm", "side");
          git(root, "checkout", "-q", main);
          writeFileSync(join(root, "main.txt"), "main\n");
          git(root, "add", "main.txt");
          git(root, "commit", "-qm", "main");
          git(root, "merge", "-q", "--no-commit", "side");
          writeFileSync(join(root, "evil.txt"), added);
          git(root, "add", "evil.txt");
          git(root, "commit", "-qm", "merge");
          git(root, "rm", "-q", "evil.txt");
          git(root, "commit", "-qm", "gone");
        },
      },
    );
    expect(result).toMatchObject({ verdict: "found", evidence: [{ path: "evil.txt" }] });
  });

  it("says a shallow clone's history was not read whole", () => {
    const result = history(
      { "README.md": "# repo\n" },
      {
        git: true,
        commits: [{ "conf.txt": added }, { "conf.txt": null }, { "README.md": "# repo, later\n" }],
        // A shallow clone is one whose .git/shallow names the commits it was cut at.
        prepare: (root) =>
          writeFileSync(join(root, ".git", "shallow"), `${git(root, "rev-parse", "HEAD")}\n`),
      },
    );
    expect(result).toEqual({ verdict: "not-investigated", reason: historyShallow });
  });

  it("says a shallow clone's commit messages were not read whole, for the deny list", () => {
    const result = history(
      { "README.md": "# repo\n" },
      {
        git: true,
        commits: [{ "README.md": "# repo, later\n" }],
        prepare: (root) =>
          writeFileSync(join(root, ".git", "shallow"), `${git(root, "rev-parse", "HEAD")}\n`),
      },
      "names.deny",
    );
    expect(result).toEqual({ verdict: "not-investigated", reason: denyReasons.messagesShallow });
  });

  it("says the history could not be read when git log fails on a repository with refs and no HEAD", () => {
    const result = history(
      { "README.md": "# repo\n" },
      {
        git: true,
        commits: [{ "conf.txt": added }, { "conf.txt": null }],
        prepare: (root) => {
          git(root, "branch", "other");
          writeFileSync(join(root, ".git", "refs", "heads", "broken"), `${"0123456789".repeat(4)}\n`);
          git(root, "symbolic-ref", "HEAD", "refs/heads/nothing");
        },
      },
    );
    expect(result).toEqual({ verdict: "not-investigated", reason: historyUnreadable });
  });

  it("still reads a repository with no commits as no history", () => {
    const result = history({ "README.md": "# repo\n" }, { prepare: (root) => git(root, "init", "-q") });
    expect(result).toEqual({ verdict: "clean" });
  });
});
