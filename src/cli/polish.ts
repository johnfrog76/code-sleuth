import type { Card } from "../case/card.js";
import type { PolishState } from "../case/record.js";
import {
  DEFAULT_MODEL,
  KEY_VARIABLE,
  MODEL_VARIABLE,
  messagesClient,
  type PolishClient,
} from "../polish/client.js";
import { polishCards } from "../polish/pass.js";
import { copy } from "./copy.js";
import type { Io } from "./refusal.js";

export interface PreparedPolish {
  state: PolishState;
  model: string;
  /** Set only with --polish and a key: no client exists without both. */
  client?: PolishClient;
}

/**
 * On only with a key in ANTHROPIC_API_KEY -- read there and nowhere else -- and --polish. Without a key,
 * --polish is not a refusal: the run goes on and says so.
 */
export function preparePolish(asked: boolean, io: Io): PreparedPolish {
  const env = io.env ?? {};
  const key = env[KEY_VARIABLE]?.trim() || undefined;
  const model = env[MODEL_VARIABLE]?.trim() || DEFAULT_MODEL;
  if (!asked) return { state: { state: "off", reason: key ? "no --polish" : "no --polish, no key" }, model };
  if (key === undefined) return { state: { state: "off", reason: "no key" }, model };
  const client = (io.polishClient ?? messagesClient)(key, model);
  return { state: { state: "on", model }, model, client };
}

/** Polishes the cards, one at a time, with a tick for each, and never prints their words or the key. */
export async function polishAll(
  cards: readonly Card[],
  polish: PreparedPolish,
  human: (text: string) => void,
) {
  if (cards.length === 0) return undefined;
  human(copy.run.polishing(cards.length, polish.model));
  const ticking: PolishClient = async (card) => {
    const answer = await polish.client!(card);
    human(copy.run.tick);
    return answer;
  };
  const result = await polishCards(cards, ticking);
  human(`${copy.run.done}\n`);
  return result;
}
