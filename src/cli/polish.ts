import { existsSync } from "node:fs";
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
import { copyCommand, exampleFile, readKeyFile, shownPath } from "./keyFile.js";
import type { Io } from "./refusal.js";

export interface PreparedPolish {
  state: PolishState;
  /** With no key, the copy line with both paths in full, for the terminal alone: the case keeps the ~ form. */
  runnableCopy?: string;
  model: string;
  /** Set only with --polish and a key: no client exists without both. */
  client?: PolishClient;
}

/**
 * On only with a key and --polish. The key is ANTHROPIC_API_KEY, from the environment, else from Code Sleuth's
 * own .env (never one in the repository or the current folder); the environment wins. It is held here for the
 * polish request alone, never written to the environment, and only where it came from is said. Without a key,
 * --polish is not a refusal: the run goes on and says so. --offline wins over --polish: no client is made, so no
 * request is built or sent, and that is not a refusal either.
 */
export function preparePolish(asked: boolean, io: Io, offline = false): PreparedPolish {
  const env = io.env ?? {};
  const model = env[MODEL_VARIABLE]?.trim() || DEFAULT_MODEL;
  if (asked && offline) return { state: { state: "off", reason: "--offline" }, model };
  const fromEnv = env[KEY_VARIABLE]?.trim() || undefined;
  const file = io.keyFile === undefined ? {} : readKeyFile(io.keyFile);
  if (file.loose && io.keyFile !== undefined) io.stderr(copy.polish.looseKeyFile(io.keyFile));
  const key = fromEnv ?? file.key;
  const keyFrom =
    fromEnv !== undefined
      ? copy.polish.fromEnvironment
      : key !== undefined && io.keyFile !== undefined
        ? shownPath(io.keyFile, io.home)
        : undefined;
  const from = keyFrom === undefined ? {} : { keyFrom };
  // With no key, where to put one: the .env, and the one line that copies the example there.
  const example =
    io.keyFile === undefined
      ? undefined
      : io.keyExample === undefined
        ? exampleFile()
        : existsSync(io.keyExample)
          ? io.keyExample
          : undefined;
  const where =
    io.keyFile === undefined
      ? {}
      : {
          keyFile: shownPath(io.keyFile, io.home),
          // The case keeps a record, the example's path in its ~ form; only the terminal prints a runnable line.
          ...(example === undefined ? {} : { keyExample: shownPath(example, io.home) }),
        };
  const runnable =
    io.keyFile === undefined || example === undefined
      ? {}
      : { runnableCopy: copyCommand(example, io.keyFile) };
  if (!asked) {
    if (key !== undefined) return { state: { state: "off", reason: "no --polish", ...from }, model };
    return { state: { state: "off", reason: "no --polish, no key", ...where }, model, ...runnable };
  }
  if (key === undefined) return { state: { state: "off", reason: "no key", ...where }, model, ...runnable };
  const client = (io.polishClient ?? messagesClient)(key, model);
  return { state: { state: "on", model, ...from }, model, client };
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
