import { createInterface } from "node:readline/promises";
import { copy } from "./copy.js";
import { Interrupted, Refusal } from "./refusal.js";

/** The goal prompt in a terminal: one question, one answer, read through readline. */
export function terminalAsk(): (question: string) => Promise<string> {
  return async (question) => {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await prompt.question(question);
    } catch (error) {
      throw fromPromptError(error);
    } finally {
      prompt.close();
    }
  };
}

/** What readline's question() rejecting means: Ctrl-C is an interrupt; Ctrl-D, the end of input, no answer. */
export function fromPromptError(error: unknown): Error {
  if (error instanceof Error && /Ctrl\+C/.test(error.message)) return new Interrupted();
  return new Refusal(copy.noGoalPicked, copy.noGoalHint);
}
