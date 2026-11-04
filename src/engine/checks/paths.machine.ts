import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";
import { excerptOf, readableLines } from "../files.js";
import { isMarked } from "../examples.js";

/** A home folder on macOS, Linux or Windows, with the name in it. */
const HOME = /(?:\/Users\/|\/home\/|\b[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/))([A-Za-z0-9._-]+)(?:\\|\/)/g;

/** Names that stand for anyone, or for a machine nobody owns: a CI runner, a container, Homebrew. */
const NOBODY = new Set([
  "shared",
  "runner",
  // The account on GitHub's hosted Windows runners: the counterpart of runner on Linux and macOS.
  "runneradmin",
  "user",
  "username",
  "you",
  "yourname",
  "your-name",
  "your_name",
  "me",
  "name",
  "example",
  "someone",
  "default",
  "public",
  "guest",
  "linuxbrew",
  "node",
]);

/** A name that is somebody's: not a placeholder made of dots (`C:\\Users\\...\\`), and not a name for nobody. */
function isSomebody(name: string): boolean {
  return /[A-Za-z0-9]/.test(name) && !NOBODY.has(name.toLowerCase());
}

export const pathsMachine: Check = {
  id: "paths.machine",
  title: "Paths from somebody's machine",
  booksName: "hard-coded path",
  needs: [],
  voice: voices["paths.machine"],
  card: cards["paths.machine"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    for (const path of repo.textFiles) {
      readableLines(repo, path).forEach((text, i) => {
        const someone = [...text.matchAll(HOME)].some((m) => isSomebody(m[1]!));
        if (!someone) return;
        evidence.push({
          path,
          line: i + 1,
          excerpt: excerptOf(text, path),
          ...(isMarked(text) ? { marked: true as const } : {}),
        });
      });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
