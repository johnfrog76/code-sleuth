import { describe, expect, it } from "vitest";
import { CHECKS } from "../../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../../src/engine/engine.js";
import { SECRET_RULES } from "../../../src/engine/secrets/rules.js";
import { entropy, mask, maskedExcerpt, matchLine } from "../../../src/engine/secrets/scan.js";
import { investigate } from "../../helpers/investigate.js";
import { privateKey, SECRETS } from "../../helpers/secrets.js";

const tree = CHECKS.find((c) => c.id === "secrets.tree")!;
const context = secretHasher(Buffer.alloc(32, 7));

describe("every secret rule", () => {
  it("has a fixture, unless it is the private-key rule, which has its own", () => {
    for (const rule of SECRET_RULES) {
      if (rule.id !== "private-key") expect(Object.keys(SECRETS)).toContain(rule.id);
    }
  });

  it("is a pattern every engine reads alike: no lookbehind, no inline flags, no named groups", () => {
    for (const rule of SECRET_RULES) expect(rule.pattern).not.toMatch(/\(\?<|\(\?[a-z]/);
  });
});

describe.each(Object.entries(SECRETS))("%s", (ruleId, { value, line, miss }) => {
  it("matches in a fixture, and its near miss does not", () => {
    const result = investigate(
      { name: "repo", files: { "match.txt": `${line(value)}\n`, "miss.txt": `${miss}\n` } },
      (repo) => runCheck(tree, repo, new Set(), context),
    );
    expect(result.verdict).toBe("found");
    if (result.verdict !== "found") return;
    expect(result.evidence.map((e) => [e.path, e.line, e.rule])).toEqual([["match.txt", 1, ruleId]]);
    expect(result.evidence[0]!.excerpt).not.toContain(value);
    expect(result.evidence[0]!.excerpt).toContain(mask(value));
  });
});

describe("the private-key rule", () => {
  it("shows the header, never the key, and hashes the whole block", () => {
    const one = privateKey(21);
    const two = privateKey(22);
    const result = investigate(
      { name: "repo", files: { "one.pem.txt": one.text, "two.txt": two.text } },
      (repo) => runCheck(tree, repo, new Set(), context),
    );
    if (result.verdict !== "found") throw new Error("expected a finding");
    expect(result.evidence.map((e) => e.excerpt)).toEqual([one.header, two.header]);
    expect(JSON.stringify(result)).not.toContain(one.body);
    expect(result.evidence[0]!.valueHash).not.toBe(result.evidence[1]!.valueHash);
  });

  it("does not match a public key", () => {
    expect(matchLine("-----BEGIN PUBLIC KEY-----", "a.txt")).toEqual([]);
  });
});

describe("masking", () => {
  it("keeps the first four and the last two characters", () => {
    expect(mask("ghp_abcdefghijklmnop9f")).toBe("ghp_****9f");
    expect(mask("short")).toBe("****");
  });

  it("masks every value on a line, and cuts a long line around the first", () => {
    const a = SECRETS["github-token"]!.value;
    const b = SECRETS["npm-token"]!.value;
    const text = `${"x".repeat(300)} ${a} and ${b}`;
    const excerpt = maskedExcerpt(text, matchLine(text, "a.txt"));
    expect(excerpt).not.toContain(a);
    expect(excerpt).not.toContain(b);
    expect(excerpt).toContain(mask(a));
    expect(excerpt.length).toBeLessThanOrEqual(166);
  });
});

describe("the name-guess rule", () => {
  it("needs a random-looking value", () => {
    expect(entropy("aaaaaaaaaaaaaaaa")).toBe(0);
    expect(matchLine(`password = "${"hunter2".repeat(4)}"`, "a.txt")).toEqual([]);
    expect(
      matchLine(`password = "${SECRETS["assigned-secret"]!.value}"`, "a.txt").map((m) => m.rule.id),
    ).toEqual(["assigned-secret"]);
  });

  it("does not match a value a known rule already matched", () => {
    const line = `const token = "${SECRETS["github-token"]!.value}";`;
    expect(matchLine(line, "a.txt").map((m) => m.rule.id)).toEqual(["github-token"]);
  });

  it("does not read lockfiles, whose integrity hashes look random", () => {
    const line = `"secretIntegrity": "${SECRETS["assigned-secret"]!.value}"`;
    expect(matchLine(line, "package-lock.json")).toEqual([]);
    expect(matchLine(line, "config.json")).toHaveLength(1);
  });
});

describe("the name-guess rule reads literals, not code", () => {
  // The shapes that read as secrets in real repositories, and are code.
  it.each([
    [
      "a design-token property path in a ternary",
      "color: check.ok ? tokens.colorNeutralForeground3 : tokens.colorNeutralForeground1,",
    ],
    ["a property path assigned", "const token = theme.tokens.colorPaletteRedForeground1;"],
    ["a function call with arguments", "$tokenRead = Invoke-P20TrackerRead 'az' $azArgs"],
    ["an expression", "const secret = buildSecret2024Value + suffix;"],
  ])("lets %s through", (_, line) => {
    expect(matchLine(line, "src/a.ts").filter((m) => m.rule.id === "assigned-secret")).toEqual([]);
  });

  const random = SECRETS["assigned-secret"]!.value;
  it.each([
    ["a quoted value", `client_secret: "${random}"`],
    ["a single-quoted value", `api_key = '${random}'`],
    ["an unquoted value that ends its line, as in .env", `API_KEY=${random}`],
    ["an unquoted YAML value", `  auth_token: ${random}`],
    ["an unquoted value with a trailing comment", `SECRET=${random} # rotate me`],
    [
      "an unquoted JWT, dotted but not a property path",
      `ACCESS_TOKEN=eyJ${random.slice(0, 20)}.eyJ${random.slice(10, 30)}.sig${random.slice(5, 25)}`,
    ],
  ])("still finds %s", (_, line) => {
    expect(matchLine(line, "config/.env").map((m) => m.rule.id)).toContain("assigned-secret");
  });
});

describe("secrets.tree and secrets.history over code that reads like a secret", () => {
  it("reads both shapes Clean, in the tree and in history", () => {
    const files = {
      "web/EnvCard.tsx":
        "color: check.ok ? tokens.colorNeutralForeground3 : tokens.colorNeutralForeground1,\n",
      "Scripts/Publish.ps1": "$tokenRead = Invoke-P20TrackerRead 'az' $azArgs\n",
    };
    for (const id of ["secrets.tree", "secrets.history"]) {
      const check = CHECKS.find((c) => c.id === id)!;
      const result = investigate(
        { name: "repo", files },
        (repo, capabilities) => runCheck(check, repo, capabilities, context),
        { git: true },
      );
      expect(result.verdict, id).toBe("clean");
    }
  });
});
