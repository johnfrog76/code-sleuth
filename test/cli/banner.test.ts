import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER, BANNER_LINES } from "../../src/cli/banner.js";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

/** "The small banner" block of the design archive, exactly as written there. */
function archiveBlock(): string {
  const note = readFileSync(new URL("../../design/archive/the-sloth-in-ascii.md", import.meta.url), "utf8");
  const from = note.indexOf("## The small banner");
  const open = note.indexOf("```text\n", from) + "```text\n".length;
  return note.slice(open, note.indexOf("```\n", open));
}

describe("the --help banner", () => {
  it("is the design archive's small banner, byte for byte", () => {
    expect(BANNER).toBe(archiveBlock());
  });

  it("is 8 lines, at most 29 columns, printable ASCII with no tabs", () => {
    expect(BANNER_LINES).toHaveLength(8);
    for (const line of BANNER_LINES) {
      expect(line.length).toBeLessThanOrEqual(29);
      expect(line).toMatch(/^[\x20-\x7e]*$/);
    }
  });

  it("opens --help, above the usage, on stdout, with no colour", async () => {
    const { code, stdout, stderr } = await withScratch((casesFolder) =>
      sleuth(["--help"], { casesFolder, terminal: { stdin: true, stdout: true, stderr: true }, env: {} }),
    );
    expect(code).toBe(0);
    expect(stdout.startsWith(BANNER)).toBe(true);
    expect(stdout.indexOf("Usage")).toBeGreaterThan(BANNER.length);
    expect(stdout).not.toContain(String.fromCharCode(27));
    expect(stderr).toBe("");
  });

  it("is not printed by --version, by a refusal, by an investigation or with --json", async () => {
    const first = BANNER_LINES[0]!;
    const version = await withScratch((casesFolder) => sleuth(["--version"], { casesFolder }));
    expect(version.stdout + version.stderr).not.toContain(first);

    const refusal = await withScratch((casesFolder) => sleuth(["--nope"], { casesFolder }));
    expect(isRefusal(refusal)).toBe(true);
    expect(refusal.stderr).not.toContain(first);

    for (const extra of [[], ["--json"]]) {
      const run = await withScratch((out) =>
        investigateAsync("whole/kept", (root) =>
          sleuth([root, "--goal", "public", "--out", out, ...extra], { casesFolder: join(out, "default") }),
        ),
      );
      expect(run.code).toBe(0);
      expect(run.stdout + run.stderr).not.toContain(first);
    }
  });
});
