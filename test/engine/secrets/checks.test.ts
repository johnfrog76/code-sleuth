import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Result } from "../../../src/engine/check.js";
import { runGoal, secretHasher } from "../../../src/engine/engine.js";
import { findGoal, type Goal } from "../../../src/engine/goals.js";
import { mask } from "../../../src/engine/secrets/scan.js";
import { type BuiltFixture, investigate, type InvestigateOptions } from "../../helpers/investigate.js";
import { privateKey, SECRETS } from "../../helpers/secrets.js";

const context = secretHasher(Buffer.alloc(32, 7));
const github = SECRETS["github-token"]!;
const guess = SECRETS["assigned-secret"]!;

function outcome(
  checkId: string,
  fixture: BuiltFixture,
  options: InvestigateOptions = {},
  goal = findGoal("public")!,
) {
  const only: Goal = { id: goal.id, checks: goal.checks.filter((c) => c.id === checkId) };
  return investigate(
    fixture,
    (repo, capabilities) => runGoal(only, repo, capabilities, { context })[0]!,
    options,
  );
}

function evidenceOf(result: Result) {
  if (result.verdict !== "found") throw new Error(`expected found, got ${result.verdict}`);
  return result.evidence;
}

describe("secrets.tree", () => {
  it("is a smoking gun for a token in a tracked file, under the public-facing goal and security", () => {
    for (const goal of ["public", "security"]) {
      const o = outcome(
        "secrets.tree",
        { name: "repo", files: { "config.ts": github.line(github.value) } },
        { git: true },
        findGoal(goal),
      );
      expect(o.weight).toBe("smoking-gun");
    }
  });

  it("reads tracked files only, inside a repository", () => {
    const o = outcome(
      "secrets.tree",
      { name: "repo", files: { "a.txt": "nothing\n" } },
      { git: true, prepare: (root) => writeFileSync(join(root, "untracked.ts"), github.line(github.value)) },
    );
    expect(o.result.verdict).toBe("clean");
  });

  it("skips binary files and the build folders", () => {
    const o = outcome("secrets.tree", {
      name: "repo",
      files: {
        "image.bin": `\0\0${github.value}`,
        "node_modules/pkg/index.js": github.line(github.value),
        "dist/out.js": github.line(github.value),
      },
    });
    expect(o.result.verdict).toBe("clean");
  });

  it("weighs a guess from a name one step down", () => {
    const o = outcome("secrets.tree", { name: "repo", files: { "app.yml": guess.line(guess.value) } });
    expect(o.weight).toBe("loose-end");
    expect(evidenceOf(o.result)[0]!.weighed).toBe("name-guess");
  });

  it.each([
    ["test/fixtures/config.ts", github.line(github.value)],
    ["src/__fixtures__/config.ts", github.line(github.value)],
    ["docs/example.md", `${github.line(github.value)} // code-sleuth:example`],
  ])("shows a secret in an example location (%s), and does not count it", (path, text) => {
    const o = outcome("secrets.tree", { name: "repo", files: { [path]: text } });
    expect(o.result).toEqual({ verdict: "clean" });
    expect(o.examples.map((e) => [e.path, e.rule])).toEqual([[path, "github-token"]]);
    expect(JSON.stringify(o.examples)).not.toContain(github.value);
  });

  it("still finds a real secret beside an example, on the real one's evidence alone", () => {
    const o = outcome("secrets.tree", {
      name: "repo",
      files: { "test/fixtures/a.ts": github.line(github.value), "src/b.ts": github.line(github.value) },
    });
    expect(o.weight).toBe("smoking-gun");
    expect(evidenceOf(o.result).map((e) => e.path)).toEqual(["src/b.ts"]);
    expect(o.examples.map((e) => e.path)).toEqual(["test/fixtures/a.ts"]);
  });

  it("gives the same secret the same hash, and never stores it", () => {
    const o = outcome("secrets.tree", {
      name: "repo",
      files: { "a.ts": github.line(github.value), "b.ts": github.line(github.value) },
    });
    const [a, b] = evidenceOf(o.result);
    expect(a!.valueHash).toMatch(/^hmac-sha256:[0-9a-f]{64}$/);
    expect(a!.valueHash).toBe(b!.valueHash);
    expect(JSON.stringify(o)).not.toContain(github.value);
  });
});

describe("secrets.history", () => {
  it("finds a secret removed from the tree, with the commit that added it", () => {
    const o = outcome(
      "secrets.history",
      { name: "repo", files: { "README.md": "# Widget\n" } },
      {
        git: true,
        commits: [{ "config.ts": `// settings\n${github.line(github.value)}\n` }, { "config.ts": null }],
      },
    );
    const [piece, ...rest] = evidenceOf(o.result);
    expect(rest).toEqual([]);
    expect(piece).toMatchObject({
      path: "config.ts",
      line: 2,
      rule: "github-token",
      excerpt: `const token = "${mask(github.value)}";`,
    });
    expect(piece!.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(o.weight).toBe("smoking-gun");
  });

  it("reports a secret once per file, at the oldest commit that added it", () => {
    const o = outcome(
      "secrets.history",
      { name: "repo", files: { "a.ts": github.line(github.value) } },
      { git: true, commits: [{ "a.ts": `// moved\n${github.line(github.value)}\n` }] },
    );
    expect(evidenceOf(o.result).map((e) => e.line)).toEqual([1]);
  });

  it("reads an added line that itself starts with ++ as content", () => {
    const o = outcome(
      "secrets.history",
      { name: "repo", files: { "a.txt": "start\n" } },
      { git: true, commits: [{ "a.txt": `start\n++ ${github.value}\n` }] },
    );
    expect(evidenceOf(o.result).map((e) => [e.path, e.line])).toEqual([["a.txt", 2]]);
  });

  it("hashes a private key's block from the lines its commit added", () => {
    const key = privateKey(31);
    const o = outcome("secrets.history", { name: "repo", files: { "key.txt": key.text } }, { git: true });
    const [piece] = evidenceOf(o.result);
    expect(piece!.valueHash).toBe(context.hashSecret(key.text.trimEnd()));
    expect(JSON.stringify(o)).not.toContain(key.body);
  });

  it("is clean in a repository with no commits", () => {
    const o = outcome(
      "secrets.history",
      { name: "repo", files: { "a.txt": github.line(github.value) } },
      {
        git: true,
        prepare: (root) => {
          // Start the history over: a repository with no commits yet.
          rmSync(join(root, ".git"), { recursive: true, force: true });
          spawnSync("git", ["init", "-q"], { cwd: root });
        },
      },
    );
    expect(o.result.verdict).toBe("clean");
  });

  it("is not investigated outside git", () => {
    const o = outcome("secrets.history", { name: "repo", files: { "a.txt": "x\n" } });
    expect(o.result.verdict).toBe("not-investigated");
  });
});

describe("files.sensitive", () => {
  it.each([
    ".env",
    ".env.local",
    "config/.env.production",
    "certs/server.pem",
    "a.p12",
    "b.key",
    "release.keystore",
    "id_rsa",
    "id_rsa_deploy",
  ])("finds %s", (path) => {
    const o = outcome("files.sensitive", { name: "repo", files: { [path]: "x\n" } });
    expect(evidenceOf(o.result).map((e) => e.path)).toEqual([path]);
    expect(o.weight).toBe("smoking-gun");
  });

  it.each([".env.example", "id_rsa.pub", "keys.md", "env.ts", ".npmrc"])("lets %s through", (path) => {
    const o = outcome("files.sensitive", {
      name: "repo",
      files: { [path]: "registry=https://registry.npmjs.org/\n" },
    });
    expect(o.result.verdict).toBe("clean");
  });

  it("finds an .npmrc holding a token, masked and hashed", () => {
    const token = SECRETS["npm-token"]!.value;
    const o = outcome("files.sensitive", {
      name: "repo",
      files: { ".npmrc": `//registry.npmjs.org/:_authToken=${token}\n` },
    });
    const [piece] = evidenceOf(o.result);
    expect(piece).toMatchObject({
      path: ".npmrc",
      line: 1,
      rule: "npmrc-token",
      excerpt: `//registry.npmjs.org/:_authToken=${mask(token)}`,
    });
    expect(JSON.stringify(o)).not.toContain(token);
  });

  it("lets an .npmrc that reads its token from the environment through", () => {
    const o = outcome("files.sensitive", {
      name: "repo",
      files: { ".npmrc": "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n" },
    });
    expect(o.result.verdict).toBe("clean");
  });

  it("shows a key file under an example folder, and does not count it", () => {
    const o = outcome("files.sensitive", { name: "repo", files: { "test/fixtures/tls/server.pem": "x\n" } });
    expect(o.result).toEqual({ verdict: "clean" });
    expect(o.examples.map((e) => e.path)).toEqual(["test/fixtures/tls/server.pem"]);
  });
});
