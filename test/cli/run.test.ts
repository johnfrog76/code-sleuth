import { describe, expect, it } from "vitest";
import { Refusal, refuse } from "../../src/cli/refusal.js";
import { version } from "../../src/version.js";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { withScratch } from "../helpers/scratch.js";

const capture = (argv: string[]) => withScratch((casesFolder) => sleuth(argv, { casesFolder }));

describe("the CLI", () => {
  it("prints the package version with --version", async () => {
    const { code, stdout, stderr } = await capture(["--version"]);
    expect(code).toBe(0);
    expect(stdout).toBe(`${version()}\n`);
    expect(stderr).toBe("");
  });

  it("prints help with --help", async () => {
    const { code, stdout } = await capture(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("So, you want to know what's going on with your repo?");
    expect(stdout).toContain("--fail-on");
  });

  it.each([["--nope"], ["-x"], ["--version=1"], ["one", "two"]])(
    "refuses %s with exit 2",
    async (...argv) => {
      expect(isRefusal(await capture(argv))).toBe(true);
    },
  );

  it("names the unknown flag", async () => {
    expect((await capture(["--nope"])).stderr).toContain("--nope");
  });
});

describe("refuse", () => {
  it("prints one Error: line and one Hint: line and returns 2", () => {
    let stderr = "";
    const code = refuse(new Refusal("Not a folder.", "Point me at a folder."), {
      stdout: () => expect.fail("nothing on stdout"),
      stderr: (t) => (stderr += t),
    });
    expect(code).toBe(2);
    expect(stderr).toBe("Error: Not a folder.\nHint: Point me at a folder.\n");
  });
});

describe("code-sleuth checks", () => {
  it("lists every check with its weight per goal", async () => {
    const { code, stdout, stderr } = await capture(["checks"]);
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.split("\n")[0]).toMatch(/^Check\s+Title\s+Needs\s+Public facing\s+Security\s+Quality$/);
    expect(stdout).toMatch(/^docs\.conduct\s+A code of conduct\s+--\s+loose end\s+--\s+--$/m);
    expect(stdout).toMatch(/^docs\.changelog\s+A changelog\s+--\s+hunch\s+--\s+hunch$/m);
  });

  it("lists one goal's checks, in its order, with its weight", async () => {
    const { code, stdout } = await capture(["checks", "--goal", "public"]);
    expect(code).toBe(0);
    const lines = stdout.trimEnd().split("\n");
    expect(lines[0]).toMatch(/^Check\s+Title\s+Needs\s+Weight$/);
    expect(lines.slice(1).map((line) => line.split(/\s{2,}/)[0])).toEqual([
      "secrets.tree",
      "secrets.history",
      "files.sensitive",
      "license.file",
      "license.deps",
      "paths.machine",
      "names.deny",
      "files.large",
      "docs.readme",
      "docs.contributing",
      "docs.conduct",
      "docs.security",
      "docs.changelog",
      "github.templates",
      "ci.present",
      "ci.tests",
      "workflows.permissions",
      "workflows.prtarget",
      "workflows.injection",
      "deps.lockfile",
      "deps.advisories",
      "deps.updates",
      "deps.outdated",
      "quality.markers",
    ]);
    expect(lines[1]).toMatch(/smoking gun$/);
  });

  it.each([
    [["checks", "--goal", "nope"], "nope"],
    [["checks", "extra"], "extra"],
  ])("refuses %j with exit 2", async (argv, named) => {
    const result = await capture(argv);
    expect(isRefusal(result)).toBe(true);
    expect(result.stderr).toContain(named);
  });
});
