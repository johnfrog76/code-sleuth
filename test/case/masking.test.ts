import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { takeCase } from "../../src/case/write.js";
import { findGoal } from "../../src/engine/goals.js";
import { investigate } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { privateKey, SECRETS } from "../helpers/secrets.js";

/** Every file under a folder, as text. */
function everyFile(folder: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(folder, { recursive: true }) as string[]) {
    try {
      files[name] = readFileSync(join(folder, name), "utf8");
    } catch {
      // A folder.
    }
  }
  return files;
}

afterEach(() => vi.restoreAllMocks());

describe("the masking test", () => {
  it("leaves no fixture secret in any file of the case folder, or on stdout or stderr", () => {
    const key = privateKey(41);
    const values = [...Object.values(SECRETS).map((s) => s.value), key.body];
    const inTree = Object.fromEntries(
      Object.entries(SECRETS).map(([id, s]) => [`src/${id}.txt`, `${s.line(s.value)}\n`]),
    );
    const npm = SECRETS["npm-token"]!.value;

    let printed = "";
    const capture = (chunk: string | Uint8Array) => {
      printed += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    };
    vi.spyOn(process.stdout, "write").mockImplementation(capture);
    vi.spyOn(process.stderr, "write").mockImplementation(capture);

    const files = withScratch((out) => {
      for (const goal of ["public", "security"]) {
        investigate(
          {
            name: "leaky",
            files: {
              ...inTree,
              "keys/deploy.txt": key.text,
              ".npmrc": `//registry.npmjs.org/:_authToken=${npm}\n`,
            },
          },
          (repo, capabilities) =>
            takeCase({
              repo,
              goal: findGoal(goal)!,
              capabilities,
              casesFolder: out,
              chosen: true,
              all: true,
            }),
          // One more secret lives only in history: added, then removed.
          {
            git: true,
            commits: [
              { "old.txt": SECRETS["stripe-key"]!.line(`${SECRETS["stripe-key"]!.value}0`) },
              { "old.txt": null },
            ],
          },
        );
      }
      return everyFile(out);
    });

    const caseFiles = Object.keys(files).filter((name) => name.endsWith(".md") || name.endsWith(".json"));
    expect(caseFiles.length).toBeGreaterThan(4);
    const everything =
      Object.entries(files)
        .map(([name, text]) => `${name}\n${text}`)
        .join("\n") + printed;
    for (const value of [...values, `${SECRETS["stripe-key"]!.value}0`])
      expect(everything).not.toContain(value);

    // The run found them: masked, not missing.
    const record = JSON.parse(files[caseFiles.find((n) => n.endsWith("case.json"))!]!) as {
      counts: Record<string, number>;
    };
    expect(record.counts["smoking-gun"]).toBeGreaterThanOrEqual(2);
  });
});
