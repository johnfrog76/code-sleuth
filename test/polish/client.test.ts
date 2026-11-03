import { describe, expect, it } from "vitest";
import { FAKE_KEY } from "../helpers/polish.js";
import { DEFAULT_MODEL, MESSAGES_URL, messagesClient, PROMPT } from "../../src/polish/client.js";

const card = {
  title: "Add a license",
  body: "No license.\n\nFound by Code Sleuth: license.file, case c-1, at abc1234.",
};

/** A fetch that answers from a script and records what it was asked. Nothing leaves the process. */
function fakeFetch(answer: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init! });
    return answer(String(input), init!);
  }) as typeof fetch;
  return { fetcher, calls };
}

const message = (text: string, stop = "end_turn", thinking = false) =>
  new Response(
    JSON.stringify({
      stop_reason: stop,
      content: [
        ...(thinking ? [{ type: "thinking", thinking: "", signature: "s" }] : []),
        { type: "text", text },
      ],
    }),
    { status: 200 },
  );

describe("the polish request", () => {
  it("goes to the Messages API, once, with the key, the version, the model, the prompt and the card", async () => {
    const { fetcher, calls } = fakeFetch(() => message(JSON.stringify(card)));
    const answer = await messagesClient(FAKE_KEY, DEFAULT_MODEL, fetcher)(card);
    expect(answer).toEqual({ ok: true, card });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(url).toBe(MESSAGES_URL);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "x-api-key": FAKE_KEY,
      "anthropic-version": "2026-10-21",
      "content-type": "application/json",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body)) as Record<string, unknown> & {
      messages: { content: string }[];
    };
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.max_tokens).toBe(16000);
    expect(body.output_config).toEqual({
      effort: "low",
      format: { type: "json_schema", schema: expect.any(Object) },
    });
    expect(body.system).toBe(PROMPT);
    expect(JSON.parse(body.messages[0]!.content)).toEqual(card);
    expect(JSON.stringify(body)).not.toContain(FAKE_KEY);
  });

  it("reads the answer by block type, past any thinking", async () => {
    const { fetcher } = fakeFetch(() => message(JSON.stringify({ title: "T", body: "B" }), "end_turn", true));
    expect(await messagesClient(FAKE_KEY, DEFAULT_MODEL, fetcher)(card)).toEqual({
      ok: true,
      card: { title: "T", body: "B" },
    });
  });

  it.each([
    [401, "bad-key"],
    [403, "bad-key"],
    [429, "rate-limited"],
    [500, "unreachable"],
    [529, "unreachable"],
    [400, "rejected"],
  ])("keeps the original on HTTP %i, as %s, and tries once", async (status, reason) => {
    const { fetcher, calls } = fakeFetch(() => new Response("{}", { status }));
    expect(await messagesClient(FAKE_KEY, DEFAULT_MODEL, fetcher)(card)).toEqual({ ok: false, reason });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["the network fails", () => Promise.reject(new TypeError("fetch failed")), "unreachable"],
    [
      "the request times out",
      () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })),
      "timeout",
    ],
    ["the model declines", () => message("", "refusal"), "refused"],
    ["the answer is cut off", () => message('{"title":"T","bo', "max_tokens"), "unreadable"],
    ["the answer is not JSON", () => message("Here you go!"), "unreadable"],
    ["the answer has the wrong fields", () => message('{"name":"x"}'), "unreadable"],
    ["the reply is not JSON at all", () => new Response("<html>", { status: 200 }), "unreadable"],
  ])("keeps the original when %s", async (_, answer, reason) => {
    const { fetcher } = fakeFetch(answer);
    expect(await messagesClient(FAKE_KEY, DEFAULT_MODEL, fetcher)(card)).toEqual({ ok: false, reason });
  });
});
