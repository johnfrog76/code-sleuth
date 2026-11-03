import type { Card } from "../case/card.js";
import type { PolishClient, RequestFailure } from "./client.js";
import { type GuardReason, guardPolish } from "./guard.js";

/** What polish did to one card, as the case records it. */
export type PolishRecord =
  { state: "polished" } | { state: "kept-original"; reason: GuardReason | RequestFailure };

/**
 * Asks for each card polished, one at a time, and keeps a rewrite only when the guard does. A card that is not
 * kept stays exactly as the sleuth wrote it. A failed request fails that card alone; the run goes on.
 */
export async function polishCards(
  cards: readonly Card[],
  client: PolishClient,
): Promise<{ cards: Card[]; records: Map<string, PolishRecord> }> {
  const out: Card[] = [];
  const records = new Map<string, PolishRecord>();
  for (const card of cards) {
    const answer = await client({ title: card.title, body: card.body });
    if (!answer.ok) {
      out.push(card);
      records.set(card.file, { state: "kept-original", reason: answer.reason });
      continue;
    }
    const verdict = guardPolish({ title: card.title, body: card.body }, answer.card);
    if (verdict.kept) {
      out.push({ ...card, title: answer.card.title.trim(), body: answer.card.body.trimEnd() });
      records.set(card.file, { state: "polished" });
    } else {
      out.push(card);
      records.set(card.file, { state: "kept-original", reason: verdict.reason });
    }
  }
  return { cards: out, records };
}
