import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The built bin, as `npm link` and `npx` run it. `npm test` builds first (pretest).
const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
  bin: Record<string, string>;
};
const bin = fileURLToPath(new URL(`../../${manifest.bin["code-sleuth"]}`, import.meta.url));

function sleuth(...args: string[]) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
}

describe("the built bin", () => {
  // The build sets the bit itself: a dist/ that is rebuilt, after a fresh clone or under an old npm link,
  // would otherwise leave the command a file npm cannot run.
  it.skipIf(process.platform === "win32")("is executable after the build", () => {
    expect(statSync(bin).mode & 0o777).toBe(0o755);
  });

  it.skipIf(process.platform === "win32")("runs as a program, through its own #! line", () => {
    const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${manifest.version}\n`);
  });

  it("prints the version from package.json", () => {
    const result = sleuth("--version");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${manifest.version}\n`);
  });

  it("exits 2 with one Error: and one Hint: line on an unknown flag", () => {
    const result = sleuth("--nope");
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^Error: .*\nHint: .*\n$/);
  });

  it("starts with a node shebang", () => {
    expect(readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
