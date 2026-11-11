import { type AddKey, copy } from "./copy.js";
import type { CaseRecord } from "./record.js";

/**
 * The one polish line a case carries: what was on or off, and the one thing that would turn it on. The
 * terminal passes the copy line in full, to run; the case names the example and the .env, as a record.
 */
export function polishLine(record: CaseRecord, runnableCopy?: string): string | undefined {
  const polish = record.enhancements?.polish;
  if (polish === undefined) return undefined;
  if (polish.state === "off") {
    if (polish.reason === "--offline") return copy.polish.offline;
    if (polish.reason === "no --polish") return copy.polish.keySet(polish.keyFrom);
    const how: AddKey =
      runnableCopy !== undefined
        ? { line: runnableCopy }
        : polish.keyExample !== undefined
          ? { example: polish.keyExample }
          : {};
    if (polish.reason === "no key") return copy.polish.noKey(polish.keyFile, how);
    return copy.polish.offBoth(polish.keyFile, how);
  }
  const carded = record.checks.filter((c) => c.polish !== undefined);
  const kept = carded.flatMap((c) =>
    c.polish!.state === "kept-original" ? [`${c.id}: ${c.polish!.reason}`] : [],
  );
  return copy.polish.on(carded.length - kept.length, carded.length, polish.model, kept, polish.keyFrom);
}
