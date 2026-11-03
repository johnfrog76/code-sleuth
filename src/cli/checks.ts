import type { Check } from "../engine/check.js";
import { CHECKS } from "../engine/checks/index.js";
import { GOALS, type Goal, type Weight } from "../engine/goals.js";
import { copy } from "./copy.js";

/** The check table as `code-sleuth checks` prints it: from the code, never from a document. */
export function checksTable(goal?: Goal, table: readonly Check[] = CHECKS): string {
  const header = ["Check", "Title", "Needs"];
  let rows: string[][];
  if (goal === undefined) {
    header.push(...GOALS.map((g) => copy.goalTitle[g.id]));
    rows = table.map((check) => [
      ...describe(check),
      ...GOALS.map((g) => weightWord(g.checks.find((c) => c.id === check.id)?.weight)),
    ]);
  } else {
    header.push(copy.weightHeading);
    rows = goal.checks.map(({ id, weight }) => {
      const check = table.find((c) => c.id === id);
      if (check === undefined)
        throw new Error(`The goal ${goal.id} names a check that does not exist: ${id}`);
      return [...describe(check), weightWord(weight)];
    });
  }
  return columns([header, ...rows]);
}

function describe(check: Check): string[] {
  return [check.id, check.title, check.needs.length === 0 ? copy.none : check.needs.join(", ")];
}

function weightWord(weight: Weight | undefined): string {
  return weight === undefined ? copy.none : copy.weight[weight];
}

function columns(rows: string[][]): string {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((row) => row[i]!.length)));
  return rows
    .map(
      (row) =>
        row
          .map((cell, i) => cell.padEnd(widths[i]!))
          .join("  ")
          .trimEnd() + "\n",
    )
    .join("");
}
