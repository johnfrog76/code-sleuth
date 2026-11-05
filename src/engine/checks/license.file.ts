import type { Check, Evidence, Result } from "../check.js";
import { cards, unreadableReasons, voices } from "../copy.js";
import { baseLicense, identifyLicense, licenseIds } from "../licenses.js";
import { lineContaining, manifestOf, readManifest } from "../manifest.js";

const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[-._].*)?$/i;
/** A name that starts like a license but is code or data: `license-checker.json`, `license.ts`. */
const NOT_A_LICENSE_TEXT =
  /\.(?:json|jsonc|js|mjs|cjs|ts|mts|cts|tsx|jsx|py|rb|go|rs|java|kt|cs|php|sh|ps1|ya?ml|toml|lock|xml|ini|cfg)$/i;

export const licenseFile: Check = {
  id: "license.file",
  title: "A license",
  booksName: "software license",
  needs: [],
  voice: voices["license.file"],
  card: cards["license.file"],
  run(repo): Result {
    const files = repo.files.filter(
      (path) => !path.includes("/") && LICENSE_FILE.test(path) && !NOT_A_LICENSE_TEXT.test(path),
    );
    if (files.length === 0) return { verdict: "found", evidence: [] };

    const read = readManifest(repo);
    // The file is there; whether the manifest agrees with it cannot be said when the manifest cannot be read.
    if (read.state === "unreadable")
      return { verdict: "not-investigated", reason: unreadableReasons.manifest(read.path) };
    const manifest = manifestOf(read);
    const stated = typeof manifest?.license === "string" ? manifest.license : undefined;
    // `SEE LICENSE IN <file>` and `UNLICENSED` point at the file rather than naming a license to compare.
    if (stated === undefined || /^SEE LICEN[CS]E IN /i.test(stated) || stated === "UNLICENSED")
      return { verdict: "clean" };

    const identified = files.flatMap((path) => {
      const license = identifyLicense(repo.readText(path) ?? "");
      return license === undefined ? [] : [{ path, ...license }];
    });
    // A file whose license cannot be told from its text cannot be compared: clean would claim they agree.
    if (identified.length === 0)
      return { verdict: "not-investigated", reason: unreadableReasons.license(files[0]!, stated) };
    const named = new Set(licenseIds(stated).map(baseLicense));
    if (identified.some(({ id }) => named.has(baseLicense(id)))) return { verdict: "clean" };

    const manifestLine = lineContaining(repo.readText("package.json") ?? "", '"license"');
    const evidence: Evidence[] = [
      {
        path: "package.json",
        ...(manifestLine ? { line: manifestLine } : {}),
        excerpt: `"license": "${stated}"`,
        rule: "manifest-disagrees",
      },
      ...identified.map(({ path, id, shows }) => ({ path, excerpt: shows, rule: `reads-as-${id}` })),
    ];
    return { verdict: "found", evidence };
  },
};
