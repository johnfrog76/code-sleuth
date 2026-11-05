import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { investigate } from "../helpers/investigate.js";
import { SECRETS } from "../helpers/secrets.js";

const check = (id: string, files: Record<string, string>, options = {}) =>
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

describe("the code review's low findings, in the engine", () => {
  it.each([
    '//registry.npmjs.org/:_authToken="${NPM_TOKEN}"',
    "//registry.npmjs.org/:_authToken='${NPM_TOKEN}'",
  ])("reads a quoted environment reference as the fix, not a token: %s (SEC-10)", (line) => {
    expect(check("files.sensitive", { ".npmrc": `${line}\n` })).toEqual({ verdict: "clean" });
  });

  it("reads README.md, not a translation that sorts ahead of it (findDoc)", () => {
    const readme = ["# widget", "", "## Install", ...Array.from({ length: 10 }, (_, i) => `line ${i}`)].join(
      "\n",
    );
    expect(check("docs.readme", { "README-ja.md": "# 日本語\n", "README.md": `${readme}\n` })).toEqual({
      verdict: "clean",
    });
  });

  it("names a secret's file in history by its real name, a tab in it (SEC-11)", () => {
    const github = SECRETS["github-token"]!;
    const result = check(
      "secrets.history",
      { "README.md": "# widget\n" },
      { git: true, commits: [{ "a\tb.txt": `${github.line(github.value)}\n` }, { "a\tb.txt": null }] },
    );
    expect(result).toMatchObject({ verdict: "found", evidence: [{ path: "a\tb.txt" }] });
  });
});
