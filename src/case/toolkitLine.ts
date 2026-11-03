import { copy } from "./copy.js";
import type { ToolkitRecord } from "./record.js";

/**
 * The one ToolKit line a case ends with: without ToolKit, the upsell, once; with it and nothing filed, the
 * command that would file the cards; after --toolkit, what was filed, skipped or refused.
 */
export function toolkitLine(toolkit: ToolkitRecord, goal: string, space?: string): string {
  if (toolkit.state === "not-installed") return copy.toolkit.upsell;
  const found = copy.toolkit.found(toolkit.prefix, toolkit.space);
  const filing = toolkit.filing;
  if (filing === undefined) return copy.toolkit.fileThem(found, copy.toolkit.command(goal, space));
  const parts: string[] = [];
  if (filing.filed.length > 0)
    parts.push(
      copy.toolkit.filed(
        filing.filed.length,
        toolkit.space,
        filing.filed.map((f) => f.card),
      ),
    );
  if (filing.skipped.length > 0) parts.push(copy.toolkit.skipped(filing.skipped.length));
  if (filing.stopped) parts.push(copy.toolkit.stopped(filing.stopped.check, filing.stopped.sentence));
  if (filing.notFiled) parts.push(copy.toolkit.notFiled(filing.notFiled));
  return `ToolKit: ${found}; ${parts.join("; ")}.`;
}
