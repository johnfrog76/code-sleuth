import { copy } from "./copy.js";
import type { CaseRecord } from "./record.js";

/** How many example matches a case did not count, across every check. */
export function uncountedExamples(record: CaseRecord): number {
  return record.checks.reduce((n, check) => n + (check.examples?.length ?? 0), 0);
}

/**
 * The one line about example locations: how many matches went uncounted, with a reminder to check that they
 * are fake, and the globs `--examples` added. Absent when there is neither.
 */
export function examplesLine(record: CaseRecord): string | undefined {
  const n = uncountedExamples(record);
  const added = record.exampleLocations.added;
  if (n === 0 && added.length === 0) return undefined;
  const counted = n === 0 ? "" : copy.examples.line(n);
  const widened = added.length === 0 ? "" : copy.examples.added(added);
  return (counted + widened).trim();
}
