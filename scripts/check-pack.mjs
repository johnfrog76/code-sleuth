#!/usr/bin/env node
// Checks what npm would pack against package.json's `files`, before a version is staged on npm. The publish
// workflow (.github/workflows/publish.yml) runs it after the tests; docs/RELEASING.md says why.
//
//   node scripts/check-pack.mjs
//
// It asks `npm pack --dry-run --json` for the list of packed files, without running any script (npm ci has
// already built dist/). Every packed path must sit under a `files` entry, or be one npm always packs: the
// root's package.json, README, LICENSE or LICENCE (any case, any extension), and the `bin` and `main` files.
// Every `files` entry must pack at least one file. It prints each unexpected path, or each entry that packs
// nothing, and exits 1; otherwise it prints how many files it checked. A `files` entry with a glob in it is
// refused, since this reads entries as plain paths.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** A path as npm writes it in a pack list: forward slashes, no leading "./", no trailing "/". */
const plain = (path) => path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");

/** The root files npm packs whatever `files` says. README and LICENSE in any case, with any extension. */
const ALWAYS = /^(package\.json|readme(\.[^/]*)?|licen[cs]e(\.[^/]*)?)$/i;

/**
 * What is wrong with a pack list, given the package's manifest: each packed path that no `files` entry and no
 * always-packed rule allows, and each `files` entry that packs nothing. Both empty means the list is as expected.
 */
export function checkPack(manifest, packed) {
  const entries = (manifest.files ?? []).map(plain);
  const globbed = entries.filter((entry) => /[*?[\]{}!]/.test(entry));
  if (globbed.length > 0)
    throw new Error(`files has a glob, which this check does not read: ${globbed.join(", ")}`);
  const bin = typeof manifest.bin === "string" ? [manifest.bin] : Object.values(manifest.bin ?? {});
  const named = new Set([...bin, ...(manifest.main === undefined ? [] : [manifest.main])].map(plain));
  const under = (path, entry) => path === entry || path.startsWith(`${entry}/`);
  const paths = packed.map(plain);
  return {
    unexpected: paths.filter(
      (path) => !ALWAYS.test(path) && !named.has(path) && !entries.some((entry) => under(path, entry)),
    ),
    empty: entries.filter((entry) => !paths.some((path) => under(path, entry))),
  };
}

/**
 * npm with an argument array, never through a shell. On Windows `npm` is a .cmd shim that Node will not start
 * without one, so npm's own script beside node runs under node, as src/engine/npm.ts does.
 */
function npm(args, cwd) {
  if (process.platform === "win32") {
    const cli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!existsSync(cli)) throw new Error("npm's own script is not beside node.");
    return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
  }
  return execFileSync("npm", args, { cwd, encoding: "utf8" });
}

function main() {
  const root = resolve(import.meta.dirname, "..");
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const [pack] = JSON.parse(npm(["pack", "--dry-run", "--json", "--ignore-scripts"], root));
  const packed = (pack?.files ?? []).map((file) => file.path);
  const { unexpected, empty } = checkPack(manifest, packed);
  for (const path of unexpected) console.error(`Packed, but not under package.json's files: ${path}`);
  for (const entry of empty) console.error(`In package.json's files, but packs nothing: ${entry}`);
  if (unexpected.length > 0 || empty.length > 0) process.exit(1);
  console.log(`The package holds ${packed.length} files, each under package.json's files or always packed.`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
