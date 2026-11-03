import { copy } from "./copy.js";
import type { CaseRecord } from "./record.js";

/** The one polish line a case carries: what was on or off, and the one thing that would turn it on. */
export function polishLine(record: CaseRecord): string | undefined {
  const polish = record.enhancements?.polish;
  if (polish === undefined) return undefined;
  if (polish.state === "off") {
    if (polish.reason === "no --polish") return copy.polish.keySet(polish.keyFrom);
    if (polish.reason === "no key") return copy.polish.noKey(polish.keyFile, polish.keyCopy);
    return copy.polish.offBoth(polish.keyFile, polish.keyCopy);
  }
  const carded = record.checks.filter((c) => c.polish !== undefined);
  const kept = carded.flatMap((c) =>
    c.polish!.state === "kept-original" ? [`${c.id}: ${c.polish!.reason}`] : [],
  );
  return copy.polish.on(carded.length - kept.length, carded.length, polish.model, kept, polish.keyFrom);
}
