---
id: 5b24752c-24b4-4664-b1b7-61207681fdd5
description: "Design contract for Code Sleuth: a sloth private eye that investigates a repository against one goal (going public, security or quality) and hands back a checklist and card-ready issues, with a polish pass when a model key is set and real ToolKit cards when ToolKit is installed. A CLI and a GUI office over one engine, built in a public repository."
---

# Code Sleuth (spec)

**Code Sleuth -- point it at a repo, pick a goal, run. A checklist and card-ready issues come back.**
Version 0.2 -- 2026-11-02 -- building starts. The first decisions are accepted decisions
D-CS1 to D-CS11 below. D-CS12 to D-CS17 were the open questions; all six are answered,
D-CS9, D-CS12 and D-CS14 as amended there. D-CS18 to D-CS27 are this spec's own engineering calls, proposed
for review.

> **Amended 2026-11-03:** sections 5.2 and 5.4, for dependencies that are current. `deps.outdated` is
> built and weighed in the going-public goal: a loose end when any direct dependency is a major version or more
> behind (a `0.x` minor counts), its evidence listing each one; quality keeps it as a hunch. It reads clean
> with no `package.json` and makes no call, and not investigated with no npm lockfile. Section 5.4 gains a
> row: `npm outdated`, sending package names to npm's configured registry. `--offline` turns it off.
>
> `deps.advisories` is built: `npm audit --json` when npm is found, else `gh api /advisories` when `gh`
> is. It is a smoking gun in going public (amended from L) and in security, lowered by each advisory's
> severity: critical or high stays a smoking gun, moderate is a loose end, low or info a hunch, and the
> heaviest decides. It reads clean with no `package.json` and makes no call, and not investigated with no npm
> lockfile, with `--offline`, or with neither tool. Section 5.4's `gh api` row is amended: it sends the
> lockfile's package names and versions, in batches (GitHub's `affects` filter), not a date window; the
> crediting of each advisory to a locked version is local. `npm audit` goes to npm's configured registry.
> Whether `gh` is signed in is not asked ahead, since asking calls GitHub: a `gh` that is not reads not
> investigated with the reason.

> **Amended 2026-11-03:** section 7's key. It is read from `ANTHROPIC_API_KEY`, in the environment or in Code
> Sleuth's own `.env`, and never written or printed. The `.env` is the one in Code Sleuth's per-user folder,
> beside the cases folder; no other is read, not the investigated repository's and not the current folder's.
> It is parsed with `util.parseEnv`, never loaded, so the key never reaches a child process's environment, and
> the environment wins over the file. The run names where the key came from, never the key; on POSIX it warns
> once when others can read the file. `.env.example` ships at the root. What people read says "API key"; the
> variable's name is in `.env.example` and in `docs/CONFIGURATION.md` alone.

> **Amended 2026-11-03:** section 8.2's Space. Without `--toolkit-space`, the cards go to the Space whose
> address is the repository's `origin` (a GitHub Space's `org` is the repository's URL; an Azure DevOps
> Space's `org` is the organisation, and its `projects[].repo` lists the repository). The probe reports each
> declared Space's `slug`, `org` and `repos` as `addresses`. With no single match, the active Space is used and
> the footer says so; the case records `spaceFrom` (`flag`, `origin` or `active`). The chosen Space reaches
> ToolKit as `P20_ACTIVE_SPACE` in the child shell only, as `--toolkit-space` does.

> **Amended 2026-11-03:** section 5.3's example rule. A match in an example location (a path under
> `test/fixtures/` or `__fixtures__/` at any depth, a line carrying `code-sleuth:example`, or a path matching
> an `--examples <glob>`) is no longer reported as a hunch. It applies to every check, is shown and never
> counted, makes no card and changes no verdict; a check whose only matches were examples reads clean and says
> so, and the case ends with one line asking that they be checked as fake. `case.json` keeps every example
> match under the check's `examples`, and records the locations in force as `exampleLocations`. `caseFile`
> stays 1: nothing had been released.

> The buildable contract of the design note `design/code-sleuth.md` (titled "Repo Detective"; the
> product is now named Code Sleuth). The note keeps the idea in its first words; this spec holds the
> contract. It pairs with the note by the note's id, which it carries, per ToolKit's `docs/hub/design.md`.
> It also reads ToolKit's `docs/hub/cards.md`. Every claim about ToolKit is grounded in the
> ToolKit tree at `5f4e341`; where one is not, it says `TBD -- needs verification`.

---

## 1. Summary

> So, you want to know what's going on with your repo?

Code Sleuth is a private investigator for a codebase. You point it at a repository on your machine, you
say what you want to know -- is it ready to go public, is it safe, is it well kept -- and it investigates,
slowly and carefully, and hands back a case file: a verdict, a checklist to the goal you picked, and one
card-ready issue per thing that stands between the repository and that goal.

The detective is a sloth in a hat and a trench coat. Slow is the point: it takes its time and gets it
right. Every finding it reports comes from a deterministic check that names the file, the line and the
rule; the private-eye voice is how it talks, never what it knows.

It is useful with nothing else installed, and better with each thing you add:

| You have | You get |
| --- | --- |
| a repository | the investigation, the checklist and the cards, as markdown in a case file |
| + an API key, in Code Sleuth's `.env` or the environment | the polish pass: each card rewritten to read well, with every path, number and masked value kept |
| + ToolKit installed | the cards filed as real ToolKit cards, in your own files, through ToolKit's own verb |

No stage blocks another. ToolKit is the upsell: the cards show what ToolKit is for.

**The bar is simple, helpful, fun.** Simple: point it at a repo, pick a goal, run. Helpful: a checklist and
card-ready issues. Fun: private-eye language, the detective's office. A proposal that misses one of the
three says which.

**If behaviour and this spec disagree, the behaviour is the bug.** Code Sleuth never writes into the
repository it investigates.

## 2. Principles

1. **Read-only on the repository.** The investigation reads files and git history and writes nothing into
   the tree it was pointed at: no case file, no cache, no config. A tool that tells you your tree is dirty
   must not be the thing that dirtied it (D-CS18).
2. **Deterministic first, the model only polishes.** Every verdict is a rule over files. The same
   repository at the same commit, under the same goal, gives the same case file, except for its
   timestamps. The model never decides whether something is a finding; it rewrites prose a finding already
   has, and a rewrite that changes a fact is thrown away (D-CS15, D-CS20).
3. **Progressive enhancement.** Each capability adds to the one before, and its absence is said in one line
   rather than failing the run. A check that cannot run reads `not investigated`, with why. It is never a
   silent pass (D-CS5).
4. **One goal, one checklist.** A run answers one question. A check is defined once; a goal picks the
   checks it needs and says how much each one weighs (D-CS4, D-CS24).
5. **A secret never leaves the machine and is never printed whole.** A secret's value is masked in every
   output -- the terminal, the case file, the office, the polish request, a ToolKit card (D-CS21).
6. **PI on the outside, plain facts inside.** The voice is the detective's; the evidence is file, line, rule
   and fix in plain words. Every finding also names what the books call it, in one plain term, so an
   engineer can look it up.
7. **Written for strangers.** It is a public product from its first commit. Its issues, pull requests,
   docs and output are written for someone who has never heard of the people who built it (D-CS9).
8. **One engine, two faces.** The CLI and the office show the same case from the same engine (D-CS8).

## 3. Decisions

### 3.1 Accepted

| # | Decision |
| --- | --- |
| D-CS1 | **The name is Code Sleuth.** The design note's "Repo Detective" is the working title it was written under |
| D-CS2 | **The mascot is a sloth detective** in a hat and trench coat: cute, slow and smart. Slow is the point: it takes its time and gets it right. **The sloth is the hero SVG atom**, one source reused in the office, the landing page, the docs and the deck (section 10) |
| D-CS3 | **The bar is simple, helpful, fun.** Simple: point it at a repo, pick a goal, run. Helpful: a checklist plus card-ready issues. Fun: private-eye language, the detective's office, "So, you want to know what's going on with your repo?" |
| D-CS4 | **Goal first.** One goal per run, one checklist. The v1 goals are **going public**, **security** and **quality** |
| D-CS5 | **Progressive enhancement.** A repository alone gives the investigation, the checklist and card-ready issues as markdown. An Anthropic API key in the environment adds the polish pass, run on Haiku, small and fast, which polishes each card. ToolKit installed adds real ToolKit cards through its CLI or its agent API. No stage blocks another |
| D-CS6 | **A key is never written to a file.** It is read from the environment and nowhere else; no setting, no form and no case file holds it |
| D-CS7 | **ToolKit is the upsell.** The cards show what ToolKit is for. Without ToolKit the case file ends with one line saying what it would add; with it, the cards become real cards |
| D-CS8 | **A CLI and a GUI.** The GUI is the detective's office |
| D-CS9 | **Amended: private until its first outside user, then public at the first friend.** The repository (`johnfrog76/code-sleuth`) starts private and is flipped public before anyone else is asked to try it; it is never published to npm until it has earned it (D-CS14). It is still written for strangers from the first commit -- issues, pull requests and docs -- so the flip changes nothing but the setting |
| D-CS10 | **It reuses ToolKit's landing-page component shape, sharing components but never words.** Its landing page's copy is its own |
| D-CS11 | **It ships with docs and a deck.** The deck is built separately, shipped as files, and is out of this spec's scope beyond a pointer (section 10.4) |

### 3.2 The open questions: answered

All six were accepted as recommended, with two amendments: the repository starts private (D-CS9), and the
first release is used from a checkout, not from npm (D-CS14).

| # | Question | Recommendation, and why | The alternatives, and their cost |
| --- | --- | --- | --- |
| D-CS12 | Where does it live? | **ACCEPTED, private until the first friend (D-CS9).** **Its own repository, `code-sleuth`, and its own Space in the hub, `code-sleuth`**, a GitHub Space whose answer to "How do you want to work?" is `agents`, so its issues are worked with Team Agile. Connected the usual way (`NewSpace code-sleuth -Repo <owner>/code-sleuth`, then `HowWeWork`). Its own repo because it must run where ToolKit is not installed (D-CS5) and because it is public from day one (D-CS9); its own Space because it is a product with its own tracker, and the hub's Spaces are one per product | **(b) A ToolKit module** (`features.codeSleuth`): free reuse of the bridge, the store and the web shell, but it would need ToolKit installed, which breaks the first stage of D-CS5 and turns the upsell inside out. **(c) Its own repository, no Space**: worked without a board; its issues would not show in the standup or triage |
| D-CS13 | The stack | **ACCEPTED.** **TypeScript on Node 24 LTS, one npm package, one runtime.** The CLI is the package's `bin` (`npx code-sleuth`, or `npm i -g code-sleuth`); the office is a React and Vite app built into the same package and served by the CLI's own local server (`code-sleuth office`). One language for the engine, the CLI, the office and the landing page, which is what lets the landing components and the sloth atom be shared as TypeScript (D-CS10). The team already runs React, TypeScript and Vite well, and Node 24 is already the family's pinned runtime. The first ecosystem it reads deeply is npm, where the package scan seed lives. Git, npm, `gh` and `pip-audit` are called as child processes when they are on the PATH, never required | **(b) Python, FastAPI and a built React front** (`pipx install code-sleuth`): the agent's stack, a good fit for scanning, but a second toolchain for the office and the landing page, and two runtimes for a contributor. **(c) PowerShell** like the ToolKit CLI: matches the house, but a stranger without `pwsh` cannot run it, and the GUI would need a second runtime anyway. **(d) A single binary** (Bun or Deno compile): one file to install, but a less familiar build and a larger download; worth revisiting once the CLI is stable |
| D-CS14 | The v1 scope cut | **ACCEPTED, amended: 0.1.0 is used from a checkout** (`npm link`, or `npx github:johnfrog76/code-sleuth` once public, through a `prepare` build), by its maintainers first and then by friends; **publishing to npm is its own milestone, taken only once it is proven** (section 11). **The first release (0.1.0) is the whole loop on one goal: the CLI, the going-public goal, the markdown case file, the polish pass and the ToolKit hand-off through ToolKit's CLI.** The hand-off through ToolKit's agent waits for the office in 0.3.0, the one face that is already a local server. The loop -- investigate, checklist, cards, polish, ToolKit card -- is the product, and the two enhancements are thin layers over the case file, so shipping them first proves progressive enhancement on day one rather than promising it. Going public is the goal with the best-known checklist (the public bar ToolKit itself was held to) and the one whose checks are the most deterministic. Security and quality follow in 0.2.0, then the office in 0.3.0, then 1.0.0 with the landing page and docs complete (section 11) | **(b) CLI and public goal only, enhancements later**: smaller, but the first release would show none of what makes the product different, and the upsell would not exist. **(c) The office first**: the most fun, but the GUI would be built on an engine whose checks are not proved, and a visitor's first try would need a browser. **(d) All three goals first**: the security goal's advisory lookups need network, `gh` and per-ecosystem work; it would hold the first release on the hardest part |
| D-CS15 | The checks per goal | **ACCEPTED.** **Concrete, deterministic checks first, with the model only polishing.** Section 5 is the table: secrets in the tree and in history, sensitive files, licenses (the project's and its dependencies'), the package and workflow scan, CI, the README and community docs, issue and pull request templates, machine paths, a deny list of names, markers, large files, lockfiles and runtime pins. One check is defined once and goals weigh it. A check whose tool is missing reads `not investigated`, never `clean` | **(b) A model-led review** that reads the repository and writes findings: wider, but not repeatable, not testable against fixtures, and it sends the code off the machine. **(c) Wrap existing scanners only** (gitleaks, `npm audit`, license tools): proven rules, but each is an install, the output is not in one shape, and the run fails where a scanner is missing. Code Sleuth calls them as an extra where present (`npm audit`, `pip-audit`) and carries its own rules for the rest |
| D-CS16 | The output format | **ACCEPTED.** **A case file: a folder outside the repository** with `case.json` (the record, machine-readable, versioned), `case.md` (the verdict and the checklist, for a person) and `cards/` (one markdown file per card, in the shape ToolKit's `NewPrompt -Description` fills, section 6). The terminal prints the verdict and the checklist; `--json` prints `case.json` to stdout | **(b) Write into the repository** (`.code-sleuth/`): easy to find, but it dirties the tree the tool is judging, and a public-goal run would flag its own output. **(c) Terminal only**: nothing to keep, nothing for the office to reopen, nothing to file later. **(d) GitHub issues directly**: the tracker is the product record, but filing in someone's public tracker from a first run is not a reversible act; it is ToolKit's job (`NewItem -FromCard`) and stays there |
| D-CS17 | How the ToolKit hand-off is detected and called | **ACCEPTED.** **The CLI first, the agent second (from 0.3.0, with the office), both running ToolKit's own `NewPrompt -Title ... -Type ... -Description ...`.** Detected by asking, never by guessing: `pwsh`, else `powershell.exe`, and the verb resolving in a fresh `-NoProfile` shell (ToolKit's auto-load reads `PSModulePath`, not the profile); from 0.3.0, else the agent answering `GET /api/health` on its port. Called with every value as a separate argument, never a built command string. Code Sleuth never writes a card file itself (section 8) | **(b) Agent only**: one HTTP call and a typed reply, but it needs `tkAgent` or `tkWeb -Dev` running, and ToolKit's CLI is the whole workflow with nothing else running. **(c) Write the card file into the hub directly**: no dependency on ToolKit's verbs, but it is a second writer of a card, which ToolKit's own rules refuse (`current/` is protected; one byte contract), and it would drift from the templates |

### 3.3 The spec's own, proposed for review

| # | Decision | Why |
| --- | --- | --- |
| D-CS18 | **The case file lives outside the repository**, in a per-user cases folder (`~/.local/share/code-sleuth/cases` on Linux, `~/Library/Application Support/code-sleuth/cases` on macOS, `%LOCALAPPDATA%\code-sleuth\cases` on Windows), or `--out <dir>`. A cases folder inside the repository is refused, and so is a repository that contains the cases folder -- the repository is the cases folder's parent or any ancestor of it, so `code-sleuth ~` is refused | Principle 1. A public-goal run that flags its own output is the bug this prevents, and a run over a home folder would otherwise read its own case files, masked secrets and keyed hashes included |
| D-CS19 | **The polish pass is opt-in per run** (`--polish`) **and per card in the office** (the Polish button). With a key set and no flag, the run says one line: `A model key is set: add --polish to have the cards polished.` | It sends text off the machine; that is a choice to make each time, not a side effect of an environment variable. The design note's own words are "tweak my card if I want" |
| D-CS20 | **The polish guard**: a polished card is kept only if it keeps every fact of the card it was made from -- the check id, every path, every line number, every count, every masked value -- and adds none. Otherwise the card stays as the engine wrote it and the case says why | ToolKit's standup does the same (`dress_guard` in `agent/solitaire/standup.py`, held by a shared fixture). A polished card that invents a file is worse than no polish |
| D-CS21 | **Masking**: a secret's value is shown as its first four and last two characters with the middle replaced (`ghp_****9f`), everywhere. The value itself is not stored in `case.json` either; the finding carries its rule, path, line, and a keyed hash of the value (the key is a random one per machine, kept in the cases folder) so two runs can tell it is the same secret without the hash being guessable | Principle 5. A case file is a file a person might paste or share |
| D-CS22 | **A filed ledger**: Code Sleuth keeps `filed.json` per repository in the cases folder -- check id, the ToolKit card's id, date. **One check files one card**: a later run does not file a check that is already on it, whatever it finds under that check now, and says so; `--refile` files again (section 8.4) | `NewPrompt -Title` makes a new card with a new id every time, so without a ledger every run would duplicate the backlog. Reading the hub for a marker would need the hub's path and a parser of ToolKit's files, which is ToolKit's business |
| D-CS23 | **Exit codes**: `0` the case is closed, whatever it found; `1` only with `--fail-on <weight>`, when a finding at or above it was found; `2` a stated refusal, after one `Error:` line and one `Hint:` line | ToolKit's refusal contract, so a script calling both reads them the same way. `--fail-on` makes it usable in CI without making every finding a failure |
| D-CS24 | **Check ids are goal-free** (`secrets.tree`, not `public.secrets.tree`); a goal is a list of check ids, each with a weight | One rule for "is there a token in the tree", whatever the question. A second copy of a check under a second goal is a drift bug |
| D-CS25 | **The office binds `127.0.0.1` only, on a random free port, behind a per-launch token** in the URL the CLI opens, and refuses a request whose `Origin` is not its own | A local server that can read any path and run ToolKit verbs must not be callable by a web page the person happens to have open |
| D-CS26 | **MIT license** | The family's products use it; a developer tool that tells people to add a license should have the plainest one |
| D-CS27 | **No telemetry.** Code Sleuth makes no network call of its own; the only network traffic is the advisory lookups it says it is running (section 5.4), the polish request when asked for, and the ToolKit agent on localhost | A tool that asks to read your code earns trust by sending nothing |

## 4. Scope and non-goals

### 4.1 In scope, across the milestones

The engine and its three goals, the case file, the CLI, the polish pass, the ToolKit hand-off, the office,
the sloth and its atoms, and the public repository's front (README, docs, landing page, community files, CI,
releases). Section 11 orders them.

### 4.2 Not in scope

- **Fixing anything.** Code Sleuth reports and writes cards; it never edits the repository, opens a pull
  request or runs an install. A fix is the card's work.
- **Remote repositories.** v1 investigates a local checkout. A URL is refused with a hint to clone it.
  Cloning on the person's behalf is a later question.
- **Filing in a tracker.** It does not open GitHub issues. With ToolKit on a GitHub Space, publishing a card
  as an issue is ToolKit's `NewItem -FromCard`, the person's next step.
- **Other goals.** Accessibility, performance and "ready for production" are good goals and not v1's.
- **A model-led review of the code.** The model sees card prose only (D-CS15).
- **A daemon, a schedule or a hook.** A run is a run. Running it in CI is `npx code-sleuth --goal security
  --fail-on smoking-gun`, the person's own workflow.
- **Every ecosystem.** v1 reads npm deeply (`package.json`, `package-lock.json`, `pnpm-lock.yaml`,
  `yarn.lock`, `.npmrc`) and Python lightly (`requirements*.txt`, `pyproject.toml`, through `pip-audit` when
  present). Others read `not investigated` for the dependency checks, and the case says which.

## 5. The checks

### 5.1 The check contract

A check is one entry in the engine's check table, `src/engine/checks/`, one file per check:

| Field | Meaning |
| --- | --- |
| `id` | goal-free, dotted, stable once released: `secrets.tree` |
| `title` | what it looks for, in plain words: `Secrets in the working tree` |
| `booksName` | what the books call it, one plain term: `hard-coded credential` |
| `needs` | what it needs to run: `git`, `npm`, `gh`, `pip-audit`, `network`, `denyList`, or nothing |
| `run(repo)` | pure over the repository reader; returns a result |
| `voice` | the detective's lines for each verdict, in the copy file, not in the rule |

A result is one of:

| Verdict (`case.json`) | The detective says | Meaning | Checklist box |
| --- | --- | --- | --- |
| `clean` | Clean | the rule ran and found nothing | `- [x]` |
| `found` | by weight, below | the rule ran and found something | `- [ ]` |
| `not-investigated` | Not investigated | it could not run; `reason` says why and what would let it | `- [ ]`, with the reason |

A `found` result is weighed by the goal, not the check:

| Weight | The detective says | Meaning | Makes a card |
| --- | --- | --- | --- |
| `smoking-gun` | Smoking gun | stands between the repository and the goal | yes, type Bug |
| `loose-end` | Loose end | should be dealt with before the goal is met | yes, type Task |
| `hunch` | Hunch | worth a look; may be fine | only with `--all` |

Evidence is a list of `{ path, line, excerpt }`, the excerpt masked (D-CS21), at most 20 per finding in the
card and all of them in `case.json`. Paths are relative to the repository root, always with `/`.

### 5.2 The table

Weights per goal: **G** smoking gun, **L** loose end, **H** hunch, **--** not part of the goal.

| Check | What it reads | The rule | Public | Security | Quality |
| --- | --- | --- | --- | --- | --- |
| `secrets.tree` | tracked files (`git ls-files`; every file under the root when it is not a repository) | a match of the secret rules (5.3) in a text file | G | G | -- |
| `secrets.history` | `git log -p --all`, every added line | the same rules over history; a secret removed from the tree but still in history is still a secret. Needs `git` | G | G | -- |
| `files.sensitive` | tracked file names and a few contents | `.env` and `.env.*` (not `.env.example`), `*.pem`, `*.p12`, `*.key`, `id_rsa*`, `*.keystore`, an `.npmrc` with an `_authToken` | G | G | -- |
| `license.file` | `LICENSE*`, `COPYING*` at the root, and `package.json` `license` | absent is a finding; present, it is identified by its text against the common SPDX licenses; a manifest that disagrees with the file is a finding | G | -- | -- |
| `license.deps` | `package-lock.json` `packages[*].license` (`TBD -- needs verification` that every lockfile version carries it; else the installed `node_modules/*/package.json`) | a strong copyleft license (GPL, AGPL, SSPL) under a project that is not, or a dependency with no license stated | L | -- | -- |
| `paths.machine` | tracked text files | a home-folder path: `/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\` | L | -- | H |
| `names.deny` | tracked text files and commit messages, against `--deny <file>` | any line of the deny list, matched whole-word, ignoring case. The deny list lives outside the repository, the way ToolKit's own export did it; with none given, `not investigated` naming `--deny` | G | -- | -- |
| `files.large` | tracked files | a file over 5 MB, or any binary over 1 MB that is not an image or font | L | -- | H |
| `docs.readme` | `README*` at the root | absent; under 10 lines; no heading that reads as install, usage or quick start | L | -- | L |
| `docs.contributing` | `CONTRIBUTING*` at the root or in `.github/` or `docs/` | absent | L | -- | H |
| `docs.conduct` | `CODE_OF_CONDUCT*`, the same places | absent | L | -- | -- |
| `docs.security` | `SECURITY*`, the same places | absent | L | L | -- |
| `docs.changelog` | `CHANGELOG*` | absent | H | -- | H |
| `github.templates` | `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md` (any case) | either absent | L | -- | H |
| `ci.present` | `.github/workflows/*.yml` | no workflow that runs on `pull_request` or `push` | L | H | L |
| `ci.tests` | the workflows' `run:` lines and `package.json` `scripts.test` | no workflow step that runs the project's tests (`npm test`, `npm run test`, `pytest`, the script named in `scripts.test`) | H | -- | L |
| `workflows.permissions` | each workflow | no top-level `permissions:` block (the token then gets the repository default) | H | L | -- |
| `workflows.pinning` | each `uses:` | a third-party action (not `actions/*` or `github/*`) not pinned to a 40-character commit | -- | H | -- |
| `workflows.prtarget` | each workflow | `pull_request_target` together with a checkout of the pull request's head | L | G | -- |
| `workflows.injection` | each `run:` | `${{ github.event.* }}` fields a stranger controls (issue and pull request titles and bodies, comment bodies, head branch names, commit messages) placed directly in a shell line | L | G | -- |
| `deps.lockfile` | manifests and lockfiles | a `package.json` with dependencies and no lockfile beside it | H | L | L |
| `deps.advisories` | the lockfiles' package names and versions | a known advisory: `npm audit --json` when `npm` is present, else GitHub's advisory database through `gh api` when `gh` is signed in; `pip-audit` for Python. Needs `network` and one of the tools. Lowered by severity: moderate one step, low or info two (amended 2026-11-03) | G | G | H |
| `deps.installScripts` | `package.json` `scripts`, lockfile `hasInstallScript` | the project's own `preinstall`, `install` or `postinstall`; and the list of dependencies that run install scripts | -- | H | -- |
| `deps.registry` | every `.npmrc` in the tree | a `registry=` line that is not the public npm or yarn registry | -- | L | -- |
| `deps.updates` | `.github/dependabot.yml`, `renovate.json` and its spellings | no automated dependency updates | H | L | H |
| `deps.outdated` | `npm outdated --json` when `npm` is present | a direct dependency a major version behind | -- | -- | H |
| `runtime.pinned` | `.nvmrc`, `.node-version`, `package.json` `engines`, `.python-version`, `pyproject.toml` `requires-python` | a manifest with no runtime stated | -- | -- | L |
| `quality.lint` | ESLint, Biome, Ruff, flake8 and PSScriptAnalyzer configs, and their sections in manifests | no linter configured for a language the tree has | -- | -- | L |
| `quality.format` | Prettier, Biome, Black, Ruff format, `.editorconfig` | no formatter configured | -- | -- | H |
| `quality.tests` | test folders and `*.test.*`, `*.spec.*`, `test_*.py` | none | -- | -- | G |
| `quality.markers` | tracked source files | `TODO`, `FIXME`, `HACK`, `XXX` in a comment; the count, and the first 20 | H | -- | H |

"Tracked" means `git ls-files` when the root is a repository; `node_modules/`, `vendor/`, `dist/` and
`build/` are never read for the text checks. A goal's checklist is its checks in the table's order, grouped
by verdict and weight.

### 5.3 The secret rules

One table, `src/engine/secrets/rules.ts`, each rule a regex string, an id and a name, in the subset Node
and other engines agree on: private key headers (`-----BEGIN ... PRIVATE KEY-----`), cloud access key ids,
GitHub tokens (`ghp_`, `gho_`, `ghs_`, `github_pat_`), npm tokens (`npm_`), Slack tokens (`xox[abprs]-`),
model API keys by their scoped prefixes (`sk-ant-`, `sk-proj-`, `sk-live_`; a bare `sk-` matches base64 blobs and hashes, so there is no rule for it), webhook URLs with a token in them (Slack and Teams incoming webhooks), and
an assignment of a long high-entropy string to a name that says `secret`, `token`, `password` or `key`. The
last one is weighed one step down (a smoking gun becomes a loose end), because it is a guess about a name.

A rule matched inside a file the person has marked as an example (a path under `test/fixtures/`,
`__fixtures__/`, or a line carrying `code-sleuth:example`) is shown and not counted, as the 2026-11-03
amendment at this spec's head describes. The rules are not exhaustive and the docs say that plainly: a clean `secrets.*` means "none of
these rules matched", not "there is no secret".

### 5.4 What leaves the machine

Only these, and the run's header names the ones it will make before it makes them:

| Call | When | What is sent |
| --- | --- | --- |
| `npm audit` | `deps.advisories`, npm present, not `--offline` | the lockfile's dependency tree, to npm's configured registry, which is what `npm audit` always does |
| `npm outdated` | `deps.outdated`, npm present, not `--offline` (amended 2026-11-03) | the direct dependencies' names, to npm's configured registry; the installed versions are read from the lockfile, locally |
| `gh api /advisories` | `deps.advisories`, no `npm`, `gh` found, not `--offline` (amended 2026-11-03) | the ecosystem and the lockfile's package names and versions, in batches; crediting each advisory to a locked version is local |
| `pip-audit` | Python manifests present, `pip-audit` present, not `--offline` | what `pip-audit` sends |
| the polish request | `--polish`, or the office's Polish button | one card's text, already masked (section 7) |

`--offline` turns the first three off; their checks read `not investigated`, reason `--offline`.

## 6. The case file

### 6.1 Where it is

```text
<cases>/                                  D-CS18: the per-user folder, or --out
  <repo-key>/                             <folder name>-<first 8 of a hash of the absolute path>
    filed.json                            D-CS22: what has been filed in ToolKit
    <yyyy-MM-dd>-<goal>-<n>/              one case; n counts that day's runs of that goal from 1
      case.json
      case.md
      cards/
        01-a-token-in-plain-sight.md
        02-no-license.md
```

Every file is UTF-8 with no byte-order mark and LF line endings, on every host. Nothing in a case folder is
ever overwritten: a second run is a new case.

### 6.2 `case.json`

```json
{
  "caseFile": 1,
  "tool": { "name": "code-sleuth", "version": "0.1.0" },
  "case": "2026-10-31-public-1",
  "goal": "public",
  "repo": { "name": "widget", "head": "3f2a9c1e...", "branch": "main", "dirty": false, "remote": "github.com/<owner>/widget" },
  "openedAt": "2026-10-31T14:02:11Z", "closedAt": "2026-10-31T14:02:58Z",
  "verdict": "not-ready",
  "counts": { "smoking-gun": 2, "loose-end": 3, "hunch": 1, "clean": 16, "not-investigated": 1 },
  "enhancements": { "polish": { "state": "off", "reason": "no --polish" },
                    "toolkit": { "state": "detected", "via": "cli", "prefix": "tk", "space": "widget" } },
  "checks": [ {
    "id": "secrets.tree", "title": "Secrets in the working tree", "booksName": "hard-coded credential",
    "verdict": "found", "weight": "smoking-gun",
    "evidence": [ { "path": "config/dev.ts", "line": 12, "excerpt": "token: \"ghp_****9f\"", "rule": "github-token", "valueHash": "hmac-sha256:4be1..." } ],
    "fix": "Revoke the token where it was issued, then remove it from the file and from history.",
    "card": "cards/01-a-token-in-plain-sight.md"
  } ]
}
```

`caseFile` is the format's version; a reader refuses a version it does not know, naming it. `verdict` is
`ready` (no smoking gun and no loose end), `nearly` (loose ends only) or `not-ready` (a smoking gun). The
remote is written without credentials or a scheme. With `--json` the same object goes to stdout, and the
determinism test (section 12) compares two runs of it with `openedAt`, `closedAt` and `case` removed.

### 6.3 `case.md`

The verdict in one sentence, the counts, then the checklist: one line per check in the goal, grouped
Smoking guns, Loose ends, Hunches, Clean, Not investigated, each a checkbox, the check's title, its one-line
finding and a link to its card. Then the enhancements, one line each: what was on, what was off and the one
thing that would turn it on. Then, without ToolKit, one line of upsell (section 8.5).

### 6.4 A card file

A card is written in the shape ToolKit's `NewPrompt -Description` fills, so the same text is the markdown
card and, when ToolKit is present, the description of the real card. ToolKit puts the description in the
card's `## Context` (a Task) or `## Summary` (a Bug and every other type), keeps multi-line text exactly,
and counts every `- [ ]` anywhere in the card as progress (`docs/hub/cards.md`). So the description uses no
`##` headings of its own, only bold labels, and carries its acceptance as checkboxes:

```markdown
# Bug: A token in plain sight

The sleuth found a GitHub token committed in the working tree. Anyone who can read the repository can use it.

**Evidence**
- `config/dev.ts:12` -- `token: "ghp_****9f"` (rule: github-token)

**What the books call it:** hard-coded credential

**The fix**
Revoke the token where it was issued first, then remove it from the file. It is also in history, so
rewrite history or treat the token as public. Read it from the environment instead.

**Done when**
- [ ] The token is revoked where it was issued.
- [ ] `code-sleuth --goal public` reads `secrets.tree` and `secrets.history` as Clean.

Found by Code Sleuth: secrets.tree, case 2026-10-31-public-1, at 3f2a9c1.
```

- **The first line** is `# <Type>: <title>`. It is the markdown card's own heading; it is not sent to
  ToolKit, which writes its own `# <Type> <id>: <name>` heading from `-Title` and `-Type`.
- **The type** is `Bug` for a smoking gun and `Task` for a loose end or a hunch -- types ToolKit ships in
  `workItemTypes`.
- **The title** is at most 80 characters, plain, with no PI words in it: a card title is read in a backlog
  among other cards. The voice goes in the first sentence.
- **The body** is everything after the heading, at most 3,500 characters, so it fits the agent bridge's
  4,096-character limit on one parameter with room to spare; evidence past the limit is cut and ends with
  `and <n> more in the case file`.
- **The last line** is the fingerprint: check id, case and short commit. A person can search their backlog
  for it; Code Sleuth does not read it back (D-CS22).
- File name: two-digit order, then the title's slug (lower case, every run of anything but `a-z` and `0-9`
  one hyphen, at most 60 characters).

## 7. The polish pass

**On** only with a key **and** `--polish` on the run or the Polish button on a card (D-CS19). The key is read
from `ANTHROPIC_API_KEY`, in the environment or in Code Sleuth's own `.env`, and never written or printed
(amended 2026-11-03). Without a key, `--polish` is not a refusal: the run goes ahead and says
`No API key. The cards are as the sleuth wrote them. To add one, run <copy line> and fill it in.`, where the copy
line names the `.env.example` beside the running command and the `.env`, both in full and quoted.

**The model** is the current Haiku model, by its id, held in one constant in the source and overridable by
`CODE_SLEUTH_MODEL`. Small and fast is the point: a card is a short rewrite.

**What is sent** is one card's title and body, after masking -- never a file from the repository, never an
unmasked excerpt, never the path of the repository on the machine. The prompt asks for the same card, in the
same shape, read more easily; it is a file in the package (`src/polish/prompt.md`), so it is tuned in the
open.

**What comes back is guarded** (D-CS20). The engine extracts the card's facts -- the check id, every path,
every `path:line`, every number, every masked value, every checkbox's count -- and the polished card is kept
only when it carries every one and adds no path, number or masked value of its own. A card that fails keeps
the engine's text, and `case.json` records `polish: { "state": "kept-original", "reason": "path-dropped" }`.
The guard is a pure function over a table of rows (section 12).

**A failure is a line, not a stop.** A network error, a refused key or a timeout leaves the card as written,
names the reason in the case, and the run still exits 0.

**The key is never written** (D-CS6): not to the case, not to a config file, not to a log. The office has no
field for it; its Polish button says, when there is no key, which variable to set and that it is read from
the environment of the shell that started the office.

## 8. The ToolKit hand-off

### 8.1 What it does

With ToolKit present and the person's go-ahead, each card becomes a real ToolKit card through ToolKit's own
verb -- the offline form of its creating verb:

```text
<prefix>NewPrompt -Title <title> -Type <Bug|Task> -Description <body>
```

`NewPrompt -Title` makes a card with no tracker call and gives it a short id of its own (`K7M2`). Where it
lands is ToolKit's rule, by the Space's tracker: on a GitHub or a local Space the card goes to `backlog/`,
planned and not in play; on an Azure DevOps Space, whose board draws no Backlog lane, it goes to `current/`,
in play, as `-Now` would put it (`Scripts/New-PromptFromWorkItem.ps1`, `$startsInPlay`; `docs/hub/cards.md`,
"Where it lives"). Code Sleuth names the folder it was told in the case and does not choose it. Code Sleuth never writes a card
file and never passes `-Now`, `-Force` or any other switch: it hands over a title, a type and a description,
and ToolKit does the rest by its own rules.

### 8.2 Detection

Asked in this order, stopping at the first that answers. Each step is a child process or a localhost
request; none reads ToolKit's files.

| Step | How | Answers | From |
| --- | --- | --- | --- |
| 1. The CLI | `pwsh` on the PATH, else `powershell.exe` (Windows PowerShell 5.1 is ToolKit's floor: its manifest says `PowerShellVersion = '5.1'`); then `<shell> -NoProfile -File handoff.ps1 -Probe -Prefix <p>` succeeds. ToolKit's verbs auto-load from `PSModulePath`, not from a profile, once `InstallAutoload` has run | `via: cli` | 0.1.0 |
| 2. The agent | `GET http://127.0.0.1:<port>/api/health` answers, and `GET /api/env` carries `cliPrefix` | `via: agent` | 0.3.0, with the office |
| neither | | `state: not-installed` | |

- **The probe** is `handoff.ps1 -Probe`: it resolves `<prefix>NewPrompt` (which loads the module) and prints
  one JSON line, `{ "prefix": ..., "space": ..., "spaces": [...] }`, read from ToolKit's exported
  `$global:P20Config` (`CommandPrefix`, `ActiveSpace`, `Spaces`) -- the resolved values, overrides included.
  `<prefix>Config -List -AsJson` is the documented read of the same settings (top-level `activeSpace`, and a
  `commandPrefix` row in its `settings` list), but its `activeSpace` is the one `config.local.json` holds:
  it does not reflect `P20_ACTIVE_SPACE` (checked at `5f4e341`), so it cannot confirm `--toolkit-space`.
- **`$global:P20Config` is not a documented contract.** ToolKit's own code reads it (`Get-CliPrefix` does),
  but no ToolKit document promises it to callers. So the probe tolerates its absence: the prefix comes from
  `--toolkit-prefix` or `tk`, the Space reads `unknown`, and `--toolkit-space` is refused, since it cannot be
  confirmed. The G1 follow-up asks ToolKit for a machine-readable read of the resolved prefix and Space beside
  `-AsJson` on `NewPrompt`, so this dependency on a global is temporary.
- **The prefix** is `--toolkit-prefix <p>`, else `tk` (ToolKit's shipped `commandPrefix`); from 0.3.0, the
  agent's `cliPrefix` when the agent answers.
- **The Space** is the one `--toolkit-space <slug>` names; else the Space whose address is the repository's
  `origin`; else the active one (amended 2026-11-03). That flag sets
  `P20_ACTIVE_SPACE` in the child shell's environment only -- ToolKit's per-process stand-in for
  `activeSpace` (`consts.json` `env.activeSpace`, read by `Scripts/Resolve-HubConfig.ps1` and by the agent's
  `load_config`) -- so the person's own config is never changed. An undeclared slug does not fail in ToolKit:
  the shell falls back to another Space (checked at `5f4e341`). So the probe's `space` must equal the slug, and
  the slug must be in `spaces`, or the hand-off refuses (exit 2) naming the slug and the declared Spaces,
  before anything is filed. The Space is named in the consent line (8.4) either way.
- **The port** (0.3.0) is `--toolkit-port`, else `P20_AGENT_PORT` when set (`consts.json` `env.agentPort`,
  the variable ToolKit's launcher sets), else `4100` (ToolKit's shipped `web.agentPort`). The agent path has
  no per-call Space: it files in whatever Space the agent's config names, and `--toolkit-space` with the
  agent path is refused.

### 8.3 The call

- **Through the CLI** (0.1.0): Code Sleuth ships one small PowerShell file, `toolkit/handoff.ps1`, run as
  `<shell> -NoProfile -File handoff.ps1 -Prefix tk -Title <t> -Type <type> -Description <d>`, with
  `P20_ACTIVE_SPACE` in its environment when `--toolkit-space` was given. Every value is its own argument: no
  command string is built from text that came out of the repository, because a file name or a line in it is
  attacker-controlled. The script calls the verb with those parameters and exits with `$LASTEXITCODE`, so
  ToolKit's refusal contract reaches Code Sleuth: `0` filed, `2` a stated refusal whose sentence ToolKit has
  already printed, anything else a failure. **It is Windows PowerShell 5.1-clean**: no ternary, no `??` or
  `?.`, no `-AsHashtable`, no `&&` or `||` pipeline chains -- it runs under `powershell.exe` as well as `pwsh`,
  and the suite runs it under both (R3).
- **Through the agent** (0.3.0, with the office): `POST /api/cmd/NewPrompt` with
  `{"params": ["-Title", "<t>", "-Type", "<type>", "-Description", "<d>"]}`. The reply is ToolKit's
  `CommandResponse`; `status` is `success`, `error`, `rejected` or `timeout`, and only `success` is filed.
  The bridge refuses more than 32 parameters or one longer than 4,096 characters, which section 6.4 keeps
  inside.
- **The card** comes back in ToolKit's two success lines (`Scripts/New-PromptFromWorkItem.ps1`, the offline
  branch):

  ```text
  [+] Created <file> in <folder>/ -- <Type> <id>, offline.
      Prompt: file:///<full path>
  ```

  Code Sleuth reads the card's **id** (`<Type> <id>`, for example `Task K7M2`) from the first line and the
  card's path from the `Prompt:` line, each with a tolerant pattern. The id is what the ledger keeps, because
  ToolKit's verbs resolve a card by its id, not by its file name; the path is shown in the case so the
  person can open the card. When a line does not match, the card is still recorded as filed with that part
  `unknown`, and the case says so (gap G1).

### 8.4 Consent, order and the ledger

- The CLI asks once, naming the count and the Space: `File 5 cards in ToolKit, in the Space 'widget'?
  [y/N]`. `--toolkit --yes` files without asking; without a terminal and without `--yes` it does not file and
  says how.
- Cards are filed one at a time in the case's order. The first refusal stops the batch, names the card and
  ToolKit's sentence, and leaves the rest unfiled; the ones already filed are on the ledger.
- `filed.json` (D-CS22) records each filed check: `{ "check": "secrets.tree", "card": "Task K7M2",
  "space": "widget", "case": "2026-10-31-public-1", "date": "2026-10-31" }`. A check on the ledger is skipped
  next time with `already filed as Task K7M2 on <date>; --refile to file it again`.
- **The ledger's key is the check id alone: one check files one card.** A later finding under a filed check
  -- a second token, a new TODO, the same secret on a moved line -- is "already filed" by design, and the
  checklist still shows it in full. Why this rule and not a key on the check plus the finding's `valueHash`
  or path set: a card is about a condition (`secrets.tree` is not Clean), and its acceptance is that check
  reading Clean (6.4), so new evidence belongs on the card already open. A key on evidence would file a new
  card every time a line moved or a TODO was added, which is the duplication the ledger exists to stop
  (R9). What it costs: a check that was fixed, closed and later regressed is not refiled by itself; the skip
  line names the earlier card and its date, so the person sees it, and `--refile` files it.

### 8.5 The upsell

Without ToolKit, `case.md` and the terminal end with one line, and only one: `Want these as real cards, in
your own files, on your own board? That's what ToolKit is for: <link>`. With ToolKit present and nothing
filed, the line is the command that would file them. Never per card, never a prompt.

## 9. The CLI

### 9.1 Commands

| Command | Does |
| --- | --- |
| `code-sleuth [<repo>] [--goal public\|security\|quality]` | investigate. `<repo>` defaults to the current folder. With no `--goal` in a terminal, the detective asks the goal first, as three numbered choices; with no terminal, no `--goal` is a refusal (exit 2) |
| `... --polish` | the polish pass over the cards (section 7) |
| `... --toolkit [--yes] [--refile] [--toolkit-prefix <p>] [--toolkit-space <slug>]` | file the cards in ToolKit through its CLI (section 8); `--toolkit-space` files in that Space, through `P20_ACTIVE_SPACE` in the child shell only. `--toolkit-port <n>` joins them in 0.3.0, with the agent path |
| `... --deny <file>` | the deny list for `names.deny`; a file outside the repository |
| `... --all` | hunches get cards too |
| `... --offline` | no advisory lookups (section 5.4) |
| `... --out <dir>` | the case folder's parent; inside the repository is refused |
| `... --json` | print `case.json` to stdout, and the human output to stderr |
| `... --fail-on smoking-gun\|loose-end` | exit 1 when a finding at or above that weight is found (D-CS23) |
| `code-sleuth checks [--goal <g>]` | the check table, from the code: id, title, what it needs, its weight per goal |
| `code-sleuth office [--port <n>] [--no-open]` | start the office (section 10) and open it |
| `code-sleuth --help`, `--version` | |

A refusal is one `Error:` line and one `Hint:` line, then exit 2: not a folder; not readable; a URL in place
of a path; an unknown goal; a cases folder inside the repository, or a repository that is the cases folder or one of its ancestors (D-CS18); a `--toolkit-space` that ToolKit does not declare; a `--deny` file that cannot be read; an unknown
`caseFile` version when the office reopens a case.

### 9.2 Sample output

```text
Code Sleuth -- case 2026-10-31-public-1

So, you want to know what's going on with your repo?

  Repo  widget (main @ 3f2a9c1, clean)
  Goal  going public
  Out   npm audit runs against the npm registry (--offline skips it)

Taking my time. 23 leads to run down ............................. done.

The verdict: not ready to go public. Two smoking guns, three loose ends.

Smoking guns
  [ ] secrets.tree       A token in plain sight: config/dev.ts:12 (ghp_****9f)
  [ ] license.file       No license. Nobody can legally reuse this code.
Loose ends
  [ ] docs.security      No SECURITY.md: nobody knows where to report a problem.
  [ ] github.templates   No issue templates.
  [ ] paths.machine      Three home-folder paths, starting at scripts/build.sh:4
Hunches
  [ ] quality.markers    14 TODOs. The first: src/app.ts:88
Clean
  [x] files.sensitive    No key files or .env in the tree.  ... and 15 more
Not investigated
  [ ] names.deny         No deny list given (--deny <file>).

Case file  ~/Library/Application Support/code-sleuth/cases/widget-1a2b3c4d/2026-10-31-public-1/case.md
Cards      5 in cards/
Polish     an API key is set (from the environment): add --polish to have the cards polished.
ToolKit    found (tk, Space 'widget'): add --toolkit to file the cards.
```

The words are the CLI's own copy file (`src/cli/copy.ts`); the check lines are the checks' `voice`. Colour
only where the terminal supports it, and never as the only signal: every line carries its word.

## 10. The office, the sloth and the front

### 10.1 The office

`code-sleuth office` starts a local server and opens the office in the browser (D-CS25: `127.0.0.1`, a
random free port unless `--port`, a per-launch token). It is the same engine behind a JSON API the office
alone calls; the server writes only to the cases folder, never to the repository. Four rooms:

| Room | What it is |
| --- | --- |
| **The door** | the frosted-glass door with the name on it, `CODE SLEUTH -- PRIVATE INVESTIGATIONS`, and the question. A repository path (typed, or one of the recent ones from the cases folder) and the three goals as three case folders on the desk. One button: **Take the case** |
| **The stakeout** | the sloth at the desk under the slat blinds, working through the leads one at a time; the list of checks ticks as each one returns. It is slow on purpose and says what it is doing; it never shows a fake progress bar |
| **The case file** | the verdict, the counts and the checklist, grouped as the CLI groups them. Each card opens in place, with **Copy as markdown**, **Polish** (with a key; else the sentence of section 7) and **Make a ToolKit card** (when detected; else the upsell line, once, at the foot) |
| **The files** | past cases, from the cases folder, newest first, each reopened read-only |

The office follows the family's web rules: one consistent detail layout, no helper text that narrates what
the rows already show, nothing moves when a card opens or closes, familiar patterns only (a folder that
opens, a stamp that lands). Light and dark. `prefers-reduced-motion` stills the sloth and the blinds, and the
stakeout is still readable as a list. Every control is reachable by keyboard, and the axe pass reads zero
serious or critical findings.

### 10.2 The atoms

`src/atoms/`, one SVG React component each, shared by the office, the landing page and the docs' images:

- **The sloth** (D-CS2), the hero: hat, trench coat, magnifying glass. One source, a handful of poses as
  props: `thinking`, `reading` (the stakeout), `pointing` (the verdict), `tipping-hat` (a clean case). The
  pose set is open (G7).
- **The office**: the desk, the slat blinds, the door with the name.
- **The case folder**: a goal on the desk, and the case file once it is open.
- **The stamp**: the verdict, stamped on the folder -- `READY`, `NEARLY`, `NOT READY`.

The atoms carry no words: a label is a prop, so the copy stays in each surface's copy file.

### 10.3 The landing page

Built from the repository on GitHub Pages, in the shape of ToolKit's landing page (`web/src/landing/` in
ToolKit: the banner, the offering, the bullets, the call to action, the bands, the quick start), sharing its
components and never its words (D-CS10). Proposed: the components are copied into Code Sleuth's tree once,
with a header comment naming where they came from, rather than published as a shared package (gap G8). The
sloth replaces ToolKit's cast. The copy is Code Sleuth's own `copy.ts`; nothing is read from the README.

### 10.4 Docs and the deck

The public repository ships, written for strangers:

| File | Owns |
| --- | --- |
| `README.md` | the front door: the sloth, the question, the three-line quick start, the progressive enhancement table, links |
| `docs/QUICKSTART.md` | install, first run, each enhancement turned on |
| `docs/CHECKS.md` | every check: id, what it reads, the rule, its weight per goal, how to fix -- held to the code by a test |
| `docs/CASE-FILE.md` | the case folder, `case.json` and its version, the card shape |
| `docs/POLISH.md` | the polish pass: what is sent, the guard, the key |
| `docs/TOOLKIT.md` | the hand-off: detection, the call, the ledger, what it never does |
| `docs/OFFICE.md` | the office and its trust model |
| `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `LICENSE` (MIT), `.github/` templates | the community files the public goal itself checks for |

**The deck** is a short product deck telling the detective's story. It is built separately and shipped as files;
this spec's only claim on it is that it uses the sloth atom's source.

## 11. Milestones

In build order, each shippable on its own (D-CS14 is the recommendation behind the cut).

| Milestone | Version | Done when |
| --- | --- | --- |
| **M1 The case** | 0.1.0 | the repository exists, private, and its tests run locally; it runs from a checkout through `npm link`; the engine, the going-public goal's checks, the case file and the cards; the CLI with `checks`, `--json`, `--out`, `--deny`, `--fail-on`; the polish pass and its guard; the ToolKit hand-off through ToolKit's CLI (`pwsh` or `powershell.exe`), with `--toolkit-space` and the ledger; `docs/CHECKS.md`, `CASE-FILE.md`, `POLISH.md`, `TOOLKIT.md`; it runs its own public goal on itself with no smoking gun, and the maintainers have run it on their own repositories |
| **The first friend** | -- | the public goal passes on itself; the repository is flipped public and CI turns on; a friend can run `npx github:johnfrog76/code-sleuth` and file an issue |
| **M2 The other two goals** | 0.2.0 | security and quality, with the advisory lookups and `--offline`; Windows proved in CI |
| **M3 The office** | 0.3.0 | the four rooms, the atoms, the trust model and its tests, the browser smoke; the ToolKit hand-off through the agent (`/api/health` detection, `POST /api/cmd/NewPrompt`, `--toolkit-port`) |
| **On npm** | when earned | the name is reserved, a tag publishes the package from CI, and `npx code-sleuth` works on a clean machine. Taken only once the maintainers say it has earned it, at any point after the first friend |
| **M4 The front** | 1.0.0 | the landing page, the README's first screen, every doc in 10.4 walked by someone who did not write it; the deck's pointer resolves |

## 12. Tests

| Suite | Guards | Fixtures |
| --- | --- | --- |
| Engine, per check | every check over its table: a clean row, each `found` row the rule distinguishes, a `not-investigated` row per thing it `needs` | `test/fixtures/repos/<check>/<row>/`, each a tiny tree; the ones that need history are made into a git repository by the test, in a scratch folder |
| The goals | each goal's checklist over a set of whole repositories: order, grouping, weights, verdict, counts | `test/fixtures/cases/<case>/` with a golden `case.json`, `case.md` and `cards/` per goal |
| Determinism | the same fixture run twice gives byte-identical case files once `openedAt`, `closedAt` and `case` are removed | the case fixtures |
| Masking | after a run over every secret fixture, no file in the case folder and no byte of stdout or stderr contains a fixture secret's value | secret fixtures assembled from fragments at test time, so no real-looking secret is ever committed (risk R4) |
| Read-only | after every fixture run, the fixture tree is byte-identical and `git status` in it is clean | all of them |
| The card shape | a card's body has no `##` heading, fits 3,500 characters, ends with the fingerprint; the cut evidence says how many more | the case fixtures |
| The polish guard | one table: a kept rewrite, and one row per refusal reason (`path-dropped`, `path-added`, `number-changed`, `masked-value-changed`, `checkbox-count-changed`, `empty`) | `test/fixtures/polish/guard.json` |
| The polish pass | with the model client stubbed: off without a key, off without `--polish`, kept, kept-original by the guard, a network failure kept-original and exit 0; the request contains no unmasked value and no repository path | the guard table |
| The hand-off, CLI (M1) | a stub `pwsh`, and a stub `powershell.exe` with no `pwsh`, on the PATH, each recording its argv and answering like ToolKit: detection in that order, `--toolkit-space` reaching the child as `P20_ACTIVE_SPACE` and an undeclared slug refused before filing, the argv as separate values (a title with quotes, `;`, `&`, `$()` and a newline arrives intact), both success lines parsed (the id and the `Prompt:` path), an unmatched line filed as `unknown`, a later finding under a filed check skipped, a refusal stopping the batch, the ledger written and read, `--refile` | `test/fixtures/toolkit/` |
| The hand-off, agent (M3) | a stub HTTP server: `/api/health`, `/api/env`, `POST /api/cmd/NewPrompt` with each `status` | the same |
| The hand-off, for real | against a real ToolKit checkout and a scratch hub, when `CODE_SLEUTH_TOOLKIT` names one: `handoff.ps1` run under both `pwsh` and Windows PowerShell 5.1 (on Windows); cards appear in `backlog/` on a GitHub or local Space and in `current/` on an Azure DevOps Space, with the description in `## Context` or `## Summary` and the checkboxes counted. Without it the suite prints a named skip with its reason; the summary line counts it as a skip, not a pass | a scratch hub |
| The CLI | each refusal exit 2 with one `Error:` and one `Hint:`; `--fail-on` exit codes; `--json` stdout is valid and equal to the case file | |
| The docs | `docs/CHECKS.md` names every check in the table with the same weights, and no check that is not | |
| The office | component tests for each room over the case fixtures; the API refuses a missing token and a foreign `Origin`; the server binds `127.0.0.1`; a browser smoke takes a case end to end; axe over every room, light and dark | the case fixtures |
| Self-investigation | CI runs `code-sleuth . --goal public --fail-on smoking-gun` on its own repository | |
| Windows | the whole suite on Windows in CI, including the spawn of `npm`, `pwsh` and `powershell.exe` (risk R3) | |

## 13. Gaps, known before starting

| # | Gap | Where | Status |
| --- | --- | --- | --- |
| G1 | ToolKit's `NewPrompt` has no machine-readable reply; the card's id and path are read out of its two success lines | ToolKit, `Scripts/New-PromptFromWorkItem.ps1` | Follow-up, proposed: a ToolKit issue for `-AsJson` on `NewPrompt`, filed when M1 is built, not before |
| G2 | Choosing the Space a card lands in | ToolKit | Solved by `P20_ACTIVE_SPACE` on the CLI path (`--toolkit-space`, 8.2); the agent path has no per-call Space |
| G4 | Dependency licenses and advisories are npm-deep and Python-light; other ecosystems read `not investigated` | section 4.2 | Follow-up per ecosystem, by demand |
| G5 | The secret rules are a short list; a clean result means "none of these rules matched" | section 5.3 | Said in the docs and the case; wider rules by demand |
| G6 | `secrets.history` over a large history is slow | section 5.2 | Accepted: slow is the point, and the stakeout says what it is reading. A `--since <ref>` is a later option |
| G7 | The sloth's pose set and its art are not drawn | section 10.2 | Open: the art is made before M3 |
| G8 | The landing components are copied, not shared as a package, so a fix in one family page does not reach the others | section 10.3 | Accepted for v1; a shared package is a later question across the family |

## 14. Risks

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | A false smoking gun on a first run | the tool reads as noise and is not run twice | weights per goal; the example-path and `code-sleuth:example` rule; the name-guess rule weighed one step down; every finding names its rule so a person can see why |
| R2 | A false clean | a person ships a secret because the sleuth said Clean | `not investigated` is never `clean`; the docs and the case say what a clean secret check means (G5) |
| R3 | Spawning `npm`, `gh`, `pwsh` and `powershell.exe` on Windows: `npm` is a `.cmd` shim, which Node will not spawn without a shell, and a shell reintroduces quoting; and where only Windows PowerShell 5.1 is installed, a `handoff.ps1` that uses 7-only syntax (a ternary, `??`) fails to parse | the advisory and hand-off paths fail, or worse, quote wrongly, on Windows only | spawn `npm` through its own `npm-cli.js` under `process.execPath` where it can be found, else through `cmd.exe` with argument escaping in one helper; `pwsh` and `powershell.exe` are `.exe` files and are spawned directly; `handoff.ps1` is kept 5.1-clean (8.3) and run under both shells in CI; the Windows CI job runs the hand-off stub with hostile titles (`TBD -- needs verification` on the npm path) |
| R4 | Committed test secrets trip push protection and the tool's own self-investigation | blocked pushes; a red self-check | fixture secrets are assembled from fragments at test time; nothing that looks like a live secret is committed |
| R5 | Text from the repository reaches a shell | command injection through a file name or a commit message | every child process is spawned with an argument array; the hand-off passes values as arguments; a test feeds hostile strings through the CLI path, and the agent path from 0.3.0 |
| R6 | The polish pass changes a fact | a card that sends a person to the wrong file | the guard (D-CS20) and its table; the original is kept on any doubt |
| R7 | The office is reachable from a web page | a page the person has open triggers investigations or files cards | D-CS25: localhost, random port, launch token, `Origin` check; tested |
| R8 | The upsell reads as nagging | a stranger's trust is spent on an ad | one line per case, never per card, never a prompt; the product is fully useful without ToolKit |
| R9 | Duplicated cards in a ToolKit backlog | the board fills with copies after a few runs | the ledger (D-CS22) and `--refile` |
| R10 | ToolKit's success lines change | ids and paths read as `unknown` | tolerated by design (8.3); G1 removes the need |
| R11 | Building before D-CS12 to D-CS17 are answered | rework of the stack or the format | RESOLVED: all six are answered |

## 15. Acceptance

- `npx code-sleuth` in a repository asks "So, you want to know what's going on with your repo?", offers the
  three goals, and on going public prints the verdict and the checklist and writes a case folder outside the
  repository, with `case.json`, `case.md` and one card per smoking gun and loose end.
- After any run, `git status` in the investigated repository shows nothing new.
- `code-sleuth ~`, or any folder that contains the cases folder, is refused (exit 2), and so is an `--out`
  inside the repository.
- The same repository at the same commit, under the same goal, gives the same case file except for its
  timestamps and case name.
- A committed fake token is a smoking gun under going public and security, shown masked everywhere; its
  value appears in no output file.
- A check whose tool is missing reads `Not investigated` with the thing that would let it run; none reads
  `Clean`.
- With no model key, `--polish` runs and says the cards are as written. With a key and `--polish`, each card
  is polished, and any rewrite that loses or adds a path, number or masked value is replaced by the original,
  with the reason in the case.
- No case file, log or config file contains the key.
- With ToolKit installed (`pwsh`, or only Windows PowerShell 5.1), `--toolkit` names the Space, asks once,
  and makes one ToolKit card per card through `NewPrompt -Title -Type -Description`; each lands in the
  Space's `backlog/` on a GitHub or local Space, or its `current/` on an Azure DevOps Space, with the body in its `## Context`
  or `## Summary` and its checkboxes counted. A second run files nothing for a check already filed, even with new findings under it, and says so.
  `--toolkit-space <slug>` files in that Space without changing the person's config; an undeclared slug is
  refused before anything is filed.
- Without ToolKit, the case ends with exactly one upsell line.
- A title containing quotes, `;`, `&`, `$()` and a newline is filed intact through the CLI path, and the agent path from 0.3.0.
- Every refusal is exit 2 with one `Error:` and one `Hint:`.
- `code-sleuth office` opens the office on `127.0.0.1`; the door, the stakeout and the case file show the same
  case the CLI wrote; a request without the launch token is refused.
- Code Sleuth's own repository, investigated for going public, has no smoking gun.

## 16. The documents that change, in the build's commits

| Document | Change |
| --- | --- |
| Code Sleuth's docs (10.4), `CHANGELOG.md` | written with the code they describe, in the same commit; one changelog line per change a user would notice |
| This spec | stays the contract until it is completed; a locked version changes by a dated note at its head |
| The hub | the `code-sleuth` Space when D-CS12 is taken. Once the product's repository exists, the note and this spec move into it -- a design that has a product lives in that product's repo (`docs/hub/design.md`) -- and complete there with `MoveDesign 5b24752c -To Complete -Doc <path>` when its docs hold what this spec says |
| ToolKit | nothing in this spec. G1's issue, if the maintainers want it, is filed in ToolKit's tracker in its own words |
