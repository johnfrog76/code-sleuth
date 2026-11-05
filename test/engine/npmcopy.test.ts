import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { dependencySource } from "../../src/engine/checks/deps.outdated.js";
import { outdatedReasons } from "../../src/engine/copy.js";
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
           // The user's registry knows every package as having versions 1.3.0 and 9.0.0, the latest.
           const pkg = decodeURIComponent(q.url.slice(1));
           if (name === "user" && q.method === "GET" && /^[@\\w./-]+$/.test(pkg) && !pkg.startsWith("-/")) {
             const v = (version) => ({ name: pkg, version, dist: { tarball: "http://127.0.0.1/none.tgz" } });
             r.setHeader("content-type", "application/json");
             r.end(JSON.stringify({ name: pkg, "dist-tags": { latest: "9.0.0" }, versions: { "1.3.0": v("1.3.0"), "9.0.0": v("9.0.0") } }));
             return;
           }
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
          SLEUTH_SECRET: "secret-value-456", // code-sleuth:example
        });
        expect(requests.filter((line) => line.startsWith("chosen"))).toEqual([]);
        expect(requests.join("\n")).not.toContain("secret-value-456");
      }),
  );

  it.skipIf(!hasNpm || process.platform === "win32")(
    "finds a devDependency a major version behind, though nothing is installed in the copy",
    () =>
      withScratch((scratch) => {
        const net = listeners(scratch);
        try {
          writeFileSync(join(scratch, "user.npmrc"), `registry=http://127.0.0.1:${net.user}/\n`);
          writeFileSync(join(scratch, "global.npmrc"), "");
          const npm = findNpm(
            {
              PATH: process.env.PATH,
              HOME: scratch,
              npm_config_userconfig: join(scratch, "user.npmrc"),
              npm_config_globalconfig: join(scratch, "global.npmrc"),
              npm_config_fetch_retries: "0",
            },
            process.platform,
            process.execPath,
            join(scratch, "npm"),
          )!;
          const dev = {
            "package.json": JSON.stringify({
              name: "widget",
              version: "1.0.0",
              devDependencies: { "left-pad": "^1.3.0" },
            }),
            "package-lock.json": project["package-lock.json"],
          };
          const result = investigate({ name: "widget", files: dev }, (repo, capabilities) =>
            runCheck(
              CHECKS.find((c) => c.id === "deps.outdated")!,
              repo,
              new Set([...capabilities, "npm", "network"]),
              {
                ...secretHasher(Buffer.alloc(32)),
                npm,
              },
            ),
          );
          expect(result).toMatchObject({
            verdict: "found",
            evidence: [{ excerpt: "left-pad 1.3.0, latest 9.0.0 (dev)" }],
          });
        } finally {
          net.stop();
        }
      }),
  );

  it.skipIf(!hasNpm || process.platform === "win32")(
    "asks the registry about registry dependencies alone: never a git, path, URL or alias source",
    () =>
      withScratch((scratch) => {
        const net = listeners(scratch);
        try {
          writeFileSync(join(scratch, "user.npmrc"), `registry=http://127.0.0.1:${net.user}/\n`);
          writeFileSync(join(scratch, "global.npmrc"), "");
          const npm = findNpm(
            {
              PATH: process.env.PATH,
              HOME: scratch,
              npm_config_userconfig: join(scratch, "user.npmrc"),
              npm_config_globalconfig: join(scratch, "global.npmrc"),
              npm_config_fetch_retries: "0",
            },
            process.platform,
            process.execPath,
            join(scratch, "npm"),
          )!;
          const chosen = `127.0.0.1:${net.chosen}`;
          const manifest = {
            name: "widget",
            version: "1.0.0",
            dependencies: {
              "keep-me": "^1.3.0",
              "from-git": `git+http://${chosen}/r.git`,
              "from-url": `http://${chosen}/x.tgz`,
              "from-path": "file:../outside",
              "from-alias": "npm:alias-target@^1.0.0",
            },
          };
          const lock = {
            name: "widget",
            lockfileVersion: 3,
            packages: { "": { name: "widget" }, "node_modules/keep-me": { version: "1.3.0" } },
          };
          const result = investigate(
            {
              name: "widget",
              files: { "package.json": JSON.stringify(manifest), "package-lock.json": JSON.stringify(lock) },
            },
            (repo, capabilities) =>
              runCheck(
                CHECKS.find((c) => c.id === "deps.outdated")!,
                repo,
                new Set([...capabilities, "npm", "network"]),
                {
                  ...secretHasher(Buffer.alloc(32)),
                  npm,
                },
              ),
          );
          expect(result).toMatchObject({
            verdict: "found",
            evidence: [{ excerpt: "keep-me 1.3.0, latest 9.0.0" }],
          });
          const seen = net.seen();
          expect(seen.filter((line) => line.startsWith("chosen"))).toEqual([]);
          expect(seen.filter((line) => line.startsWith("user ")).map((line) => line.split(" ")[2])).toEqual([
            "/keep-me",
          ]);
        } finally {
          net.stop();
        }
      }),
  );
});

describe("which dependencies npm is asked about", () => {
  it.each([
    ["^1.2.3", "registry"],
    ["1.2.3", "registry"],
    ["~1.2.3", "registry"],
    [">=1 <2 || 3.x", "registry"],
    ["latest", "registry"],
    ["*", "registry"],
    ["", "registry"],
    ["1.0.0-beta.1+build", "registry"],
    ["git+ssh://git@host.example.invalid/x.git", "git"],
    ["git+https://host.example.invalid/x.git", "git"],
    ["git://host.example.invalid/x.git", "git"],
    ["github:user/repo", "git"],
    ["gitlab:user/repo", "git"],
    ["user/repo", "git"],
    ["user/repo#v1", "git"],
    ["file:../../somewhere", "path"],
    ["link:../x", "path"],
    ["workspace:*", "path"],
    ["./local", "path"],
    ["../up", "path"],
    ["~/home", "path"],
    ["/abs", "path"],
    ["C:\\x", "path"],
    ["x.tgz", "path"],
    ["https://host.example.invalid/x.tgz", "url"],
    ["http://host.example.invalid/x", "url"],
    ["npm:other@^1.0.0", "alias"],
    ["something:else", "other"],
  ])("reads %j as %s", (spec, source) => {
    expect(dependencySource("left-pad", spec)).toBe(source);
  });

  it("asks nothing for a name the registry could not hold, or a spec that is not text", () => {
    expect(dependencySource("../escape", "^1.0.0")).toBe("other");
    expect(dependencySource("UPPER", "^1.0.0")).toBe("other");
    expect(dependencySource("left-pad", { version: "1" })).toBe("other");
    expect(dependencySource("@scope/name", "^1.0.0")).toBe("registry");
  });

  it("gives npm each registry dependency at *, and none of the others, with a stub npm", () =>
    withScratch((scratch) => {
      const npm = stubNpm(scratch, { outdated: {} });
      const manifest = {
        name: "widget",
        version: "1.0.0",
        dependencies: { "keep-me": "^1.3.0", "from-git": "github:user/repo" },
        devDependencies: { "keep-dev": "~2.0.0", "from-path": "file:../x" },
      };
      const lock = { name: "widget", lockfileVersion: 3, packages: { "": { name: "widget" } } };
      const result = investigate(
        {
          name: "widget",
          files: { "package.json": JSON.stringify(manifest), "package-lock.json": JSON.stringify(lock) },
        },
        (repo, capabilities) =>
          runCheck(
            CHECKS.find((c) => c.id === "deps.outdated")!,
            repo,
            new Set([...capabilities, "npm", "network"]),
            {
              ...secretHasher(Buffer.alloc(32)),
              npm: findNpm(npm.env, process.platform, process.execPath, join(scratch, "npm"))!,
            },
          ),
      );
      expect(npm.calls()[0]!.manifest!.dependencies).toEqual({ "keep-me": "*", "keep-dev": "*" });
      expect(result).toEqual({
        verdict: "not-investigated",
        reason: outdatedReasons.leftOut([
          { name: "from-git", source: "git" },
          { name: "from-path", source: "path" },
        ]),
      });
    }));

  it("asks npm nothing when every dependency comes from elsewhere", () =>
    withScratch((scratch) => {
      const npm = stubNpm(scratch, { outdated: {} });
      const manifest = {
        name: "widget",
        version: "1.0.0",
        dependencies: { "from-url": "https://host.example.invalid/x.tgz" },
      };
      const lock = { name: "widget", lockfileVersion: 3, packages: { "": { name: "widget" } } };
      const result = investigate(
        {
          name: "widget",
          files: { "package.json": JSON.stringify(manifest), "package-lock.json": JSON.stringify(lock) },
        },
        (repo, capabilities) =>
          runCheck(
            CHECKS.find((c) => c.id === "deps.outdated")!,
            repo,
            new Set([...capabilities, "npm", "network"]),
            {
              ...secretHasher(Buffer.alloc(32)),
              npm: findNpm(npm.env, process.platform, process.execPath, join(scratch, "npm"))!,
            },
          ),
      );
      expect(npm.calls()).toEqual([]);
      expect(result).toEqual({
        verdict: "not-investigated",
        reason:
          "from-url comes from a URL: I only look up dependencies from npm's registry, so I looked nothing up.",
      });
    }));
});
