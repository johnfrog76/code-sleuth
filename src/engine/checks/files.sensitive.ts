import type { Check, Evidence } from "../check.js";
import { cards, voices } from "../copy.js";
import { isMarked } from "../examples.js";
import { mask } from "../secrets/scan.js";

/** A file name that usually holds a secret, and the rule that names it. */
export function sensitiveName(name: string): string | undefined {
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) return "env-file";
  if (/\.(?:pem|p12|key|keystore)$/i.test(name)) return "key-file";
  if (name.startsWith("id_rsa") && !name.endsWith(".pub")) return "key-file";
  return undefined;
}

const AUTH_TOKEN = /_authToken\s*=\s*(\S+)/;

export const filesSensitive: Check = {
  id: "files.sensitive",
  title: "Key files and .env files",
  booksName: "sensitive file exposure",
  needs: [],
  voice: voices["files.sensitive"],
  card: cards["files.sensitive"],
  run(repo, context) {
    const evidence: Evidence[] = [];
    for (const path of repo.files) {
      const name = path.split("/").at(-1)!;
      const rule = sensitiveName(name);
      if (rule !== undefined) {
        evidence.push({ path, rule });
        continue;
      }
      if (name !== ".npmrc" || repo.isBinary(path)) continue;
      (repo.readText(path) ?? "").split(/\r?\n/).forEach((text, i) => {
        const value = AUTH_TOKEN.exec(text)?.[1];
        // `_authToken=${NPM_TOKEN}` reads the token from the environment, which is the fix, not the finding.
        if (value === undefined || value.startsWith("${")) return;
        const excerpt = text.replace(value, mask(value)).trim();
        evidence.push({
          path,
          line: i + 1,
          excerpt,
          rule: "npmrc-token",
          valueHash: context.hashSecret(value),
          ...(isMarked(text) ? { marked: true as const } : {}),
        });
      });
    }
    return evidence.length === 0 ? { verdict: "clean" } : { verdict: "found", evidence };
  },
};
