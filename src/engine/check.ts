import type { NpmRunner, ToolRunner } from "./npm.js";
import type { RepoReader } from "./repo.js";

/** What a check needs to run. A need that is missing makes the check `not-investigated`, never `clean`. */
export type Need = "git" | "npm" | "gh" | "pip-audit" | "network" | "denyList";

/** The path a finding in a commit message carries, in place of a file's. */
export const COMMIT_MESSAGE = "commit message";

export interface Evidence {
  /** Relative to the repository root, always with `/`. */
  path: string;
  line?: number;
  /** Already masked when it could hold a secret. */
  excerpt?: string;
  /** The rule that matched, when a check has more than one. */
  rule?: string;
  /** The commit a line was added in, for a finding in history. */
  commit?: string;
  /** A keyed hash of a secret's value, so two runs can tell it is the same secret. Never the value. */
  valueHash?: string;
  /**
   * Why this evidence weighs less than the goal says: `name-guess` and a `moderate` advisory step it down one
   * weight, a `low` advisory two. The case says so.
   */
  weighed?: "name-guess" | "moderate" | "low";
  /** The line carries the example marker, `code-sleuth:example`: an example wherever it is (src/engine/examples.ts). */
  marked?: true;
}

export type Result =
  | { verdict: "clean" }
  | { verdict: "found"; evidence: Evidence[] }
  | { verdict: "not-investigated"; reason: string };

export type Verdict = Result["verdict"];

/** What a run gives every check besides the repository. */
export interface CheckContext {
  /** The keyed hash a finding carries in place of a secret's value. */
  hashSecret(value: string): string;
  /** The lines of the `--deny` list, when one was given. It lives outside the repository. */
  denyList?: readonly string[];
  /** npm, when the run found it: checks that need `npm` call it through here, never through a shell. */
  npm?: NpmRunner;
  /** The GitHub CLI, when the run found it: checks that need `gh` call it through here. */
  gh?: ToolRunner;
}

/** The detective's lines for a check. They live in a copy file, never in the rule. */
export interface Voice {
  clean: string;
  found: string;
}

/** What a card says about a check: a plain title for a backlog, and the fix in plain words. */
export interface CardCopy {
  /** At most 80 characters, with no detective words: it is read among other cards. */
  title: string;
  fix: string;
  /** Extra acceptance lines. Every card also ends with the check reading Clean. */
  doneWhen?: readonly string[];
}

export interface Check {
  /** Goal-free, dotted, stable once released: `secrets.tree`. */
  id: string;
  /** What it looks for, in plain words. */
  title: string;
  /** What the books call it, in one plain term. */
  booksName: string;
  needs: readonly Need[];
  voice: Voice;
  card: CardCopy;
  /**
   * The call this check would make off the machine, said in one line for the run's header, or undefined when
   * it would make none: a check that may call out says so before any check runs, and never calls unnamed.
   */
  outgoing?(repo: RepoReader, capabilities: ReadonlySet<Need>): string | undefined;
  /** Pure over the repository reader and the context. */
  run(repo: RepoReader, context: CheckContext): Result;
}
