import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("package.json")) as {
  license: string;
  dependencies?: Record<string, string>;
};
const notices = read("THIRD-PARTY-NOTICES.md");

/** The rows of the runtime dependencies table. */
const rows = notices
  .slice(notices.indexOf("## Runtime dependencies"), notices.indexOf("## Development dependencies"))
  .split("\n")
  .filter((line) => /^\| `[^`]+` \|/.test(line))
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  );

describe("THIRD-PARTY-NOTICES.md", () => {
  const dependencies = Object.keys(manifest.dependencies ?? {});

  it("has a row for every runtime dependency, and none for a package that does not ship", () => {
    expect(rows.map(([name]) => name!.replace(/`/g, "")).sort()).toEqual([...dependencies].sort());
  });

  it.each(dependencies.map((name) => [name]))(
    "gives %s its installed version and its own license",
    (name) => {
      const installed = JSON.parse(read(`node_modules/${name}/package.json`)) as {
        version: string;
        license: string;
      };
      const row = rows.find(([cell]) => cell === `\`${name}\``)!;
      expect(row[1]).toBe(installed.version);
      expect(row[2]).toBe(installed.license);
    },
  );

  it("is for a package that is itself MIT, as LICENSE says", () => {
    expect(manifest.license).toBe("MIT");
    expect(read("LICENSE")).toMatch(/^MIT License\n\nCopyright \(c\) The Code Sleuth authors\n/);
  });
});
