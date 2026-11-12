import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from "../../src/cli/copy.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { type Scenario, stubToolkit } from "../helpers/toolkit.js";

// Looking for ToolKit starts a PowerShell, which loads ToolKit if it is installed, and ToolKit may reach GitHub
// through gh. SECURITY.md promises the run names every call on its Out line, so the Out line names the probe
// whenever it started a PowerShell, whatever it found, and never when it started none.

async function outLines(shells: ("pwsh" | "powershell.exe")[], flags: string[], scenario: Scenario = {}) {
  return withScratch(async (scratch) => {
    const stub = stubToolkit(scratch, shells, scenario);
    return investigateAsync({ name: "widget", files: { "README.md": "# widget\n" } }, async (root) => {
      // The stub's PATH alone: no npm and no gh, so the probe is the only call there could be.
      const run = await sleuth([root, "--goal", "public", "--out", join(scratch, "cases"), ...flags], {
        casesFolder: join(scratch, "default"),
        env: { ...stub.env, NO_COLOR: "1" },
      });
      expect(run.code).toBe(0);
      return { stdout: run.stdout, calls: stub.calls().length };
    });
  });
}

describe("the Out line and looking for ToolKit", () => {
  it("names the probe when it found ToolKit", async () => {
    const { stdout, calls } = await outLines(["pwsh"], []);
    expect(calls).toBeGreaterThan(0);
    expect(stdout).toContain(copy.run.probeRan);
  });

  it("names the probe when it started PowerShell and found no ToolKit", async () => {
    const { stdout, calls } = await outLines(["pwsh"], [], { probe: "absent" });
    expect(calls).toBeGreaterThan(0);
    expect(stdout).toContain(copy.run.probeRan);
  });

  it("names no probe when there is no PowerShell to start", async () => {
    const { stdout, calls } = await outLines([], []);
    expect(calls).toBe(0);
    expect(stdout).not.toContain(copy.run.probeRan);
    expect(stdout).toContain(copy.run.nothingLeaves);
  });

  it("names no probe under --offline, which starts no PowerShell", async () => {
    const { stdout, calls } = await outLines(["pwsh"], ["--offline"]);
    expect(calls).toBe(0);
    expect(stdout).not.toContain(copy.run.probeRan);
    expect(stdout).toContain(copy.run.nothingLeaves);
  });
});
