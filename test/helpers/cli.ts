import { run } from "../../src/cli/run.js";
import type { Io } from "../../src/cli/refusal.js";

export interface Captured {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs the CLI in process. `casesFolder` is required: a test never lets a run fall back to the person's
 * own cases folder.
 */
export async function sleuth(argv: string[], io: Partial<Io> & { casesFolder: string }): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await run(argv, {
    ...io,
    stdout: (t) => (stdout += t),
    stderr: (t) => (stderr += t),
  });
  return { code, stdout, stderr };
}

/** One `Error:` line and one `Hint:` line, nothing else, and exit 2. */
export function isRefusal({ code, stdout, stderr }: Captured): boolean {
  return code === 2 && stdout === "" && /^Error: [^\n]+\nHint: [^\n]+\n$/.test(stderr);
}
