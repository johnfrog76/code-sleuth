import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Each version's GitHub Release carries its changelog section as notes and its packed package
// (.github/workflows/release.yml). The docs link to that package, so the links are held to the package's own
// version, and the workflow to what a release needs: tests first, notes from the changelog, the
// write token apart from the install, and the pushed tag only.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const { version } = JSON.parse(read("package.json")) as { version: string };

const pages = [
  "README.md",
  ...readdirSync(new URL("docs/", root))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/${name}`),
];

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { needs?: string; if?: string; permissions?: Record<string, string>; steps: Step[] };
const workflow = parse(read(".github/workflows/release.yml")) as {
  on: { push: { tags: string[] } };
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};

describe("the release", () => {
  it("links every page to the package of the package's own version", () => {
    const links = pages.flatMap((path) =>
      [
        ...read(path).matchAll(
          /github\.com\/johnfrog76\/code-sleuth\/releases\/(download|tag)\/(\S+?)[)\s`]/g,
        ),
      ].map((match) => ({ path, kind: match[1]!, target: match[2]! })),
    );
    expect(links.map(({ path }) => path)).toEqual(
      expect.arrayContaining(["README.md", "docs/QUICKSTART.md"]),
    );
    for (const link of links) {
      const expected = link.kind === "tag" ? `v${version}` : `v${version}/code-sleuth-${version}.tgz`;
      expect(link.target, link.path).toBe(expected);
    }
  });

  it("has notes for the package's version in the changelog", () => {
    const section = read("CHANGELOG.md")
      .split(new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\].*$`, "m"))[1]
      ?.split(/^## \[/m)[0];
    expect(section?.trim()).toBeTruthy();
  });

  it("runs on a version tag, tests before it packs, and publishes from a job with no install", () => {
    expect(workflow.on.push.tags).toEqual(["v*"]);
    expect(workflow.permissions).toEqual({});
    const { build, release } = workflow.jobs;
    expect(build!.permissions).toEqual({ contents: "read" });
    expect(release!.permissions).toEqual({ contents: "write" });
    expect(release!.needs).toBe("build");
    expect(build!.if).toContain("!github.event.repository.private");

    const runs = build!.steps.map((step) => step.run ?? "");
    const at = (text: string) => runs.findIndex((run) => run.includes(text));
    expect(at("CHANGELOG.md has no section")).toBeGreaterThan(-1);
    expect(at("package.json names")).toBeGreaterThan(-1);
    expect(at("npm test")).toBeGreaterThan(at("npm ci"));
    expect(at("npm pack")).toBeGreaterThan(at("npm test"));
    expect(build!.steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with).toMatchObject({
      "persist-credentials": false,
    });

    // The job that can write never checks out or installs, and makes the release from the pushed tag alone.
    expect(release!.steps.some((step) => step.uses?.startsWith("actions/checkout@"))).toBe(false);
    expect(release!.steps.some((step) => /\bnpm\b/.test(step.run ?? ""))).toBe(false);
    const publish = release!.steps.map((step) => step.run ?? "").join("\n");
    expect(publish).toContain("gh release create");
    expect(publish).toContain("--verify-tag");
    expect(publish).not.toMatch(/git (tag|push)/);
  });

  it("pins every action to a commit", () => {
    const uses = Object.values(workflow.jobs).flatMap((job) => job.steps.flatMap((step) => step.uses ?? []));
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) expect(action).toMatch(/^[\w-]+\/[\w-]+@[0-9a-f]{40}$/);
  });
});
