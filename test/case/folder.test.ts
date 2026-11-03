import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultCasesFolder, guardCasesFolder, newCaseFolder, repoKey } from "../../src/case/folder.js";
import { Refusal } from "../../src/refusal.js";
import { withScratch } from "../helpers/scratch.js";

describe("the cases folder", () => {
  it("is per user, on every platform", () => {
    expect(defaultCasesFolder("darwin", {}, "/h")).toBe("/h/Library/Application Support/code-sleuth/cases");
    expect(defaultCasesFolder("linux", {}, "/h")).toBe("/h/.local/share/code-sleuth/cases");
    expect(defaultCasesFolder("linux", { XDG_DATA_HOME: "/data" }, "/h")).toBe("/data/code-sleuth/cases");
    expect(defaultCasesFolder("win32", { LOCALAPPDATA: "/local" }, "/h")).toBe(
      join("/local", "code-sleuth", "cases"),
    );
  });
});

describe("the refusals", () => {
  function refusalOf(body: () => void): Refusal {
    try {
      body();
    } catch (error) {
      if (error instanceof Refusal) return error;
      throw error;
    }
    throw new Error("expected a refusal");
  }

  it("refuses an --out inside the repository", () => {
    withScratch((root) => {
      const repo = join(root, "widget");
      mkdirSync(repo);
      const refusal = refusalOf(() => guardCasesFolder(repo, join(repo, "cases"), true));
      expect(refusal.message).toContain("inside the repository");
      expect(refusal.hint).toContain("--out");
    });
  });

  it("refuses a repository that holds the cases folder, as code-sleuth ~ would", () => {
    withScratch((home) => {
      const refusal = refusalOf(() => guardCasesFolder(home, defaultCasesFolder("darwin", {}, home), false));
      expect(refusal.message).toContain("holds my cases folder");
      expect(refusal.hint).toMatch(/\S/);
    });
  });

  it("refuses the repository itself as the cases folder", () => {
    withScratch((repo) => expect(() => guardCasesFolder(repo, repo, true)).toThrow(Refusal));
  });

  it("sees through a link into the repository", () => {
    withScratch((root) => {
      const repo = join(root, "widget");
      mkdirSync(join(repo, "inside"), { recursive: true });
      symlinkSync(join(repo, "inside"), join(root, "link"), "dir");
      expect(() => guardCasesFolder(repo, join(root, "link", "cases"), true)).toThrow(Refusal);
    });
  });

  it("lets a cases folder beside the repository through", () => {
    withScratch((root) => {
      mkdirSync(join(root, "widget"));
      expect(() => guardCasesFolder(join(root, "widget"), join(root, "cases"), true)).not.toThrow();
      expect(() => guardCasesFolder(join(root, "widget"), join(root, "widget-cases"), true)).not.toThrow();
    });
  });
});

describe("a case folder", () => {
  it("counts that day's runs of that goal from 1, and never reuses one", () => {
    withScratch((root) => {
      expect(newCaseFolder(root, "2026-10-31", "public").id).toBe("2026-10-31-public-1");
      expect(newCaseFolder(root, "2026-10-31", "public").id).toBe("2026-10-31-public-2");
      expect(newCaseFolder(root, "2026-10-31", "security").id).toBe("2026-10-31-security-1");
      expect(newCaseFolder(root, "2026-11-01", "public").id).toBe("2026-11-01-public-1");
    });
  });

  it("is keyed by the folder name and a hash of its path", () => {
    withScratch((root) => {
      mkdirSync(join(root, "widget"));
      expect(repoKey(join(root, "widget"))).toMatch(/^widget-[0-9a-f]{8}$/);
      expect(repoKey(join(root, "widget"))).toBe(repoKey(join(root, "widget", ".")));
    });
  });
});
