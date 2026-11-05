import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS } from "../../src/engine/checks/index.js";
import { runCheck, secretHasher } from "../../src/engine/engine.js";
import { investigate } from "../helpers/investigate.js";
import { SECRETS } from "../helpers/secrets.js";

// The code review's medium finding 18 (ENG-8, PROC-4): git still lists a tracked path whose folder has been
// replaced in the work tree by a link, and Code Sleuth read through it, outside the repository.

const outsideLine = `// TODO outside-the-repo ${SECRETS["github-token"]!.line(SECRETS["github-token"]!.value)}`; // code-sleuth:example

describe("a tracked path whose folder is now a link", () => {
  it.skipIf(process.platform === "win32")("is never read: nothing from outside reaches a finding", () => {
    const seen = investigate(
      {
        name: "widget",
        files: { "README.md": "# widget\n", "d/f.js": "// TODO inside\n", "e/g.js": "// fine\n" }, // code-sleuth:example
      },
      (repo, capabilities) => ({
        files: repo.files,
        text: repo.readText("d/f.js"),
        results: ["quality.markers", "secrets.tree"].map((id) =>
          JSON.stringify(
            runCheck(
              CHECKS.find((c) => c.id === id)!,
              repo,
              capabilities,
              secretHasher(Buffer.alloc(32)),
            ),
          ),
        ),
      }),
      {
        git: true,
        prepare: (root) => {
          const outside = join(root, "..", "outside");
          mkdirSync(outside, { recursive: true });
          writeFileSync(join(outside, "f.js"), `${outsideLine}\n`);
          rmSync(join(root, "d"), { recursive: true });
          symlinkSync(outside, join(root, "d"), "dir");
        },
      },
    );
    expect(seen.files).not.toContain("d/f.js");
    expect(seen.files).toContain("e/g.js");
    expect(seen.text).toBeUndefined();
    for (const result of seen.results) expect(result).not.toContain("outside-the-repo");
  });
});
