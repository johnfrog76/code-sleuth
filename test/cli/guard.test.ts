import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's high findings 4 and 5: the one writer guard read `..cases` as outside the repository, and
// compared against the folder it was pointed at, not the repository that folder is in. investigateAsync holds
// the tree byte-identical, so a refusal here is also proof nothing was written.

const tree = { name: "widget", files: { "README.md": "# widget\n", "sub/a.txt": "a\n" } };

describe("the one writer guard, through a whole run", () => {
  it("refuses an --out inside the repository whose name starts with two dots", () =>
    withScratch((scratch) =>
      investigateAsync(
        tree,
        async (root) => {
          const result = await sleuth(
            [root, "--goal", "public", "--offline", "--out", join(root, "..cases")],
            {
              casesFolder: join(scratch, "default"),
            },
          );
          expect(isRefusal(result)).toBe(true);
          expect(result.stderr).toContain("inside the repository");
        },
        { git: true },
      ),
    ));

  it("refuses a --deny list inside the repository whose name starts with two dots", () =>
    withScratch((scratch) =>
      investigateAsync(
        tree,
        async (root) => {
          const result = await sleuth(
            [
              root,
              "--goal",
              "public",
              "--offline",
              "--out",
              join(scratch, "cases"),
              "--deny",
              join(root, "..deny"),
            ],
            { casesFolder: join(scratch, "default") },
          );
          expect(isRefusal(result)).toBe(true);
          expect(result.stderr).toMatch(/^Error: .*inside the repository/);
        },
        { git: true },
      ),
    ));

  it("refuses an --out in the repository when pointed at a folder inside it", () =>
    withScratch((scratch) =>
      investigateAsync(
        tree,
        async (root) => {
          const result = await sleuth(
            [join(root, "sub"), "--goal", "public", "--offline", "--out", join(root, "out")],
            {
              casesFolder: join(scratch, "default"),
            },
          );
          expect(isRefusal(result)).toBe(true);
          expect(result.stderr).toContain("inside the repository");
        },
        { git: true },
      ),
    ));

  it("still investigates a folder inside the repository with an --out outside it", () =>
    withScratch((scratch) =>
      investigateAsync(
        tree,
        async (root) => {
          const result = await sleuth(
            [join(root, "sub"), "--goal", "public", "--offline", "--out", join(scratch, "cases")],
            {
              casesFolder: join(scratch, "default"),
            },
          );
          expect(result.code).toBe(0);
        },
        { git: true },
      ),
    ));

  it.skipIf(process.platform === "win32")(
    "refuses an --out in the superproject when pointed at a submodule",
    () =>
      withScratch((scratch) => {
        const source = join(scratch, "source");
        mkdirSync(source);
        const run = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
        run(source, "init", "-q");
        writeFileSync(join(source, "b.txt"), "b\n");
        run(source, "add", ".");
        run(source, "-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "one");
        return investigateAsync(
          tree,
          async (root) => {
            const result = await sleuth(
              [join(root, "lib"), "--goal", "public", "--offline", "--out", join(root, "out")],
              { casesFolder: join(scratch, "default") },
            );
            expect(isRefusal(result)).toBe(true);
            expect(result.stderr).toContain("inside the repository");
          },
          {
            git: true,
            commits: [],
            prepare: (root) => {
              run(root, "-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "lib");
              run(root, "-c", "user.email=t@example.invalid", "-c", "user.name=t", "commit", "-qm", "lib");
            },
          },
        );
      }),
  );
});
