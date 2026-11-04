# Architecture

How the parts fit. One package, TypeScript on Node 24, ES modules, one runtime dependency (`yaml`).

```text
CLI (src/cli/)  ->  case writer (src/case/)  ->  engine (src/engine/)  ->  repository reader
                          |                         |
                          |                         +-> checks, goals, secret rules
                          +-> polish (src/polish/)  ->  one request to the Messages API
                          +-> ToolKit (src/toolkit/) ->  handoff.ps1  ->  ToolKit's NewPrompt
```

## The parts

- **The repository reader** (`src/engine/repo.ts`). Lists tracked files through `git ls-files` when the folder
  is in a work tree, else every file under it; reads text, file sizes, the history (`git log -p --all`) and
  commit messages. It reads, and never writes. Every git call goes through its `git()`, which turns off the
  commands a repository's own git configuration could name (`GIT_SAFE_CONFIG`, and each filter driver).
- **The check contract** (`src/engine/check.ts`). A check has a goal-free id, a title, what the books call it,
  what it needs, its words, its card's words, and a pure `run(repo, context)` that returns `clean`, `found`
  with evidence, or `not-investigated` with a reason. The check table is `src/engine/checks/`, one file per
  check; their words are `src/engine/copy.ts`.
- **The goals** (`src/engine/goals.ts`). A goal is an ordered list of check ids, each with a weight. The engine
  (`src/engine/engine.ts`) runs a goal: a check whose need is missing is not investigated and its rule never
  runs, and evidence weighed as a name guess or an example lowers the weight.
- **The secret rules** (`src/engine/secrets/`). Regex strings in the subset every engine reads alike; `scan.ts`
  matches, masks and hashes them.
- **The case writer** (`src/case/`). `openCase` refuses a cases folder that overlaps the repository, runs the
  goal, and holds the case open; `close` writes `case.json`, `case.md` and `cards/` once. The record, the
  cards and the checklist are pure functions (`record.ts`, `card.ts`, `markdown.ts`).
- **The CLI** (`src/cli/`). `run.ts` parses the flags (`OPTIONS`) and is what the tests call;
  `investigate.ts` refuses what it cannot do, takes the case, reports it, polishes, files, and closes it;
  `output.ts` draws the terminal. Its words are `src/cli/copy.ts`.
- **The polish client** (`src/polish/`). One `fetch` per card to a fixed address; `guard.ts` keeps a rewrite
  only when every path, number, masked value and the fingerprint survive. [POLISH.md](POLISH.md).
- **The atoms** (`src/atoms/`). The sloth private eye, the verdict stamp and the logo as SVG React components,
  for the office and the landing page; the command does not use them, and they are not in the published build.
  `figures.tsx` is the character as drawn for the deck, one source for the deck and the product, with its
  changes named in its header; `atoms.tsx` frames each as a standalone SVG with a title and no words in the
  art. `scripts/render-atoms.mjs` renders them to images with headless Chrome, a dev tool only, and wrote
  `assets/`.
- **Child processes** (`src/spawn.ts`). Every child -- git, npm, gh and ToolKit's shell -- starts through
  `spawnChild`: an argument array, never a command string, and an environment with the model key taken out. A
  test holds every other file in `src/` away from `node:child_process`.
- **The ToolKit hand-off** (`src/toolkit/`, `toolkit/handoff.ps1`). Finds a shell, probes ToolKit, files cards
  through ToolKit's own command, and keeps the ledger. [TOOLKIT.md](TOOLKIT.md).

A case is held open while it is shown, polished and filed, and written once at the end, so nothing in a case
folder is ever rewritten.

## The repository

| Folder | Holds |
| --- | --- |
| `src/` | the package, by the parts above |
| `toolkit/` | `handoff.ps1`, the one PowerShell file, shipped with the package |
| `assets/` | the logo (light and dark), the favicon and the social preview, made by `scripts/render-atoms.mjs` |
| `site/` | the project's page on GitHub Pages: plain HTML and CSS, with copies of the logo and favicon. `.github/workflows/pages.yml` publishes it on every push to main that changes it. Not shipped |
| `scripts/` | development tools, not shipped |
| `test/` | the tests ([TESTING.md](TESTING.md)) |
| `docs/` | these documents ([README.md](README.md) is the map) |
| `design/` | design notes: ideas being worked out |
| `spec/` | specs: the contracts that get built. `spec/code-sleuth.spec.md` is the contract this code is held to |
