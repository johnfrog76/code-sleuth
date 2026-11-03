export type Weight = "smoking-gun" | "loose-end" | "hunch";

export const WEIGHTS: readonly Weight[] = ["smoking-gun", "loose-end", "hunch"];

export type GoalId = "public" | "security" | "quality";

export interface Goal {
  id: GoalId;
  /** A check id and the weight this goal gives a `found` result, in checklist order. */
  checks: readonly { id: string; weight: Weight }[];
}

/** A check is defined once; a goal picks the checks it needs and says how much each one weighs. */
export const GOALS: readonly Goal[] = [
  {
    id: "public",
    checks: [
      { id: "secrets.tree", weight: "smoking-gun" },
      { id: "secrets.history", weight: "smoking-gun" },
      { id: "files.sensitive", weight: "smoking-gun" },
      { id: "license.file", weight: "smoking-gun" },
      { id: "license.deps", weight: "loose-end" },
      { id: "paths.machine", weight: "loose-end" },
      { id: "names.deny", weight: "smoking-gun" },
      { id: "files.large", weight: "loose-end" },
      { id: "docs.readme", weight: "loose-end" },
      { id: "docs.contributing", weight: "loose-end" },
      { id: "docs.conduct", weight: "loose-end" },
      { id: "docs.security", weight: "loose-end" },
      { id: "docs.changelog", weight: "hunch" },
      { id: "github.templates", weight: "loose-end" },
      { id: "ci.present", weight: "loose-end" },
      { id: "ci.tests", weight: "hunch" },
      { id: "workflows.permissions", weight: "hunch" },
      { id: "workflows.prtarget", weight: "loose-end" },
      { id: "workflows.injection", weight: "loose-end" },
      { id: "deps.lockfile", weight: "hunch" },
      { id: "deps.advisories", weight: "smoking-gun" },
      { id: "deps.updates", weight: "hunch" },
      { id: "deps.outdated", weight: "loose-end" },
      { id: "quality.markers", weight: "hunch" },
    ],
  },
  {
    id: "security",
    checks: [
      { id: "secrets.tree", weight: "smoking-gun" },
      { id: "secrets.history", weight: "smoking-gun" },
      { id: "files.sensitive", weight: "smoking-gun" },
      { id: "deps.advisories", weight: "smoking-gun" },
    ],
  },
  {
    id: "quality",
    checks: [
      { id: "docs.changelog", weight: "hunch" },
      { id: "deps.outdated", weight: "hunch" },
    ],
  },
];

export function findGoal(id: string): Goal | undefined {
  return GOALS.find((goal) => goal.id === id);
}
