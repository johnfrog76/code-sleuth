import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy as cliCopy } from "../../src/cli/copy.js";
import { copy as caseCopy } from "../../src/case/copy.js";
import { detectToolkit, probed } from "../../src/toolkit/detect.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { stubToolkit } from "../helpers/toolkit.js";

// #2: on Windows, PowerShell's execution policy can refuse the hand-off script, and that read as "ToolKit isn't
// here". Code Sleuth now asks the policy, says it blocked the script, and gives the person's own fix. It never
// changes the policy and never goes around it: no -ExecutionPolicy, ever.

const never = (calls: { argv: string[] }[]) =>
  calls
    .flatMap((c) => c.argv)
    .filter((a) => /executionpolicy|bypass/i.test(a) && a !== "Get-ExecutionPolicy");

describe("detection under an execution policy", () => {
  it.each(["Restricted", "AllSigned"] as const)(
    "reads %s as blocked, naming it, and goes no further",
    (policy) => {
      withScratch((scratch) => {
        const stub = stubToolkit(scratch, ["powershell.exe"], { policy });
        const detection = detectToolkit({ env: stub.env, askPolicy: true });
        expect(detection).toMatchObject({ state: "blocked", policy, shell: { name: "powershell.exe" } });
        expect(probed(detection)).toBe(true);
        expect(never(stub.calls())).toEqual([]);
      });
    },
  );

  it("reads a policy that would run the script, with no ToolKit, as not installed", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"], { policy: "RemoteSigned", probe: "absent" });
      expect(detectToolkit({ env: stub.env, askPolicy: true }).state).toBe("not-installed");
    });
  });

  it("asks the policy only when the probe failed: a found ToolKit costs one start, as before", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"], {});
      expect(detectToolkit({ env: stub.env, askPolicy: true }).state).toBe("detected");
      expect(stub.calls().map((c) => c.argv.includes("-Probe"))).toEqual([true]);
    });
  });

  it("does not ask off Windows, where the policy is not enforced", () => {
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"], { probe: "absent" });
      expect(detectToolkit({ env: stub.env, platform: "darwin" }).state).toBe("not-installed");
      expect(stub.calls().some((c) => c.argv.includes("Get-ExecutionPolicy"))).toBe(false);
    });
  });
});

describe("a run under a blocking policy", () => {
  const run = (extra: string[]) =>
    withScratch(async (scratch) => {
      const stub = stubToolkit(scratch, ["powershell.exe"], { policy: "Restricted" });
      const out = join(scratch, "cases");
      let result!: Awaited<ReturnType<typeof sleuth>>;
      await investigateAsync(
        "whole/bare",
        async (root) => {
          result = await sleuth([root, "--goal", "public", "--out", out, ...extra], {
            casesFolder: join(scratch, "default"),
            env: { ...stub.env, NO_COLOR: "1" },
            toolkitAskPolicy: true,
          });
        },
        { git: true },
      );
      const folder = existsSync(out) ? readdirSync(out).find((n) => n.startsWith("bare-")) : undefined;
      const latest =
        folder === undefined
          ? undefined
          : readdirSync(join(out, folder))
              .filter((n) => n.startsWith("20"))
              .sort()
              .at(-1);
      const file = (name: string) =>
        folder === undefined || latest === undefined
          ? ""
          : readFileSync(join(out, folder, latest, name), "utf8");
      return { result, calls: stub.calls(), caseJson: file("case.json"), caseMd: file("case.md") };
    });

  it("with --toolkit, is refused in one Error: line and one Hint: line, naming the person's own fix", async () => {
    const { result, calls } = await run(["--toolkit", "--yes"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(
      `Error: ${cliCopy.toolkit.policyBlocked("powershell.exe", "Restricted")}\nHint: ${cliCopy.toolkit.policyBlockedHint}\n`,
    );
    expect(never(calls)).toEqual([]);
  });

  it("without --toolkit, the case and the terminal say the policy stood in the way, not that ToolKit is missing", async () => {
    const { result, caseJson, caseMd } = await run([]);
    expect(result.code).toBe(0);
    const line = `ToolKit: ${caseCopy.toolkit.policyBlocked("powershell.exe", "Restricted")}`;
    expect((JSON.parse(caseJson) as { enhancements: { toolkit: unknown } }).enhancements.toolkit).toEqual({
      state: "blocked",
      shell: "powershell.exe",
      policy: "Restricted",
    });
    expect(caseMd).toContain(line);
    expect(result.stdout).not.toContain(caseCopy.toolkit.upsell);
  });
});
