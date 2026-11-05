import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { maskSecrets } from "../../src/engine/secrets/scan.js";
import { sleuth } from "../helpers/cli.js";
import { investigate, investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { filler, SECRETS } from "../helpers/secrets.js";

// The code review's high findings 6a to 6d: four ways a secret's value still reached output in clear.

const github = SECRETS["github-token"]!.value;

/** True when any twelve characters in a row of the value's body show in the text. */
function leaks(text: string, value: string): boolean {
  const body = value.slice(4);
  for (let i = 0; i + 12 <= body.length; i++) if (text.includes(body.slice(i, i + 12))) return true;
  return false;
}

function check(id: string, files: Record<string, string>) {
  return investigate({ name: "widget", files }, (repo, capabilities) =>
    runCheck(
      CHECKS.find((c) => c.id === id)!,
      repo,
      capabilities,
      secretHasher(Buffer.alloc(32)),
    ),
  );
}

const excerpts = (result: ReturnType<typeof check>) =>
  result.verdict === "found" ? result.evidence.map((e) => e.excerpt ?? "").join("\n") : "";

describe("a secret on a line another check reports, cut at the excerpt's limit", () => {
  it.each([
    ["quality.markers", (v: string) => `// TODO rotate ${"x".repeat(123)} ${v}`], // code-sleuth:example
    ["paths.machine", (v: string) => `const p = "/Users/alice/proj"; ${"x".repeat(80)} const k = "${v}";`], // code-sleuth:example
  ])("is masked before %s's excerpt is cut", (id, line) => {
    const result = check(id, { "a.js": `${line(github)}\n` });
    expect(result.verdict).toBe("found");
    expect(leaks(excerpts(result), github)).toBe(false);
  });

  it("masks a guess from a name past the limit too", () => {
    const value = SECRETS["assigned-secret"]!.value;
    const result = check("quality.markers", {
      "a.js": `// TODO ${"x".repeat(110)} client_secret=${value}\n`, // code-sleuth:example
    });
    expect(leaks(excerpts(result), value)).toBe(false);
  });
});

describe("a reason that quotes the repository", () => {
  const files = {
    "package.json": JSON.stringify({ name: "widget", version: "1.0.0", license: github }),
    LICENSE: "Custom terms of my own.\n",
  };

  it("is masked in the check's result", () => {
    const result = check("license.file", files);
    expect(result.verdict).toBe("not-investigated");
    expect(result.verdict === "not-investigated" && leaks(result.reason, github)).toBe(false);
  });

  it("is masked on the terminal and in every file of the case", () =>
    withScratch((scratch) =>
      investigateAsync(
        { name: "widget", files },
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--offline", "--out", join(scratch, "cases")],
            {
              casesFolder: join(scratch, "default"),
            },
          );
          expect(leaks(result.stdout + result.stderr, github)).toBe(false);
          const cases = join(scratch, "cases");
          const written = (readdirSync(cases, { recursive: true }) as string[])
            .map((name) => {
              try {
                return readFileSync(join(cases, name), "utf8");
              } catch {
                return "";
              }
            })
            .join("\n");
          expect(written).toContain("license.file");
          expect(leaks(written, github)).toBe(false);
        },
        { git: true },
      ),
    ));
});

describe("matches that overlap", () => {
  it("masks an access key id and the secret that runs on from it, whole", () => {
    const secret = filler(51, 40);
    const line = `aws_secret=${SECRETS["aws-access-key-id"]!.value}/${secret}`;
    expect(leaks(maskSecrets(line, "a.txt"), secret)).toBe(false);
    const result = check("secrets.tree", { "conf.txt": `${line}\n` });
    expect(leaks(excerpts(result), secret)).toBe(false);
  });

  it("masks two known values that run into each other, whole", () => {
    const anthropic = SECRETS["anthropic-key"]!.value;
    const line = `${SECRETS["slack-token"]!.value.slice(0, 18)}${anthropic}`;
    expect(leaks(maskSecrets(line, "a.txt"), anthropic)).toBe(false);
  });
});

describe("an .npmrc token", () => {
  it("is spliced out at its own place, so a $& in it pastes nothing back", () => {
    const token = `9f3c2a71-4be1-4d0e-a8b2-${filler(52, 10)}$&`;
    const result = check("files.sensitive", {
      ".npmrc": `//registry.example.invalid/:_authToken=${token}\n`,
    });
    expect(result.verdict).toBe("found");
    expect(excerpts(result)).toBe("//registry.example.invalid/:_authToken=9f3c****$&");
  });
});
