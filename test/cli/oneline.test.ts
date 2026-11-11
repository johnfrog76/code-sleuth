import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { repoKey } from "../../src/case/folder.js";
import { fromPromptError } from "../../src/cli/ask.js";
import { Interrupted, Refusal } from "../../src/cli/refusal.js";
import { run } from "../../src/cli/run.js";
import { messagesClient } from "../../src/polish/client.js";
import { readCreated } from "../../src/toolkit/file.js";
import { isRefusal, sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { SECRETS } from "../helpers/secrets.js";
import { stubToolkit } from "../helpers/toolkit.js";

// The code review's medium finding 16, and #25: a failure crashed the run with Node's stack trace, and exit 1,
// which only --fail-on gives. Each is now a line.

const MAIN = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));
const tree = { name: "widget", files: { "README.md": "# widget\n" } };

describe("an error Code Sleuth did not expect", () => {
  async function broken(env: NodeJS.ProcessEnv = {}) {
    return withScratch((scratch) =>
      investigateAsync(tree, async (root) => {
        let stderr = "";
        const token = SECRETS["github-token"]!.value;
        const code = await run([root, "--goal", "public", "--offline", "--out", join(scratch, "cases")], {
          casesFolder: join(scratch, "default"),
          env,
          stdout: () => {
            throw new Error(`the terminal went away holding ${token}`);
          },
          stderr: (text) => (stderr += text),
        });
        return { code, stderr, token };
      }),
    );
  }

  it("is one Error: line and one Hint: line, exit 3, masked, with no stack trace", async () => {
    const { code, stderr, token } = await broken();
    expect(code).toBe(3);
    expect(stderr).toMatch(
      /^Error: I hit a problem I didn't expect: [^\n]+\nHint: Please report it at [^\n]+\n$/,
    );
    expect(stderr).not.toContain(token);
    expect(stderr).not.toMatch(/\n\s+at /);
  });

  it("shows where it happened only when CODE_SLEUTH_DEBUG is set", async () => {
    const { stderr } = await broken({ CODE_SLEUTH_DEBUG: "1" });
    expect(stderr).toMatch(/\n\s+at /);
  });
});

describe("a flag's value, said in one line", () => {
  it.each([
    [["--out"], "Error: --out needs a value."],
    [["--out", "--all"], "Error: --out needs a value."],
    [["--offline=yes"], "Error: --offline doesn't take a value."],
  ])("%j", async (argv, line) =>
    withScratch(async (scratch) => {
      const result = await sleuth(["--goal", "public", ...argv], { casesFolder: join(scratch, "default") });
      expect(isRefusal(result)).toBe(true);
      expect(result.stderr.split("\n")[0]).toBe(line);
    }),
  );
});

describe("the goal prompt, closed", () => {
  it("reads Ctrl-C as an interrupt and Ctrl-D as no answer", () => {
    expect(
      fromPromptError(Object.assign(new Error("Aborted with Ctrl+C"), { name: "AbortError" })),
    ).toBeInstanceOf(Interrupted);
    expect(
      fromPromptError(Object.assign(new Error("Aborted with Ctrl+D"), { name: "AbortError" })),
    ).toBeInstanceOf(Refusal);
  });

  it.each([
    [
      "Ctrl-D",
      new Refusal("No goal picked: the prompt was closed before an answer.", "Give --goal public."),
      2,
    ],
    ["Ctrl-C", new Interrupted(), 130],
  ])("ends the run on %s with its own exit code and no stack trace", async (_name, thrown, code) =>
    withScratch((scratch) =>
      investigateAsync(tree, async (root) => {
        const result = await sleuth([root, "--offline", "--out", join(scratch, "cases")], {
          casesFolder: join(scratch, "default"),
          terminal: { stdin: true, stdout: true, stderr: true },
          ask: async () => {
            throw thrown;
          },
        });
        expect(result.code).toBe(code);
        expect(result.stderr).not.toMatch(/\n\s+at /);
      }),
    ),
  );
});

describe("a case folder that cannot be written", () => {
  it("refuses an --out that is a file, in one line", () =>
    withScratch((scratch) =>
      investigateAsync(tree, async (root) => {
        writeFileSync(join(scratch, "a-file"), "");
        const result = await sleuth(
          [root, "--goal", "public", "--offline", "--out", join(scratch, "a-file")],
          {
            casesFolder: join(scratch, "default"),
          },
        );
        expect(isRefusal(result)).toBe(true);
        expect(result.stderr).toContain("a file is in the way of a folder");
      }),
    ));

  it("refuses a machine key it did not make, in one line", () =>
    withScratch((scratch) =>
      investigateAsync(tree, async (root) => {
        mkdirSync(join(scratch, "cases"));
        writeFileSync(join(scratch, "cases", "machine-key"), "");
        const result = await sleuth(
          [root, "--goal", "public", "--offline", "--out", join(scratch, "cases")],
          {
            casesFolder: join(scratch, "default"),
          },
        );
        expect(isRefusal(result)).toBe(true);
        expect(result.stderr).toContain("isn't one I made");
      }),
    ));

  it("investigates a repository whose folder name is as long as the file system takes", () =>
    withScratch((scratch) =>
      investigateAsync({ name: "a".repeat(250), files: { "README.md": "# r\n" } }, async (root) => {
        const result = await sleuth(
          [root, "--goal", "public", "--offline", "--out", join(scratch, "cases")],
          {
            casesFolder: join(scratch, "default"),
          },
        );
        expect(result.code).toBe(0);
      }),
    ));
});

describe("the ToolKit hand-off", () => {
  it("reads a Prompt: path with a space or a bare % as written, rather than throwing", () => {
    const created = "[+] Created a.md in backlog/ -- Task K7M2, offline.\n";
    const spaced = `${created}    Prompt: file:///Users/A Person/hub/backlog/a.md\n`; // code-sleuth:example
    const percent = `${created}    Prompt: file:///Users/x/100%done/backlog/a.md\n`; // code-sleuth:example
    expect(readCreated(spaced).path).toBe("/Users/A Person/hub/backlog/a.md"); // code-sleuth:example
    expect(readCreated(percent).path).toBe("/Users/x/100%done/backlog/a.md"); // code-sleuth:example
  });

  it("refuses a ledger it cannot read, before anything is filed", () =>
    withScratch((scratch) => {
      const stub = stubToolkit(scratch, ["pwsh"]);
      const out = join(scratch, "cases");
      return investigateAsync("whole/bare", async (root) => {
        mkdirSync(join(out, repoKey(root)), { recursive: true });
        writeFileSync(join(out, repoKey(root), "filed.json"), "{ not json");
        const result = await sleuth([root, "--goal", "public", "--out", out, "--toolkit", "--yes"], {
          casesFolder: join(scratch, "default"),
          env: stub.env,
        });
        // After the report, as every ToolKit refusal is: one Error: line and one Hint: line, exit 2.
        expect(result.code).toBe(2);
        expect(result.stderr).toMatch(/^Error: [^\n]*filed\.json[^\n]*\nHint: [^\n]+\n$/);
        expect(stub.calls().filter((call) => !call.argv.includes("-Probe"))).toEqual([]);
      });
    }));
});

describe("the polish client, given an answer it cannot read", () => {
  const card = { title: "t", body: "b" };
  const answering = (body: unknown) =>
    messagesClient("key", "model", async () => new Response(JSON.stringify(body), { status: 200 }));

  it.each([null, { content: {} }, { content: "x" }, { content: [null], stop_reason: "end_turn" }])(
    "keeps the card on %j, without throwing",
    async (body) => {
      await expect(answering(body)(card)).resolves.toEqual({ ok: false, reason: "unreadable" });
    },
  );

  it("names a timeout while the body is read a timeout", async () => {
    const client = messagesClient("key", "model", async () => {
      const response = new Response("{}", { status: 200 });
      Object.defineProperty(response, "json", {
        value: async () => {
          throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
        },
      });
      return response;
    });
    await expect(client(card)).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});

describe("a closed pipe", () => {
  it.skipIf(process.platform === "win32")(
    "ends what is printed, not the run: no stack trace, the run's own exit code",
    () =>
      withScratch((scratch) => {
        const err = join(scratch, "err.txt");
        const result = spawnSync(
          "bash",
          [
            "-c",
            `"${process.execPath}" "${MAIN}" "${fileURLToPath(new URL("../fixtures/repos/whole/bare", import.meta.url))}" --goal public --offline --out "${join(scratch, "cases")}" 2>"${err}" | head -1 >/dev/null; echo "\${PIPESTATUS[0]}"`,
          ],
          { encoding: "utf8" },
        );
        expect(result.stdout.trim()).toBe("0");
        expect(
          readdirSync(join(scratch, "cases"), { recursive: true }).some((f) => String(f).endsWith("case.md")),
        ).toBe(true);
        expect(spawnSync("cat", [err], { encoding: "utf8" }).stdout).not.toMatch(/EPIPE|\n\s+at /);
      }),
  );
});
