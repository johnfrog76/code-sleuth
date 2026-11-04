import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findNpm, npmEnvironment } from "../../src/engine/npm.js";
import { investigate } from "../helpers/investigate.js";
import { stubNpm } from "../helpers/npm.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's critical finding 3: npm ran in the repository, so the repository's .npmrc was npm's project
// config. It could send the user's own registry token to a proxy of its choosing, or put any environment
// variable's value in a registry URL. npm now runs on a copy of package.json and the lockfile, in a folder of
// Code Sleuth's own, with only the variables it needs.

const project = {
  "package.json": JSON.stringify({
    name: "widget",
    version: "1.0.0",
    dependencies: { "left-pad": "^1.3.0" },
  }),
  "package-lock.json": JSON.stringify({
    name: "widget",
    lockfileVersion: 3,
    packages: { "": { name: "widget" }, "node_modules/left-pad": { version: "1.3.0" } },
  }),
};

/** `body` on a repository of these files, held byte-identical by investigate(). */
function onRepo<T>(
  files: Record<string, string>,
  body: (root: string) => T,
  prepare?: (root: string) => void,
): T {
  return investigate({ name: "widget", files }, (repo) => body(repo.root), prepare ? { prepare } : {});
}

describe("npm runs on a copy of the project, never in the repository", () => {
  it("copies only package.json and the lockfile, in npm's own folder, and removes the copy after", () =>
    withScratch((scratch) => {
      const npm = stubNpm(scratch);
      const folder = join(scratch, "npm");
      onRepo({ ...project, ".npmrc": "registry=http://127.0.0.1:9/\n", "a.js": "" }, (root) =>
        findNpm(npm.env, process.platform, process.execPath, folder)!.run(["audit", "--json"], root),
      );
      const [call] = npm.calls();
      const cwd = realpathSync.native(folder);
      expect(relative(cwd, call!.cwd).startsWith("project-")).toBe(true);
      expect(call!.files).toEqual(["package-lock.json", "package.json"]);
      expect(existsSync(call!.cwd)).toBe(false);
    }));

  it("never copies a link, and never runs npm without a package.json of the copy's own", () =>
    withScratch((scratch) => {
      writeFileSync(join(scratch, "outside.json"), "{}");
      const npm = stubNpm(scratch);
      onRepo(
        { "README.md": "# widget\n" },
        (root) =>
          findNpm(npm.env, process.platform, process.execPath, join(scratch, "npm"))!.run(
            ["audit", "--json"],
            root,
          ),
        (root) => symlinkSync(join(scratch, "outside.json"), join(root, "package.json")),
      );
      // With no package.json in the copy, npm would take a folder above it as the project: it is not run.
      expect(npm.calls()).toEqual([]);
    }));

  it("starts npm with none of the user's other variables", () =>
    withScratch((scratch) => {
      const npm = stubNpm(scratch);
      const env = { ...npm.env, HOME: scratch, GITHUB_TOKEN: "not-kept", AWS_SECRET_ACCESS_KEY: "not-kept" };
      onRepo(project, (root) =>
        findNpm(env, process.platform, process.execPath, join(scratch, "npm"))!.run(
          ["audit", "--json"],
          root,
        ),
      );
      const seen = npm.calls()[0]!.env;
      expect(seen).toContain("PATH");
      expect(seen).not.toContain("GITHUB_TOKEN");
      expect(seen).not.toContain("AWS_SECRET_ACCESS_KEY");
    }));

  it("gives npm only what it needs, the variables the user's own .npmrc names among them", () =>
    withScratch((scratch) => {
      const userConfig = join(scratch, "user.npmrc");
      writeFileSync(userConfig, "//registry.example.invalid/:_authToken=${MY_REGISTRY_TOKEN}\n");
      const env = npmEnvironment({
        PATH: "/bin",
        HOME: scratch,
        https_proxy: "http://proxy.example.invalid",
        npm_config_userconfig: userConfig,
        MY_REGISTRY_TOKEN: "kept",
        GITHUB_TOKEN: "not-kept",
        AWS_SECRET_ACCESS_KEY: "not-kept",
      });
      expect(Object.keys(env).sort()).toEqual([
        "HOME",
        "MY_REGISTRY_TOKEN",
        "PATH",
        "https_proxy",
        "npm_config_userconfig",
      ]);
    }));
});

/**
 * Two HTTP listeners on 127.0.0.1, in a process of their own (npm is run synchronously, and would block one
 * here): one stands for the user's registry, one for a host the repository chose. Each logs what reaches it.
 */
function listeners(folder: string): { user: number; chosen: number; seen: () => string[]; stop: () => void } {
  const log = join(folder, "requests.log");
  const ports = join(folder, "ports.json");
  const server = spawn(
    process.execPath,
    [
      "-e",
      `const http = require("http"), fs = require("fs");
       const listen = (name) => new Promise((done) => {
         const s = http.createServer((q, r) => {
           fs.appendFileSync(${JSON.stringify(log)}, name + " " + q.method + " " + q.url + " auth=" + (q.headers.authorization ?? "") + "\\n");
           r.statusCode = 404; r.end("{}");
         });
         s.listen(0, "127.0.0.1", () => done(s.address().port));
       });
       Promise.all([listen("user"), listen("chosen")]).then(([user, chosen]) =>
         fs.writeFileSync(${JSON.stringify(ports)}, JSON.stringify({ user, chosen })));`,
    ],
    { stdio: "ignore" },
  );
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 200 && !existsSync(ports); i++) Atomics.wait(wait, 0, 0, 25);
  const { user, chosen } = JSON.parse(readFileSync(ports, "utf8")) as { user: number; chosen: number };
  return {
    user,
    chosen,
    seen: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []),
    stop: () => server.kill(),
  };
}

const hasNpm = spawnSync("npm", ["--version"], { stdio: "ignore" }).status === 0;

describe("a repository's .npmrc, with the real npm, against listeners on this machine", () => {
  /** The real npm on this project, as the user whose config names `user` as the registry, with a token for it. */
  function audit(scratch: string, npmrc: string, extra: NodeJS.ProcessEnv = {}) {
    const net = listeners(scratch);
    try {
      const userConfig = join(scratch, "user.npmrc");
      writeFileSync(
        userConfig,
        `registry=http://127.0.0.1:${net.user}/\n//127.0.0.1:${net.user}/:_authToken=\${USER_REGISTRY_TOKEN}\n`,
      );
      writeFileSync(join(scratch, "global.npmrc"), "");
      const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: scratch,
        npm_config_userconfig: userConfig,
        npm_config_globalconfig: join(scratch, "global.npmrc"),
        npm_config_fetch_retries: "0",
        USER_REGISTRY_TOKEN: "user-token-123",
        ...extra,
      };
      onRepo({ ...project, ".npmrc": npmrc.replaceAll("CHOSEN", String(net.chosen)) }, (root) =>
        findNpm(env, process.platform, process.execPath, join(scratch, "npm"))!.run(
          ["audit", "--json"],
          root,
        ),
      );
      return { ...net, requests: net.seen() };
    } finally {
      net.stop();
    }
  }

  it.skipIf(!hasNpm || process.platform === "win32")(
    "sends nothing through a proxy the repository names, and the user's token goes only to their registry",
    () =>
      withScratch((scratch) => {
        const { requests } = audit(
          scratch,
          "proxy=http://127.0.0.1:CHOSEN/\nhttp-proxy=http://127.0.0.1:CHOSEN/\nnoproxy=\n",
        );
        expect(requests.filter((line) => line.startsWith("chosen"))).toEqual([]);
        expect(
          requests.some((line) => line.startsWith("user ") && line.endsWith("auth=Bearer user-token-123")),
        ).toBe(true);
      }),
  );

  it.skipIf(!hasNpm || process.platform === "win32")(
    "never reads an .npmrc above the copy, even beside a package.json there",
    () =>
      withScratch((scratch) => {
        const net = listeners(scratch);
        try {
          const above = join(scratch, "above");
          mkdirSync(above);
          // A whole project above, so npm, taking it as the project, would ask its .npmrc's registry.
          writeFileSync(join(above, "package.json"), project["package.json"]);
          writeFileSync(join(above, "package-lock.json"), project["package-lock.json"]);
          writeFileSync(join(above, ".npmrc"), `registry=http://127.0.0.1:${net.chosen}/\n`);
          writeFileSync(join(scratch, "user.npmrc"), `registry=http://127.0.0.1:${net.user}/\n`);
          writeFileSync(join(scratch, "global.npmrc"), "");
          const env: NodeJS.ProcessEnv = {
            PATH: process.env.PATH,
            HOME: scratch,
            npm_config_userconfig: join(scratch, "user.npmrc"),
            npm_config_globalconfig: join(scratch, "global.npmrc"),
            npm_config_fetch_retries: "0",
          };
          const npm = findNpm(env, process.platform, process.execPath, join(above, "npm"))!;
          // A package.json that is a link is not copied: npm must not run, or it would take `above` as the project.
          onRepo(
            { "package-lock.json": project["package-lock.json"] },
            (root) => npm.run(["audit", "--json"], root),
            (root) => symlinkSync(join(above, "package.json"), join(root, "package.json")),
          );
          onRepo(project, (root) => npm.run(["audit", "--json"], root));
          expect(net.seen().filter((line) => line.startsWith("chosen"))).toEqual([]);
          expect(net.seen().some((line) => line.startsWith("user "))).toBe(true);
        } finally {
          net.stop();
        }
      }),
  );

  it.skipIf(!hasNpm || process.platform === "win32")(
    "never puts an environment variable's value in a URL the repository names",
    () =>
      withScratch((scratch) => {
        const { requests } = audit(scratch, "registry=http://127.0.0.1:CHOSEN/${SLEUTH_SECRET}/\n", {
          SLEUTH_SECRET: "secret-value-456",
        });
        expect(requests.filter((line) => line.startsWith("chosen"))).toEqual([]);
        expect(requests.join("\n")).not.toContain("secret-value-456");
      }),
  );
});
