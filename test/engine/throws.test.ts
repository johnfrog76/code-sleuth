import { describe, expect, it } from "vitest";
import type { Check } from "../../src/engine/check.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { checkFailed } from "../../src/engine/copy.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { investigate } from "../helpers/investigate.js";
import { SECRETS } from "../helpers/secrets.js";

// The code review's medium finding 16 (ENG-4): one check that threw ended the whole run with a stack trace.

describe("a check that throws", () => {
  it("reads not investigated, with what went wrong masked, and the next check still runs", () => {
    const token = SECRETS["github-token"]!.value;
    const throwing: Check = {
      ...CHECKS[0]!,
      id: "test.throws",
      run: () => {
        throw new Error(`EACCES: permission denied, open 'a.js' near ${token}`);
      },
    };
    investigate({ name: "widget", files: { "README.md": "# widget\n" } }, (repo, capabilities) => {
      const result = runCheck(throwing, repo, capabilities, secretHasher(Buffer.alloc(32)));
      expect(result.verdict).toBe("not-investigated");
      expect(result.verdict === "not-investigated" && result.reason).toMatch(/^This check stopped before/);
      expect(JSON.stringify(result)).not.toContain(token);
      expect(
        runCheck(
          CHECKS.find((c) => c.id === "docs.readme")!,
          repo,
          capabilities,
          secretHasher(Buffer.alloc(32)),
        ).verdict,
      ).not.toBe("not-investigated");
    });
  });

  it("says so in the copy's words", () => {
    expect(checkFailed("boom")).toBe(
      "This check stopped before it could read everything: boom. Nothing it found is counted.",
    );
  });
});
