import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Each version is staged on npm with trusted publishing (.github/workflows/publish.yml, docs/RELEASING.md). These
// hold the workflow's shape: only a version tag starts it, it carries no token, the one job holds the one
// permission trusted publishing needs, it checks the tag before it installs, tests and checks the packed files
// before it stages, and it stages rather than publishes.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const text = read(".github/workflows/publish.yml");

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { if?: string; "runs-on"?: string; permissions?: Record<string, string>; steps: Step[] };
const workflow = parse(text) as {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};
const release = parse(read(".github/workflows/release.yml")) as { jobs: Record<string, Job> };
const jobs = Object.values(workflow.jobs);
const job = jobs[0]!;
const runs = job.steps.map((step) => step.run ?? "");
const at = (match: (run: string) => boolean) => runs.findIndex(match);
const exactly = (command: string) => at((run) => run.trim() === command);

describe("the publish workflow", () => {
  it("is started only by pushing a version tag", () => {
    expect(workflow.on).toEqual({ push: { tags: ["v*"] } });
  });

  it("gives nothing at the top, and its one job only what trusted publishing needs", () => {
    expect(workflow.permissions).toEqual({});
    expect(jobs).toHaveLength(1);
    expect(job.permissions).toEqual({ contents: "read", "id-token": "write" });
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.if).toBe(
      "${{ github.repository == 'johnfrog76/code-sleuth' && !github.event.repository.private }}",
    );
  });

  it("carries no token: npm's trusted publishing is the only credential", () => {
    expect(text).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.|github\.token|_TOKEN/);
  });

  it("pins every action to a commit, the same commits release.yml uses", () => {
    const uses = job.steps.flatMap((step) => step.uses ?? []);
    expect(uses.map((action) => action.split("@")[0])).toEqual(["actions/checkout", "actions/setup-node"]);
    const pinned = new Set(
      Object.values(release.jobs).flatMap((j) => j.steps.flatMap((step) => step.uses ?? [])),
    );
    for (const action of uses) {
      expect(action).toMatch(/^[\w-]+\/[\w-]+@[0-9a-f]{40}$/);
      expect(pinned.has(action), action).toBe(true);
    }
    const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkout?.with).toMatchObject({ "fetch-depth": 0, "persist-credentials": false });
    const node = job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
    expect(node?.with).toEqual({
      "node-version-file": ".nvmrc",
      "registry-url": "https://registry.npmjs.org",
    });
  });

  it("installs an exact npm new enough to stage", () => {
    const npm = /^npm install --global npm@(\d+)\.(\d+)\.(\d+)$/.exec(
      runs.find((run) => run.startsWith("npm install --global")) ?? "",
    );
    expect(npm).not.toBeNull();
    const [major, minor] = [Number(npm?.[1]), Number(npm?.[2])];
    expect(major > 11 || (major === 11 && minor >= 15)).toBe(true);
  });

  it("checks the tag, then installs, tests and checks the packed files, then stages last", () => {
    const tag = at((run) => run.includes("package.json names") && run.includes("vX.Y.Z"));
    const install = exactly("npm ci");
    const test = exactly("npm test");
    const pack = exactly("node scripts/check-pack.mjs");
    expect(tag).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(tag);
    expect(test).toBeGreaterThan(install);
    expect(pack).toBeGreaterThan(test);
    expect(exactly("npm stage publish")).toBe(runs.length - 1);
    expect(job.steps.at(-1)?.run?.trim()).toBe("npm stage publish");
  });

  it("never publishes straight away", () => {
    expect(runs.filter((run) => /\bnpm\s+publish\b/.test(run))).toEqual([]);
  });

  it("checks the tag with release.yml's own words", () => {
    const words = (job: Job | undefined) =>
      job?.steps.find((step) => step.run?.includes("package.json names"))?.run;
    expect(words(job)).toBe(words(release.jobs.build));
  });
});

describe("package.json, for trusted publishing", () => {
  const pkg = JSON.parse(read("package.json")) as Record<string, unknown>;

  it("names this repository exactly, as npm requires, and where to report a bug", () => {
    expect(pkg.repository).toEqual({ type: "git", url: "git+https://github.com/johnfrog76/code-sleuth.git" });
    expect(pkg.bugs).toEqual({ url: "https://github.com/johnfrog76/code-sleuth/issues" });
    expect(pkg.homepage).toBe("https://johnfrog76.github.io/code-sleuth/");
  });
});
