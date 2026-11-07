# The command line

Everything you can ask Code Sleuth from the command line, and how it answers: every command, flag and
refusal, and the exit codes. `code-sleuth --help` prints the short form. A test holds
the flags on this page to the ones the parser accepts.

## Commands

| Command | Does |
| --- | --- |
| `code-sleuth [<folder>] [--goal <goal>]` | investigates the folder (here, by default) and writes a case. With no `--goal` in a terminal, it asks; with no terminal, a missing goal is a refusal |
| `code-sleuth checks [--goal <goal>]` | prints the check table from the code: each check, what it needs, and each goal's weight for it |
| `code-sleuth --help` | the short form of this page |
| `code-sleuth --version` | the version from `package.json` |

The goals are `public`, `security` and `quality`. A case can be taken for `public` in this release; the other
two are listed by `checks` and refused for a case until their checks are built
([KNOWN-GAPS.md](KNOWN-GAPS.md)).

## Flags

<!-- The flags in this table are held to the parser by test/docs/docs.test.ts. -->

| Flag | Takes | Does |
| --- | --- | --- |
| `--goal` | `public` | the question to answer |
| `--out` | a folder | where the case folder goes; refused inside the repository ([CONFIGURATION.md](CONFIGURATION.md#the-cases-folder)) |
| `--deny` | a file | the deny list for `names.deny`: names that must not appear, one per line, `#` for a comment. Refused inside the repository |
| `--all` | | hunches get cards too |
| `--json` | | prints `case.json` to stdout, and the report to stderr. A question asked at a terminal (the goal, or ToolKit's consent) still goes to stdout |
| `--fail-on` | `smoking-gun` or `loose-end` | exits 1 when a finding at or above that weight is found |
| `--offline` | | makes no dependency lookup: `deps.outdated` and `deps.advisories` read not investigated. The polish request, which only `--polish` turns on, is not affected ([CONFIGURATION.md](CONFIGURATION.md#what-leaves-the-machine)) |
| `--examples` | a glob | another example location, beside `test/fixtures/` and `__fixtures__/`; repeatable. A match there is shown and not counted ([CHECKS.md](CHECKS.md#example-locations)) |
| `--polish` | | rewords each card with a model, every path its evidence cites and every number kept; needs an API key ([POLISH.md](POLISH.md#where-the-api-key-goes)) |
| `--toolkit` | | files the cards in ToolKit, after asking: in the repository's own Space, else ToolKit's active one ([TOOLKIT.md](TOOLKIT.md#which-space)) |
| `--yes` | | with `--toolkit`, files without asking |
| `--refile` | | with `--toolkit`, files a check again though it is already filed |
| `--toolkit-prefix` | a prefix | ToolKit's command prefix, if it is not `tk` |
| `--toolkit-space` | a Space's slug | files in that Space, without changing ToolKit's own setting |
| `--help`, `-h` | | the short help |
| `--version`, `-v` | | the version |

## Exit codes

| Code | Means |
| --- | --- |
| 0 | the case is closed, whatever it found; also `--help`, `--version` and `checks` |
| 1 | only with `--fail-on`: a finding at or above the weight it names |
| 2 | a stated refusal: one `Error:` line and one `Hint:` line on stderr |
| 3 | something Code Sleuth did not expect: one `Error:` line with the message, masked, and one `Hint:` line saying where to report it. No stack trace, unless `CODE_SLEUTH_DEBUG` is set |
| 130 | Ctrl-C at the goal prompt (Ctrl-D, closing it with no answer, is a refusal) |

A check that stops part-way, on a file it cannot open or a shape it did not expect, is not an error of the run:
it reads *not investigated*, saying what went wrong, and the run goes on. A reader that closes the pipe early
(`| head`) ends what is printed, not the run: the case is still written, and the exit code is the run's own.

A failed polish request is not a refusal: the card stays as written, and the exit code is what it would have been without `--polish`.

## Refusals

Each is one `Error:` line and one `Hint:` line, then exit 2. Those marked *before the case* stop the run
before any check runs and before anything is written.

| Refused | When | Before the case |
| --- | --- | --- |
| an unknown flag, or an argument it does not take | `--nope`, `code-sleuth a b` | yes |
| a URL in place of a folder | `https://...` or `git@host:...`; the hint says to clone it | yes |
| a folder it cannot find, a file in place of a folder, or a folder it cannot read | | yes |
| a git older than 2.31 | it would ignore the settings that keep a repository from running its own commands | yes |
| an unknown goal, or a goal not ready yet | `--goal nope`; `--goal security` | yes |
| no goal and no terminal to ask in | a script without `--goal` | yes |
| an answer that is not one of the choices | at the goal prompt | yes |
| an unknown `--fail-on` weight | `--fail-on hunch` | yes |
| a deny list it cannot read, or one inside the repository | the list would publish the names it guards | yes |
| a cases folder inside the repository, or a repository that holds the cases folder | `--out` inside it, or anywhere in the repository a folder you point at is in, a submodule's superproject included; `code-sleuth ~` | yes |
| a repository that holds Code Sleuth's own npm folder | `code-sleuth ~ --out elsewhere`, when npm would run; `--offline` runs no npm | yes |
| `--yes` or `--refile` without `--toolkit` | | yes |
| `--toolkit` with no ToolKit | no PowerShell, or ToolKit's `NewPrompt` does not resolve | yes |
| a `--toolkit-space` ToolKit does not confirm | ToolKit falls back silently for a Space it does not declare | yes |
| `--toolkit` when a card would land in the repository | the Space's `current/` or `backlog/` folder, as ToolKit reports it, is the repository or inside it | yes |
| `--toolkit` when ToolKit does not say where the cards would land | its probe reports no card folders, so Code Sleuth cannot tell they are outside the repository | yes |
| ToolKit refused a card, or failed on one | the cards before it stay filed; the case is written first | no |

## What it prints

The opening line, the repository and the goal, what leaves the machine, the stakeout (a dot per check), the
stamped verdict (`By my checklist: ...`, and under MET and NEARLY MET one line on what the list doesn't cover,
with its link), the checklist
grouped as the case file groups it, where the case went, and lines such as the examples line, `Polishing ...`,
`Filed` and `Skipped`, then one polish line and one ToolKit line. Colour only on a terminal, and never with a
non-empty `NO_COLOR`; every line also carries its word, so colour is never the only signal.
