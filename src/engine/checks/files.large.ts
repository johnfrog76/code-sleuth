import type { Check, Evidence, Result } from "../check.js";
import { cards, voices } from "../copy.js";

export const LARGE = 5 * 1024 * 1024;
export const LARGE_BINARY = 1024 * 1024;
const MEDIA = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|woff2?|ttf|otf|eot)$/i;

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const filesLarge: Check = {
  id: "files.large",
  title: "Large files",
  booksName: "repository bloat",
  needs: [],
  voice: voices["files.large"],
  card: cards["files.large"],
  run(repo): Result {
    const evidence: Evidence[] = [];
    for (const path of repo.files) {
      const size = repo.size(path);
      if (size > LARGE) evidence.push({ path, excerpt: megabytes(size), rule: "over-5-mb" });
      else if (size > LARGE_BINARY && !MEDIA.test(path) && repo.isBinary(path)) {
        evidence.push({ path, excerpt: megabytes(size), rule: "binary-over-1-mb" });
      }
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
