import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy as caseCopy } from "../../src/case/copy.js";
import { messagesClient, MESSAGES_URL, type PolishClient } from "../../src/polish/client.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";
import { SECRETS } from "../helpers/secrets.js";
import { FAKE_KEY } from "../helpers/polish.js";

/** Every file under a folder, as text. */
function everyFile(folder: string): string {
  return (readdirSync(folder, { recursive: true }) as string[])
    .map((name) => {
      try {
        return readFileSync(join(folder, name), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

const secret = SECRETS["github-token"]!;

/** A run over `bare`, plus a committed secret, with a polish client of the test's own and a scratch cases folder. */
async function polishRun(
  argv: string[],
  env: NodeJS.ProcessEnv,
  client?: (key: string, model: string) => PolishClient,
) {
  return withScratch(async (out) =>
    investigateAsync(
      "whole/bare",
      async (root) => {
        const result = await sleuth([root, "--goal", "public", "--out", out, ...argv], {
          casesFolder: join(out, "default"),
          env,
          ...(client ? { polishClient: client } : {}),
        });
        const repoFolder = readdirSync(out).find((n) => n.startsWith("bare-"))!;
        const caseFolder = join(
          out,
          repoFolder,
          readdirSync(join(out, repoFolder)).find((n) => n.startsWith("20"))!,
        );
        return {
          result,
          root,
          everything: everyFile(out),
          record: JSON.parse(readFileSync(join(caseFolder, "case.json"), "utf8")) as {
            enhancements: { polish: Record<string, unknown> };
            checks: { id: string; card?: string; polish?: { state: string; reason?: string } }[];
          },
          cards: Object.fromEntries(
            readdirSync(join(caseFolder, "cards")).map((f) => [
              f,
              readFileSync(join(caseFolder, "cards", f), "utf8"),
            ]),
          ),
        };
      },
      { git: true, commits: [{ "src/config.ts": `${secret.line(secret.value)}\n` }] },
    ),
  );
}

/** A client that rewrites each card's first sentence and keeps everything else. */
const rewording: (key: string, model: string) => PolishClient = () => async (card) => ({
  ok: true,
  card: { title: card.title, body: card.body.replace(/^[^\n]+/, (first) => `In short: ${first}`) },
});

describe("the polish pass", () => {
  it("is off without a key, and says so in one line, even with --polish", async () => {
    let asked = 0;
    const { result, record } = await polishRun(
      ["--polish"],
      {},
      () => async () => (asked++, { ok: false, reason: "unreachable" }),
    );
    expect(result.code).toBe(0);
    expect(asked).toBe(0);
    expect(result.stdout).toContain("Polish     No API key. The cards are as the sleuth wrote them.\n");
    expect(record.enhancements.polish).toEqual({ state: "off", reason: "no key" });
  });

  it("is off under --offline, even with --polish and a key: no request is made, and the run and the case say why", async () => {
    let asked = 0;
    let made = 0;
    const { result, record, everything } = await polishRun(
      ["--offline", "--polish"],
      { ANTHROPIC_API_KEY: FAKE_KEY },
      () => (made++, async () => (asked++, { ok: false, reason: "unreachable" })),
    );
    expect(result.code).toBe(0);
    expect([made, asked]).toEqual([0, 0]);
    expect(record.enhancements.polish).toEqual({ state: "off", reason: "--offline" });
    expect(record.checks.filter((c) => c.polish !== undefined)).toEqual([]);
    expect(result.stdout).toContain(`Polish     ${caseCopy.polish.offline}\n`);
    expect(everything).toContain(`Polish: ${caseCopy.polish.offline}\n`);
    expect(result.stdout).not.toContain("the polish request");
    expect(result.stdout).not.toMatch(/^Polishing /m);
  });

  it("is off without --polish, even with a key, and says how to turn it on", async () => {
    let asked = 0;
    const { result, record } = await polishRun(
      [],
      { ANTHROPIC_API_KEY: FAKE_KEY },
      () => async () => (asked++, { ok: false, reason: "unreachable" }),
    );
    expect(asked).toBe(0);
    expect(result.stdout).toContain(
      "Polish     an API key is set (from the environment): add --polish to have the cards polished.\n",
    );
    expect(record.enhancements.polish).toEqual({
      state: "off",
      reason: "no --polish",
      keyFrom: "the environment",
    });
  });

  it("polishes every card it keeps, names the request before making it, and records each card's state", async () => {
    const { result, record, cards } = await polishRun(
      ["--polish"],
      { ANTHROPIC_API_KEY: FAKE_KEY },
      rewording,
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      "  Out   the polish request: each card's text, masked, to the Anthropic API (--polish)\n",
    );
    expect(result.stdout).toMatch(/^Polishing \d+ cards with claude-haiku-5-5 \.+ done\.$/m);
    expect(record.enhancements.polish).toEqual({
      state: "on",
      model: "claude-haiku-5-5",
      keyFrom: "the environment",
    });
    const carded = record.checks.filter((c) => c.card);
    expect(carded.every((c) => c.polish?.state === "polished")).toBe(true);
    expect(Object.values(cards).every((text) => text.split("\n")[2]!.startsWith("In short: "))).toBe(true);
  });

  it("keeps the original of a card the guard refuses, and says why", async () => {
    const dropsPaths: (key: string, model: string) => PolishClient = () => async (card) => ({
      ok: true,
      card: { title: card.title, body: card.body.replace(/`[^`]*\.[a-z]+(?::\d+)?`/g, "the file") },
    });
    const { record, result } = await polishRun(["--polish"], { ANTHROPIC_API_KEY: FAKE_KEY }, dropsPaths);
    const secrets = record.checks.find((c) => c.id === "secrets.tree")!;
    expect(secrets.polish).toEqual({ state: "kept-original", reason: "path-dropped" });
    expect(result.stdout).toMatch(
      /^Polish {5}\d+ of \d+ cards polished by claude-haiku-5-5, with the API key from the environment; \d+ kept as written \(.*secrets\.tree: path-dropped.*\)\.$/m,
    );
  });

  it("keeps every card on a network failure, says why, and still exits 0", async () => {
    const down = () => async () => ({ ok: false as const, reason: "unreachable" as const });
    const { result, record } = await polishRun(["--polish"], { ANTHROPIC_API_KEY: FAKE_KEY }, down);
    expect(result.code).toBe(0);
    expect(record.checks.filter((c) => c.card).every((c) => c.polish?.reason === "unreachable")).toBe(true);
  });
});

describe("what the polish pass sends, and never sends", () => {
  it("sends only to the Messages API, ignoring ANTHROPIC_BASE_URL, and never an unmasked value, a repository path, or the key", async () => {
    const requests: { url: string; body: string; headers: Record<string, string> }[] = [];
    const recording: (key: string, model: string) => PolishClient = (key, model) =>
      messagesClient(key, model, (async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({
          url: String(input),
          body: String(init!.body),
          headers: init!.headers as Record<string, string>,
        });
        return new Response("{}", { status: 503 });
      }) as typeof fetch);

    const { result, root, everything } = await polishRun(
      ["--polish"],
      { ANTHROPIC_API_KEY: FAKE_KEY, ANTHROPIC_BASE_URL: "https://elsewhere.example" },
      recording,
    );
    expect(requests.length).toBeGreaterThan(0);
    for (const { url, body, headers } of requests) {
      expect(url).toBe(MESSAGES_URL);
      expect(body).not.toContain(secret.value);
      expect(body).not.toContain(root);
      expect(body).not.toContain(FAKE_KEY);
      expect(headers["x-api-key"]).toBe(FAKE_KEY);
    }
    // The key appears nowhere a person or a file can see it: not in the case folder, not in the output.
    expect(everything).not.toContain(FAKE_KEY);
    expect(result.stdout + result.stderr).not.toContain(FAKE_KEY);
    // And no card text is printed to stderr.
    expect(result.stderr).toBe("");
  });
});
