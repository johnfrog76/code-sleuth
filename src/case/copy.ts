import type { Weight } from "../engine/goals.js";
import type { CaseVerdict, Counts } from "./record.js";

const NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function count(n: number, one: string, many: string): string {
  return `${NUMBERS[n] ?? String(n)} ${n === 1 ? one : many}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The words of a case file. The rules never hold words; the check copy holds each check's own. */
export const copy = {
  outInsideRepo: (out: string) => `The cases folder ${out} is inside the repository I'm investigating.`,
  outInsideRepoHint: "Give --out a folder outside the repository: I never write into the tree I'm judging.",
  repoHoldsCases: (repo: string) => `${repo} holds my cases folder, so I'd be reading my own case files.`,
  repoHoldsCasesHint: "Point me at the repository itself, not at a folder above it.",

  stamp: { ready: "READY", nearly: "NEARLY", "not-ready": "NOT READY" } satisfies Record<CaseVerdict, string>,

  goal: { public: "going public", security: "security", quality: "quality" } as Record<string, string>,

  verdict: {
    public: {
      ready: "ready to go public",
      nearly: "nearly ready to go public",
      "not-ready": "not ready to go public",
    },
    security: {
      ready: "nothing stands out on security",
      nearly: "nearly clean on security",
      "not-ready": "not safe yet",
    },
    quality: { ready: "in good shape", nearly: "nearly in good shape", "not-ready": "not in good shape yet" },
  } as Record<string, Record<CaseVerdict, string>>,

  /** `The verdict: not ready to go public. Two smoking guns, three loose ends.` */
  verdictLine(goal: string, verdict: CaseVerdict, counts: Counts): string {
    const found = [
      count(counts["smoking-gun"], "smoking gun", "smoking guns"),
      count(counts["loose-end"], "loose end", "loose ends"),
    ];
    return `The verdict: ${copy.verdict[goal]![verdict]}. ${capitalise(found.join(", "))}.`;
  },

  countsLine: (counts: Counts) =>
    [
      `${counts["smoking-gun"]} smoking gun${counts["smoking-gun"] === 1 ? "" : "s"}`,
      `${counts["loose-end"]} loose end${counts["loose-end"] === 1 ? "" : "s"}`,
      `${counts.hunch} hunch${counts.hunch === 1 ? "" : "es"}`,
      `${counts.clean} clean`,
      `${counts["not-investigated"]} not investigated`,
    ].join(", ") + ".",

  repoLine(name: string, branch: string | null, head: string | null, dirty: boolean | null): string {
    if (head === null && branch === null) return `${name} (not a git repository)`;
    const at = head === null ? "no commits" : head.slice(0, 7);
    const state = dirty === null ? "" : dirty ? ", dirty" : ", clean";
    return `${name} (${branch ?? "detached"} @ ${at}${state})`;
  },

  groups: {
    "smoking-gun": "Smoking guns",
    "loose-end": "Loose ends",
    hunch: "Hunches",
    clean: "Clean",
    "not-investigated": "Not investigated",
  } satisfies Record<Weight | "clean" | "not-investigated", string>,

  notInvestigated: (reason: string) => `Not investigated. ${reason}`,
  firstEvidence: (where: string, more: number) =>
    more > 0 ? ` First: ${where}, and ${more} more.` : ` ${where}.`,
  cardLink: "card",

  examples: {
    /** After a clean check's line, when its only matches were in example locations. */
    clean: (n: number) =>
      `Clean, apart from ${n} match${n === 1 ? "" : "es"} in example locations, not counted.`,
    /** After a found check's evidence, when some of its matches were in example locations. */
    alsoFound: (n: number) => ` And ${n} more in example locations, not counted.`,
    /** The footer line: never silent about what went uncounted. */
    line: (n: number) =>
      `${n} match${n === 1 ? "" : "es"} in example locations ${n === 1 ? "was" : "were"} not counted; check that ${n === 1 ? "it is" : "they are"} fake.`,
    added: (globs: string[]) => ` --examples added: ${globs.join(", ")}.`,
  },

  polish: {
    offBoth: (keyFile?: string, keyCopy?: string) =>
      keyFile === undefined
        ? "off. Add an API key (see .env.example) and --polish to have the cards reworded."
        : `off. Add an API key and --polish to have the cards reworded. ${copy.polish.addKey(keyFile, keyCopy)}`,
    keySet: (from?: string) =>
      `an API key is set${from === undefined ? "" : ` (from ${from})`}: add --polish to have the cards polished.`,
    noKey: (keyFile?: string, keyCopy?: string) =>
      `No API key. The cards are as the sleuth wrote them.${keyFile === undefined ? "" : ` ${copy.polish.addKey(keyFile, keyCopy)}`}`,
    /** Where an API key goes, and the line that puts the example there when the example was found. */
    addKey: (keyFile: string, keyCopy?: string) =>
      keyCopy === undefined
        ? `To add one, copy .env.example to ${keyFile} and fill it in.`
        : `To add one, run \`${keyCopy}\` and fill it in.`,
    on: (polished: number, total: number, model: string, kept: string[], from?: string) =>
      `${polished} of ${total} card${total === 1 ? "" : "s"} polished by ${model}` +
      (from === undefined ? "" : `, with the API key from ${from}`) +
      (kept.length === 0 ? "." : `; ${kept.length} kept as written (${kept.join(", ")}).`),
  },

  toolkit: {
    upsell:
      "Want these as real cards, in your own files, on your own board? That's what ToolKit is for: https://johnfrog76.github.io/toolkit/",
    found: (prefix: string, space: string | null, from?: "flag" | "origin" | "active") =>
      `found (${prefix}${space === null ? "" : `, Space '${space}'`}${
        from === "origin"
          ? ", this repository's own"
          : from === "active" && space !== null
            ? ", the active one: no Space matches this repository"
            : ""
      })`,
    command: (goal: string, space: string | undefined) =>
      `code-sleuth --goal ${goal} --toolkit${space === undefined ? "" : ` --toolkit-space ${space}`}`,
    fileThem: (found: string, command: string) => `ToolKit: ${found}. To file these cards: \`${command}\``,
    filed: (n: number, space: string | null, cards: string[]) =>
      `filed ${n} card${n === 1 ? "" : "s"}${space === null ? "" : ` in the Space '${space}'`}${cards.length > 0 ? ` (${cards.join(", ")})` : ""}`,
    skipped: (n: number) => `${n} ${n === 1 ? "was" : "were"} already filed`,
    stopped: (check: string, sentence: string) =>
      `ToolKit refused the card for ${check}: ${sentence} The cards after it were not filed`,
    notFiled: (reason: string) => `nothing filed: ${reason}`,
  },

  card: {
    evidence: "**Evidence**",
    booksName: (name: string) => `**What the books call it:** ${name}`,
    fix: "**The fix**",
    doneWhen: "**Done when**",
    readsClean: (goal: string, id: string) => `\`code-sleuth --goal ${goal}\` reads \`${id}\` as Clean.`,
    more: (n: number) => `and ${n} more in the case file`,
    rule: (id: string) => `rule: ${id}`,
    addedIn: (commit: string) => `added in ${commit}`,
    inCommit: (commit: string) => `in commit ${commit}`,
    weighed: {
      "name-guess": "a guess from its name, so weighed one step down",
      moderate: "a moderate advisory, so weighed one step down",
      low: "a low advisory, so weighed two steps down",
    },
    fingerprint: (id: string, caseId: string, head: string | null) =>
      `Found by Code Sleuth: ${id}, case ${caseId}${head === null ? "" : `, at ${head.slice(0, 7)}`}.`,
  },
};
