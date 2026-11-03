import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A scratch folder for the body, removed after it -- after the promise settles, for a body that awaits. */
export function withScratch<T>(body: (folder: string) => T): T {
  const folder = mkdtempSync(join(tmpdir(), "code-sleuth-scratch-"));
  const remove = () => rmSync(folder, { recursive: true, force: true });
  let result: T;
  try {
    result = body(folder);
  } catch (error) {
    remove();
    throw error;
  }
  if (result instanceof Promise) return result.finally(remove) as T;
  remove();
  return result;
}
