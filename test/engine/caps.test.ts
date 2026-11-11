import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LARGE } from "../../src/engine/checks/files.large.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { tooLargeReasons } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { MAX_ADDED_LINES, MAX_HISTORY_BYTES, MAX_TEXT_BYTES } from "../../src/engine/repo.js";
import { sleuth } from "../helpers/cli.js";
import { investigate, investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// ETU3 card 4b: a repository cannot ask more memory of the machine than a laptop has. A text file over the
// files.large threshold is not read, and the history is read up to a size; past either, a check that would read
// clean reads not investigated, and a run ends in a sentence, never a crash.

const run = (id: string, files: Record<string, string>, options: { git?: boolean } = {}) =>
  investigate(
    { name: "widget", files },
    (repo, capabilities) =>
      runCheck(
        CHECKS.find((c) => c.id === id)!,
        repo,
        capabilities,
        secretHasher(Buffer.alloc(32)),
      ),
    options,
  );

describe("a text file over the size it is read up to", () => {
  it("is the files.large threshold", () => {
    expect(MAX_TEXT_BYTES).toBe(LARGE);
  });

  it("is not read, and a text check that would read clean says so", () => {
    const big = "plain words\n".repeat(Math.ceil((MAX_TEXT_BYTES + 1) / 12));
    expect(run("secrets.tree", { "notes.txt": big, "small.txt": "hello\n" })).toEqual({
      verdict: "not-investigated",
      reason: tooLargeReasons.text("notes.txt", 0),
    });
    expect(run("files.large", { "notes.txt": big }).verdict).toBe("found");
  });

  it("leaves a large binary file to files.large: text checks never read it, so they still read clean", () => {
    const binary = `\0${"x".repeat(MAX_TEXT_BYTES + 1)}`;
    expect(run("secrets.tree", { "image.bin": binary }).verdict).toBe("clean");
  });

  it("still finds what is in the files it does read", () => {
    const big = "plain words\n".repeat(Math.ceil((MAX_TEXT_BYTES + 1) / 12));
    const marker = ["TO", "DO"].join(""); // assembled, so this file holds no note-to-self of its own
    const result = run("quality.markers", { "notes.txt": big, "src/a.ts": `// ${marker}: later\n` });
    expect(result.verdict).toBe("found");
  });
});

describe("a history over the size it is read up to", () => {
  it("is 64 MB of git's output or two million added lines", () => {
    expect(MAX_HISTORY_BYTES).toBe(64 * 1024 * 1024);
    expect(MAX_ADDED_LINES).toBe(2_000_000);
  });

  it("reads not investigated, saying the history is larger than it reads, and the run ends in a sentence", async () => {
    // Just over two million added lines, in a file under the text cap: the tree is read, the history is not.
    const lines = "a\n".repeat(MAX_ADDED_LINES + 10);
    expect(run("secrets.history", { "a.txt": lines }, { git: true })).toEqual({
      verdict: "not-investigated",
      reason: tooLargeReasons.history,
    });
    await withScratch(async (scratch) => {
      await investigateAsync(
        { name: "widget", files: { "a.txt": lines } },
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--offline", "--out", join(scratch, "cases")],
            {
              casesFolder: join(scratch, "default"),
              env: { NO_COLOR: "1" },
            },
          );
          expect(result.code).toBe(0);
          expect(result.stdout).toContain("secrets.history");
          expect(result.stdout).toContain(tooLargeReasons.history);
        },
        { git: true },
      );
    });
  }, 60_000);
});
