import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { openCase, takeCase } from "../../src/case/write.js";
import type { CardText } from "../../src/polish/guard.js";
import { polishCards } from "../../src/polish/pass.js";
import { EVIDENCE_FIELDS, masked } from "../../src/engine/engine.js";
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

  it("masks a secret on a line another check reports, in the case, the cards and the polish request", async () => {
    // One token per check that keeps an excerpt of a line it reads; none of them is a secret check.
    const token = (seed: number) =>
      SECRETS["github-token"]!.value.slice(0, -2) + String(seed).padStart(2, "0");
    const tokens = { marker: token(11), path: token(12), injection: token(13), prtarget: token(14) };
    const workflow = (on: string, steps: string) =>
      `on: ${on}\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`;

    const sent: CardText[] = [];
    const out = mkdtempSync(join(tmpdir(), "code-sleuth-masking-"));
    onTestFinished(() => rmSync(out, { recursive: true, force: true }));
    const draft = investigate(
      {
        name: "chatty",
        files: {
          "src/marker.ts": `// TODO rotate ${tokens.marker} before release\n`, // code-sleuth:example
          "src/path.ts": `const notes = "/Users/riverbank/notes/${tokens.path}";\n`, // code-sleuth:example
          ".github/workflows/injection.yml": workflow(
            "issues",
            `      - run: echo "\${{ github.event.issue.title }}" ${tokens.injection}\n`,
          ),
          ".github/workflows/prtarget.yml": workflow(
            "pull_request_target",
            `      - uses: actions/checkout@v4\n        with:\n          ref: \${{ github.event.pull_request.head.sha }} # ${tokens.prtarget}\n`,
          ),
        },
      },
      (repo, capabilities) =>
        openCase({
          repo,
          goal: findGoal("public")!,
          capabilities,
          casesFolder: out,
          chosen: true,
          all: true,
        }),
    );

    // The checks that read those lines found them.
    const found = draft.outcomes.filter((o) => o.result.verdict === "found").map((o) => o.check.id);
    expect(found).toEqual(
      expect.arrayContaining([
        "quality.markers",
        "paths.machine",
        "workflows.injection",
        "workflows.prtarget",
      ]),
    );

    const polished = await polishCards(draft.cards, async (card) => {
      sent.push(card);
      return { ok: true, card };
    });
    draft.close(undefined, polished);
    const files = everyFile(draft.path);

    const everything = [
      JSON.stringify(draft.outcomes),
      ...Object.values(files),
      ...sent.map((card) => `${card.title}\n${card.body}`),
    ].join("\n");
    expect(sent.length).toBeGreaterThanOrEqual(4);
    for (const value of Object.values(tokens)) expect(everything).not.toContain(value);
    // Masked, not dropped: each shows as its first four and last two characters.
    for (const value of Object.values(tokens))
      expect(everything).toContain(`${value.slice(0, 4)}****${value.slice(-2)}`);
  });

  it("has one place a check's result comes out: only the engine's runCheck calls a check's run", () => {
    const src = fileURLToPath(new URL("../../src", import.meta.url));
    const callers = (readdirSync(src, { recursive: true }) as string[])
      .map((name) => name.split("\\").join("/"))
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => /\bcheck\.run\(|\.run\(repo\b/.test(readFileSync(join(src, name), "utf8")));
    expect(callers).toEqual(["engine/engine.ts"]);
    // The run is caught there, so a check that throws reads not investigated; its result still leaves through masked.
    expect(readFileSync(join(src, "engine/engine.ts"), "utf8")).toMatch(
      /result = check\.run\(repo, context\);[\s\S]*?return masked\(result\);/,
    );
  });

  it("masks every evidence field that holds repository text, and pins the rest", () => {
    const value = SECRETS["github-token"]!.value;
    const result = masked({
      verdict: "found",
      evidence: [{ path: `notes/${value}.txt`, line: 1, excerpt: `see ${value}`, rule: "TODO" }],
    });
    expect(JSON.stringify(result)).not.toContain(value);
    // Every field is either repository text, which masked() masks, or a number, a hash or a fixed word.
    const repositoryText = Object.entries(EVIDENCE_FIELDS)
      .filter(([, holds]) => holds.startsWith("repository text"))
      .map(([field]) => field);
    expect(repositoryText.sort()).toEqual(["excerpt", "path"]);
  });

  it("types every check's run as returning a Result, so a stray key in a result does not compile", () => {
    const checks = fileURLToPath(new URL("../../src/engine/checks", import.meta.url));
    const untyped = (readdirSync(checks) as string[])
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => {
        const source = readFileSync(join(checks, name), "utf8");
        return /^ {2}run\(/m.test(source) && !/^ {2}run\([^)]*\): Result \{/m.test(source);
      });
    expect(untyped).toEqual([]);
  });
});
