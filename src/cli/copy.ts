import { BANNER } from "./banner.js";

export const copy = {
  help: (version: string) => `${BANNER}
Code Sleuth ${version}

So, you want to know what's going on with your repo?

Usage
  code-sleuth [<folder>] [--goal public]   investigate a repository; the folder defaults to here
  code-sleuth checks [--goal <goal>]       list the checks and what each goal makes of them
  code-sleuth --help                       show this help
  code-sleuth --version                    show the version

Options
  --goal public        the question to answer: is it ready to go public?
  --out <dir>          where the case folder goes (never inside the repository)
  --deny <file>        a list of names that must not appear, one per line, kept outside the repository
  --all                hunches get cards too
  --polish             have each card reworded by a model, every path and number kept (needs an API key)
  --offline            make no network call: the checks that would call out read not investigated
  --examples <glob>    another example location, beside test/fixtures/ and __fixtures__/; repeatable
  --json               print case.json to stdout, and the rest to stderr
  --fail-on <weight>   exit 1 when a smoking-gun (or a loose-end and worse) is found

ToolKit
  --toolkit                 file the cards as ToolKit cards, through ToolKit's own NewPrompt; asks first
  --yes                     with --toolkit, file without asking
  --refile                  with --toolkit, file a check again even though it is already filed
  --toolkit-prefix <p>      ToolKit's command prefix, if it is not tk
  --toolkit-space <slug>    file in this Space, without changing ToolKit's own setting

Exit codes: 0 the case is closed, whatever it found; 1 only with --fail-on; 2 a stated refusal.
`,
  unknownFlag: (flag: string) => `I don't know the flag ${flag}.`,
  unexpectedArgument: (arg: string) => `I don't take ${arg} yet.`,
  seeHelp: "Run code-sleuth --help to see what I take.",
  unknownGoal: (goal: string) => `I don't know the goal ${goal}.`,
  goalHint: "The goals are public, security and quality.",
  goalNotYet: (goal: string) =>
    `The ${goal} goal isn't ready to investigate yet: it comes in the next release.`,
  goalNotYetHint:
    "Use --goal public for now. code-sleuth checks --goal <goal> shows what each goal will check.",
  ask: {
    choices: "Which do you want to know?\n  1. Is it ready to go public?\n",
    prompt: "Pick a number [1]: ",
    notAChoice: (answer: string) => `${answer} isn't one of the choices.`,
    notAChoiceHint: "Answer with the number, or give --goal public.",
  },
  noGoal: "I need to know what you want to know, and there's no terminal to ask in.",
  noGoalHint: "Give --goal public.",
  url: (path: string) => `${path} is a URL. I investigate a folder on this machine.`,
  urlHint: "Clone it first (git clone <url>), then point me at the folder.",
  missing: (path: string) => `I can't find ${path}.`,
  missingHint: "Point me at a folder on this machine.",
  notAFolder: (path: string) => `${path} is a file, not a folder.`,
  notAFolderHint: "Point me at the repository's folder.",
  unreadable: (path: string) => `I can't read ${path}.`,
  unreadableHint: "Check its permissions, or point me at a folder you can read.",
  denyUnreadable: (path: string) => `I can't read the deny list ${path}.`,
  denyUnreadableHint: "Give --deny a file you can read, with one name per line.",
  denyInside: (path: string) => `The deny list ${path} is inside the repository I'm investigating.`,
  denyInsideHint:
    "Keep the deny list outside the repository: committed there, it would publish the names it guards.",
  unknownWeight: (weight: string) => `I don't know the weight ${weight}.`,
  unknownWeightHint: "--fail-on takes smoking-gun or loose-end.",
  polish: {
    fromEnvironment: "the environment",
    looseKeyFile: (path: string) =>
      `Warning: ${path} can be read by other people on this machine. Make it yours alone: chmod 600 '${path.replace(/'/g, "'\\''")}'\n`,
  },
  toolkit: {
    onlyWithToolkit: (flag: string) => `${flag} only goes with --toolkit.`,
    onlyWithToolkitHint: "Add --toolkit to file the cards in ToolKit, or leave the flag off.",
    notInstalled: (reason: string) => `ToolKit isn't here to file the cards: ${reason}.`,
    notInstalledHint:
      "Install ToolKit (https://johnfrog76.github.io/toolkit/) and run its InstallAutoload, or leave --toolkit off: the cards are in the case file either way.",
    undeclaredSpace: (slug: string) => `ToolKit doesn't confirm the Space '${slug}'.`,
    undeclaredSpaceHint: (declared: string) => `The Spaces ToolKit declares: ${declared}. Nothing was filed.`,
    spacesUnknown: "ToolKit didn't say (it is older than this version of Code Sleuth expects)",
    consent: (n: number, space: string | null) =>
      `File ${n} card${n === 1 ? "" : "s"} in ToolKit${space === null ? "" : `, in the Space '${space}'`}? [y/N] `,
    noTerminal: "there's no terminal to ask in, so add --yes to file without asking",
    declined: "you said no",
    nothingNew: "every card is already filed",
    filedLine: (check: string, card: string, folder: string | undefined) =>
      `  Filed    ${check} as ${card}${folder === undefined ? "" : `, in ${folder}/`}\n`,
    skipLine: (check: string, card: string, date: string) =>
      `  Skipped  ${check}: already filed as ${card} on ${date}; --refile to file it again\n`,
    refused: (check: string, sentence: string) => `ToolKit refused the card for ${check}: ${sentence}`,
    refusedHint:
      "The cards before it are filed and on the ledger, and the rest were not. Fix what ToolKit says, then run with --toolkit again.",
    failed: (check: string, sentence: string) => `ToolKit failed on the card for ${check}: ${sentence}`,
    failedHint: (prefix: string) =>
      `The cards before it are filed and on the ledger. Run ${prefix}Log -Errors to see what went wrong, then run with --toolkit again.`,
    footer: "ToolKit",
  },
  run: {
    title: (id: string) => `Code Sleuth -- case ${id}`,
    question: "So, you want to know what's going on with your repo?",
    repo: "Repo",
    goal: "Goal",
    out: "Out",
    nothingLeaves: "nothing: this run makes no network calls",
    polishLeaves: "the polish request: each card's text, masked, to the Anthropic API (--polish)",
    offlineSkips: (call: string) => `${call} (--offline skips it)`,
    polishing: (n: number, model: string) => `Polishing ${n} card${n === 1 ? "" : "s"} with ${model} `,
    polish: "Polish",
    examples: "Examples",
    stakeout: (leads: number) => `Taking my time. ${leads} lead${leads === 1 ? "" : "s"} to run down `,
    tick: ".",
    done: " done.",
    andMore: (n: number) => `  ... and ${n} more`,
    at: (where: string, more: number) => (more > 0 ? `${where}, and ${more} more` : where),
    caseFile: "Case file",
    cards: "Cards",
    cardsIn: (n: number) => `${n} in cards/`,
    noCards: "none",
    hunchCards: " (hunches get cards with --all)",
  },
  goalTitle: { public: "Going public", security: "Security", quality: "Quality" },
  weight: { "smoking-gun": "smoking gun", "loose-end": "loose end", hunch: "hunch" },
  weightHeading: "Weight",
  none: "--",
} as const;
