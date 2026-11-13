import { describe, expect, it } from "vitest";
import { detectToolkit } from "../../src/toolkit/detect.js";
import { executionPolicy, findShell } from "../../src/toolkit/shell.js";

/**
 * #2, on a real Windows: the machine's own PowerShell, with its policy set to Restricted for the account, reads as
 * blocked, naming the policy, never as "ToolKit isn't here". CI's windows-policy job sets the policy and
 * CODE_SLEUTH_POLICY_TEST; anywhere else the suite says it skipped this, and why.
 */
const ON = process.platform === "win32" && process.env.CODE_SLEUTH_POLICY_TEST === "Restricted";

describe.skipIf(!ON)(
  "the execution policy, for real (runs only on Windows with CODE_SLEUTH_POLICY_TEST=Restricted, as CI's windows-policy job sets it)",
  () => {
    it("reads Restricted from the machine's own PowerShell, and detection says it blocked the hand-off", () => {
      const shell = findShell(process.env)!;
      expect(shell).toBeDefined();
      expect(executionPolicy(shell, process.env)).toBe("Restricted");
      expect(detectToolkit({ env: process.env })).toMatchObject({ state: "blocked", policy: "Restricted" });
    }, 60_000);
  },
);
