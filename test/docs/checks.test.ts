import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copy } from "../../src/cli/copy.js";
import { CHECKS } from "../../src/engine/checks/index.js";
import { GOALS } from "../../src/engine/goals.js";

// docs/CHECKS.md is held to the code: every check, with the same weights, and none that does not exist.
const page = readFileSync(new URL("../../docs/CHECKS.md", import.meta.url), "utf8");

const table = page
  .split("\n")
  .filter((line) => /^\| `[a-z.A-Z]+` \|/.test(line))
  .map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim()),
  );

const weightOf = (goal: string, id: string) => {
  const weight = GOALS.find((g) => g.id === goal)!.checks.find((c) => c.id === id)?.weight;
  return weight === undefined ? copy.none : copy.weight[weight];
};

describe("docs/CHECKS.md", () => {
  it("lists every check in the table, in the code's order, and no other", () => {
    expect(table.map(([id]) => id!.replace(/`/g, ""))).toEqual(CHECKS.map((c) => c.id));
  });

  it.each(CHECKS.map((c) => [c.id]))("gives %s the weights the goals give it", (id) => {
    const row = table.find(([cell]) => cell === `\`${id}\``)!;
    expect(row.slice(1)).toEqual(["public", "security", "quality"].map((goal) => weightOf(goal, id)));
  });

  it.each(CHECKS.map((c) => [c.id, c.title]))("describes %s under its own heading", (id, title) => {
    expect(page).toContain(`### \`${id}\`: ${title}`);
  });

  it("names no check the code does not have", () => {
    const named = [...page.matchAll(/^### `([^`]+)`/gm)].map((m) => m[1]);
    expect(named).toEqual(CHECKS.map((c) => c.id));
  });
});
