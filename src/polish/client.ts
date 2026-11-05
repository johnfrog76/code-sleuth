import { readFileSync } from "node:fs";
import type { CardText } from "./guard.js";

/** The one place a polish request goes. Fixed in code: ANTHROPIC_BASE_URL and every other override are ignored. */
export const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
/**
 * The current API version. The request sends no sampling parameters, no assistant prefill and no citations,
 * so nothing in it changes meaning on this version.
 */
export const API_VERSION = "2026-10-21";
/** The current Haiku: a card is a short rewrite, and small and fast is the point. */
export const DEFAULT_MODEL = "claude-haiku-5-5";
export { KEY_VARIABLE } from "../spawn.js";
export const MODEL_VARIABLE = "CODE_SLEUTH_MODEL";
export const TIMEOUT_MS = 60_000;
/**
 * Haiku 5.5 thinks by default, and its thinking counts toward max_tokens: too low a cap stops it before the
 * card comes back, which reads as unreadable and never polishes. The recommended non-streaming default.
 */
export const MAX_TOKENS = 16_000;

/** The prompt, a file in the package, so it is tuned in the open. The same relative path from src/ and dist/. */
export const PROMPT = readFileSync(new URL("../../src/polish/prompt.md", import.meta.url), "utf8");

/** Why a polish request kept the original, when the request itself is what failed. */
export type RequestFailure =
  "bad-key" | "rate-limited" | "unreachable" | "timeout" | "rejected" | "refused" | "unreadable";

export type PolishAnswer = { ok: true; card: CardText } | { ok: false; reason: RequestFailure };

/** Asks for one card, polished. Implemented over fetch; stubbed in every test. */
export type PolishClient = (card: CardText) => Promise<PolishAnswer>;

const SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "string" } },
  required: ["title", "body"],
  additionalProperties: false,
};

/**
 * The client, built only with a key from ANTHROPIC_API_KEY: no other source is read. One attempt, no
 * retries: any failure keeps the card as written. Nothing it sends or receives is ever printed.
 */
export function messagesClient(key: string, model: string, fetcher: typeof fetch = fetch): PolishClient {
  return async (card) => {
    let response: Response;
    try {
      response = await fetcher(MESSAGES_URL, {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": API_VERSION, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: PROMPT,
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
          messages: [{ role: "user", content: JSON.stringify({ title: card.title, body: card.body }) }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const name = (error as { name?: string }).name;
      return {
        ok: false,
        reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable",
      };
    }
    if (!response.ok) return { ok: false, reason: failureFor(response.status) };

    let message: { stop_reason?: string; content?: unknown };
    try {
      message = (await response.json()) as typeof message;
    } catch (error) {
      const name = (error as { name?: string }).name;
      // A timeout can land while the body is still coming: that is a timeout, not an answer it cannot read.
      return {
        ok: false,
        reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreadable",
      };
    }
    // A 200 can still hold anything: null, content that is not a list, a block that is not an object.
    if (typeof message !== "object" || message === null || !Array.isArray(message.content))
      return { ok: false, reason: "unreadable" };
    if (message.stop_reason === "refusal") return { ok: false, reason: "refused" };
    // The answer is the text block; a response can begin with thinking blocks, so read by type, not position.
    const block = (message.content as unknown[]).find(
      (b): b is { type: string; text?: unknown } =>
        typeof b === "object" && b !== null && (b as { type?: unknown }).type === "text",
    );
    const text = typeof block?.text === "string" ? block.text : undefined;
    if (message.stop_reason !== "end_turn" || text === undefined) return { ok: false, reason: "unreadable" };
    try {
      const parsed = JSON.parse(text) as Partial<CardText>;
      if (typeof parsed.title !== "string" || typeof parsed.body !== "string")
        return { ok: false, reason: "unreadable" };
      return { ok: true, card: { title: parsed.title, body: parsed.body } };
    } catch {
      return { ok: false, reason: "unreadable" };
    }
  };
}

function failureFor(status: number): RequestFailure {
  if (status === 401 || status === 403) return "bad-key";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "unreachable";
  return "rejected";
}
