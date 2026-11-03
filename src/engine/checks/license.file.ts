import type { Check, Evidence } from "../check.js";
import { cards, voices } from "../copy.js";
import { baseLicense, identifyLicense, licenseIds } from "../licenses.js";
import { lineContaining, readPackageJson } from "../manifest.js";

const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[-._].*)?$/i;

export const licenseFile: Check = {
  id: "license.file",
  title: "A license",
  booksName: "software license",
  needs: [],
  voice: voices["license.file"],
  card: cards["license.file"],
  run(repo) {
    const files = repo.files.filter((path) => !path.includes("/") && LICENSE_FILE.test(path));
    if (files.length === 0) return { verdict: "found", evidence: [] };

    const manifest = readPackageJson(repo);
    const stated = typeof manifest?.license === "string" ? manifest.license : undefined;
    // `SEE LICENSE IN <file>` and `UNLICENSED` point at the file rather than naming a license to compare.
    if (stated === undefined || /^SEE LICEN[CS]E IN /i.test(stated) || stated === "UNLICENSED")
      return { verdict: "clean" };

    const identified = files.flatMap((path) => {
      const license = identifyLicense(repo.readText(path) ?? "");
      return license === undefined ? [] : [{ path, ...license }];
    });
    // A file we cannot identify cannot disagree with anything.
    if (identified.length === 0) return { verdict: "clean" };
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
