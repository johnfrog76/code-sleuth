import { cpSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectToolkit } from "../../src/toolkit/detect.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

/**
 * The hand-off against a real ToolKit, when CODE_SLEUTH_TOOLKIT names a checkout. Cards go into a scratch
 * copy of ToolKit's sample hub, never a real one: the test reads the hub ToolKit resolved and stops unless
 * it is the scratch copy. Without the variable, the suite says it skipped this, and why.
 */
const CHECKOUT = process.env.CODE_SLEUTH_TOOLKIT;
const ON_WINDOWS = process.platform === "win32";

/** The process's own environment, less every override a ToolKit shell would read. */
function cleanEnv(hub: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PROMPTS_ROOT: hub };
  delete env.P20_ACTIVE_SPACE;
  for (const name of Object.keys(env)) if (name.startsWith("TEAMS_WEBHOOK_")) delete env[name];
  return env;
}

describe.skipIf(!CHECKOUT)(
  "the hand-off, for real (skipped: set CODE_SLEUTH_TOOLKIT to a ToolKit checkout to run it)",
  () => {
    it("files real cards: backlog/ on a local Space, current/ on an Azure DevOps Space, body in place", async () => {
      await withScratch(async (scratch) => {
        // The scratch hub: ToolKit's sample, plus one Space whose address is Azure DevOps, where a card starts in play.
        const hub = join(scratch, "hub");
        cpSync(join(CHECKOUT!, "samples", "hub"), hub, { recursive: true });
        const hubJson = JSON.parse(readFileSync(join(hub, "hub.json"), "utf8")) as { spaces: object[] };
        hubJson.spaces.push({
          slug: "ado-scratch",
          name: "ADO scratch",
          status: "local",
          orgType: "portfolio",
          org: "https://dev.azure.com/example-org",
          tenant: "",
          promptsFolder: "ado-scratch",
          projects: [],
        });
        writeFileSync(join(hub, "hub.json"), JSON.stringify(hubJson, null, 2));
        mkdirSync(join(hub, "ado-scratch"));
        const env = cleanEnv(hub);

        // The guard: never file unless ToolKit resolved the scratch hub.
        const probe = detectToolkit({ env, moduleRoot: CHECKOUT!, space: "demo" });
        expect(probe.state).toBe("detected");
        if (probe.state !== "detected") return;
        expect(realpathSync(probe.root!)).toBe(realpathSync(hub));

        const cards = (space: string, lane: string) => {
          try {
            return readdirSync(join(hub, space, lane)).filter(
              (f) => f.endsWith(".prompt.md") && !f.includes("start-here"),
            );
          } catch {
            return [];
          }
        };

        await investigateAsync(
          "whole/bare",
          async (root) => {
            for (const space of ["demo", "ado-scratch"]) {
              const result = await sleuth(
                [
                  root,
                  "--goal",
                  "public",
                  "--out",
                  join(scratch, "cases"),
                  "--toolkit",
                  "--yes",
                  "--refile",
                  "--toolkit-space",
                  space,
                ],
                { casesFolder: join(scratch, "default"), env, toolkitModuleRoot: CHECKOUT! },
              );
              expect(result.code, result.stderr).toBe(0);
              expect(result.stdout).toMatch(/^ {2}Filed {4}license\.file as Bug [A-Z0-9]{4}, in /m);
            }
          },
          { git: true },
        );

        const local = cards("demo", "backlog");
        const ado = cards("ado-scratch", "current");
        expect(local.length).toBeGreaterThan(1);
        expect(ado).toHaveLength(local.length);

        for (const [space, lane, files] of [
          ["demo", "backlog", local],
          ["ado-scratch", "current", ado],
        ] as const) {
          for (const file of files) {
            const text = readFileSync(join(hub, space, lane, file), "utf8");
            const bug = /^# Bug /.test(text);
            // A Task's description is its Context; a Bug's is its Summary. Its checkboxes are ToolKit's to count.
            const section =
              new RegExp(`## ${bug ? "Summary" : "Context"}\\n([\\s\\S]*?)\\n## `).exec(text)?.[1] ?? "";
            expect(section, file).toContain("Found by Code Sleuth: ");
            expect(section, file).toMatch(
              /^- \[ \] `code-sleuth --goal public` reads `[a-z.]+` as Clean\.$/m,
            );
            expect(text.charCodeAt(0)).not.toBe(0xfeff);
          }
        }
      });
      // Each card is a fresh PowerShell loading ToolKit: seconds each, not milliseconds.
    }, 300_000);

    it.skipIf(!ON_WINDOWS)("runs handoff.ps1 under Windows PowerShell 5.1 (Windows only)", () => {
      withScratch((scratch) => {
        const hub = join(scratch, "hub");
        cpSync(join(CHECKOUT!, "samples", "hub"), hub, { recursive: true });
        const env = {
          ...cleanEnv(hub),
          PATH: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0`,
        };
        const probe = detectToolkit({ env, moduleRoot: CHECKOUT!, space: "demo" });
        expect(probe).toMatchObject({ state: "detected", shell: { name: "powershell.exe" }, space: "demo" });
      });
    });
  },
);
