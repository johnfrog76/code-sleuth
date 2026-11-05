import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { copyCommand, shownPath } from "../../src/cli/keyFile.js";
import { unquoted } from "../../src/engine/repo.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's low findings, swept.

describe("the PowerShell copy line (POL-11)", () => {
  it("doubles a curly apostrophe as it doubles a straight one", () => {
    const line = copyCommand(
      "C:\\code\\.env.example",
      "C:\\Users\\O\u2019Brien\\AppData\\Local\\code-sleuth\\.env",
      "win32",
    );
    expect(line).toContain("O\u2019\u2019Brien");
  });

  const hasPwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"], { stdio: "ignore" }).status === 0;
  it.skipIf(!hasPwsh)("is a line PowerShell parses whole", () => {
    const line = copyCommand("C:\\code\\.env.example", "C:\\Users\\O\u2019Brien\\.env", "win32");
    const parsed = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-Command",
        "$e = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($env:LINE, [ref]$null, [ref]$e); $e.Count",
      ],
      { env: { ...process.env, LINE: line }, encoding: "utf8" },
    );
    expect(parsed.stdout.trim()).toBe("0");
  });
});

describe("a path shown from home (POL-12)", () => {
  it("shows a path on another Windows drive whole, not under ~", () => {
    expect(shownPath("D:\\Data\\code-sleuth\\.env", "C:\\Users\\me", win32)).toBe(
      "D:\\Data\\code-sleuth\\.env",
    );
    expect(shownPath("C:\\Users\\me\\AppData\\code-sleuth\\.env", "C:\\Users\\me", win32)).toBe(
      "~\\AppData\\code-sleuth\\.env",
    );
    expect(shownPath("C:\\Users\\me..x\\a", "C:\\Users\\me", win32)).toBe("C:\\Users\\me..x\\a");
  });
});

describe("a history path git quotes (SEC-11)", () => {
  it.each([
    ['"b/a\\tb.txt"', "b/a\tb.txt"],
    ['"b/say \\"hi\\".txt"', 'b/say "hi".txt'],
    ['"b/caf\\303\\251.txt"', "b/café.txt"],
    ["b/plain.txt", "b/plain.txt"],
  ])("reads %s as %j", (quoted, path) => {
    expect(unquoted(quoted)).toBe(path);
  });
});

describe("a case's files (CASE-8)", () => {
  it.skipIf(process.platform === "win32")("are the person's own to read: folders 0700, files 0600", () =>
    withScratch((scratch) =>
      investigateAsync({ name: "widget", files: { "README.md": "# widget\n" } }, async (root) => {
        const out = join(scratch, "cases");
        await sleuth([root, "--goal", "public", "--offline", "--all", "--out", out], {
          casesFolder: join(scratch, "default"),
        });
        for (const name of readdirSync(out, { recursive: true }) as string[]) {
          const stat = statSync(join(out, name));
          expect(stat.mode & 0o077, name).toBe(0);
        }
      }),
    ),
  );
});
