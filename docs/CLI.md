# The command line

Every command, flag and refusal, and the exit codes. `code-sleuth --help` prints the short form. A test holds
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
| `--json` | | prints `case.json` to stdout, and the human output to stderr |
| `--fail-on` | `smoking-gun` or `loose-end` | exits 1 when a finding at or above that weight is found |
| `--offline` | | makes no network call: `deps.outdated` and `deps.advisories` read not investigated, "--offline" ([CONFIGURATION.md](CONFIGURATION.md#what-leaves-the-machine)) |
| `--examples` | a glob | another example location, beside `test/fixtures/` and `__fixtures__/`; repeatable. A match there is shown and not counted ([CHECKS.md](CHECKS.md#example-locations)) |
| `--polish` | | rewords each card with a model, every fact kept; needs `ANTHROPIC_API_KEY` ([POLISH.md](POLISH.md)) |
| `--toolkit` | | files the cards in ToolKit, after asking ([TOOLKIT.md](TOOLKIT.md)) |
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
| 2 | a stated refusal: one `Error:` line and one `Hint:` line on stderr, and nothing else |

A failed polish request is not a refusal: the card stays as written and the run exits 0.

## Refusals

Each is one `Error:` line and one `Hint:` line, then exit 2. Those marked *before the case* stop the run
before anything is read or written.

| Refused | When | Before the case |
| --- | --- | --- |
| an unknown flag, or an argument it does not take | `--nope`, `code-sleuth a b` | yes |
| a URL in place of a folder | `https://...` or `git@host:...`; the hint says to clone it | yes |
| a folder it cannot find, a file in place of a folder, or a folder it cannot read | | yes |
| an unknown goal, or a goal not ready yet | `--goal nope`; `--goal security` | yes |
| no goal and no terminal to ask in | a script without `--goal` | yes |
| an answer that is not one of the choices | at the goal prompt | yes |
| an unknown `--fail-on` weight | `--fail-on hunch` | yes |
| a deny list it cannot read, or one inside the repository | the list would publish the names it guards | yes |
| a cases folder inside the repository, or a repository that holds the cases folder | `--out` inside it; `code-sleuth ~` | yes |
| `--yes` or `--refile` without `--toolkit` | | yes |
| `--toolkit` with no ToolKit | no PowerShell, or ToolKit's `NewPrompt` does not resolve | yes |
| a `--toolkit-space` ToolKit does not confirm | ToolKit falls back silently for a Space it does not declare | yes |
| ToolKit refused a card, or failed on one | the cards before it stay filed; the case is written first | no |

## What it prints

The opening line, the repository and the goal, what leaves the machine, the stakeout (a dot per check), the
stamped verdict, the checklist grouped as the case file groups it, where the case went, one polish line and
one ToolKit line. Colour only on a terminal, and never with `NO_COLOR`; every line also carries its word, so
colour is never the only signal.
