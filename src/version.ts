import { readFileSync } from "node:fs";

/** The package's version, from `package.json`. The same relative path from `src/` and from `dist/`. */
export function version(): string {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return manifest.version;
}
