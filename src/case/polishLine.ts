import { copy } from "./copy.js";
import type { CaseRecord } from "./record.js";

/**
 * The one polish line a case carries: what was on or off, and the one thing that would turn it on. The
 * terminal passes the copy line in full, to run; the case keeps the record's ~ form.
 */
export function polishLine(record: CaseRecord, runnableCopy?: string): string | undefined {
  const polish = record.enhancements?.polish;
  if (polish === undefined) return undefined;
  if (polish.state === "off") {
    if (polish.reason === "no --polish") return copy.polish.keySet(polish.keyFrom);
    const line = runnableCopy ?? polish.keyCopy;
    if (polish.reason === "no key") return copy.polish.noKey(polish.keyFile, line);
    return copy.polish.offBoth(polish.keyFile, line);
  }
  const carded = record.checks.filter((c) => c.polish !== undefined);
  const kept = carded.flatMap((c) =>
    c.polish!.state === "kept-original" ? [`${c.id}: ${c.polish!.reason}`] : [],
  );
  return copy.polish.on(carded.length - kept.length, carded.length, polish.model, kept, polish.keyFrom);
}
