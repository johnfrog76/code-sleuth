import { matchesGlob } from "node:path";
import type { Evidence } from "./check.js";

/**
 * Example locations: where a repository keeps deliberate bait -- a fake token, a home-folder path, a TODO --
 * for its own tests. A match there is shown and never counted (it makes no card and changes no verdict), and
 * the case says to check that it is fake: a real key committed into a fixture is still a real leak.
 */
export const EXAMPLE_MARKER = "code-sleuth:example";

/** The built-in example folders, at any depth. `--examples <glob>` adds more. */
export const BUILT_IN_EXAMPLE_GLOBS: readonly string[] = ["**/test/fixtures/**", "**/__fixtures__/**"];

/** The example locations in force for one run, as the case records them. */
export interface ExampleLocations {
  /** Every glob in force: the built-in ones, then each `--examples` glob in the order given. */
  globs: string[];
  /** The globs `--examples` added: named in the human output, because they widen what goes uncounted. */
  added: string[];
  /** A line carrying this text is an example wherever it is. */
  marker: string;
}

export function exampleLocations(added: readonly string[] = []): ExampleLocations {
  return { globs: [...BUILT_IN_EXAMPLE_GLOBS, ...added], added: [...added], marker: EXAMPLE_MARKER };
}

/** True for a line a person marked as an example. A check sets `marked` on the evidence it finds there. */
export function isMarked(text: string): boolean {
  return text.includes(EXAMPLE_MARKER);
}

/** True for evidence in an example location: on a marked line, or under a folder an example glob names. */
export function isExampleEvidence(evidence: Evidence, locations: ExampleLocations): boolean {
  return evidence.marked === true || locations.globs.some((glob) => matchesGlob(evidence.path, glob));
}
