import type { PolishClient } from "../polish/client.js";
import { Refusal } from "../refusal.js";

export { Refusal };

export const EXIT_OK = 0;
/** Only with `--fail-on`: a finding at or above the weight it names. */
export const EXIT_FOUND = 1;
export const EXIT_REFUSED = 2;

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Which streams are terminals. The goal is asked for only when stdin and stdout both are. */
  terminal?: { stdin: boolean; stdout: boolean; stderr: boolean };
  /** Asks a question and returns the answer. Only given where there is a terminal to ask in. */
  ask?: (question: string) => Promise<string>;
  env?: NodeJS.ProcessEnv;
  /** The cases folder when no --out is given. Tests set it; the default is the per-user folder. */
  casesFolder?: string;
  /** Code Sleuth's own .env, where the model key may be kept. The command sets it; a test sets a scratch one or none. */
  keyFile?: string;
  /** Only for tests: the polish client, in place of the real request. */
  polishClient?: (key: string, model: string) => PolishClient;
  /** Only for tests: the one folder ToolKit is loaded from in the child shell. */
  toolkitModuleRoot?: string;
}

/** Prints a refusal the one way every refusal is printed, and returns its exit code. */
export function refuse(refusal: Refusal, io: Io): number {
  io.stderr(`Error: ${refusal.message}\n`);
  io.stderr(`Hint: ${refusal.hint}\n`);
  return EXIT_REFUSED;
}
