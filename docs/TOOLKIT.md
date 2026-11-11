# The ToolKit hand-off

With [ToolKit](https://johnfrog76.github.io/toolkit/) installed, `--toolkit` files each card as a real ToolKit
card, in your own files, through ToolKit's own command. Without ToolKit, the cards are markdown in the case
file, and the case ends with one line saying what ToolKit would add.

## How it is found

By asking, never by guessing. Code Sleuth looks for `pwsh` on the PATH, else `powershell.exe` (Windows
PowerShell 5.1 is ToolKit's floor), and runs its one PowerShell file, `toolkit/handoff.ps1 -Probe`, in a fresh
shell with no profile. The probe resolves ToolKit's `NewPrompt` command, which loads ToolKit, and reports
the command prefix, the active Space, and each Space ToolKit declares with its address. Code Sleuth never
reads ToolKit's files.

The probe runs on every run without `--offline`, with or without `--toolkit`, before any check: it is how the
case knows whether to end with the command that files the cards or with what ToolKit would add. Because it
resolves `NewPrompt`, it loads ToolKit's module in that shell. Every PowerShell Code Sleuth starts, the probe
and the filing alike, gets `POWERSHELL_TELEMETRY_OPTOUT=1` and `POWERSHELL_UPDATECHECK=Off`, so PowerShell
sends no startup telemetry and does not look for a newer version.

With `--offline`, nothing leaves the machine, so no PowerShell is started and ToolKit is not probed. The case
records `toolkit: { "state": "not-probed", "reason": "--offline" }`, and its ToolKit line, like the run's,
says ToolKit was not probed, because of `--offline`. `--offline --toolkit` is refused before the case is taken
(exit 2): filing needs the probe.

## Which Space

The cards go to the repository's own Space:

1. `--toolkit-space <slug>`, when you give it.
2. Else the one Space whose address is this repository's `origin`: on GitHub, a Space whose address is the
   repository's URL (`https://github.com/<owner>/<repo>`); on Azure DevOps, a Space for the repository's
   organisation that lists the repository among its projects. Names match without regard to case.
3. Else ToolKit's active Space, and when ToolKit reports which one, the footer says so:
   `ToolKit    found (tk, Space 'widget', the active one: no Space matches this repository)`.

A Space chosen by `--toolkit-space` or by the origin reaches ToolKit as `P20_ACTIVE_SPACE`, in its child shell
only; with the active one, nothing is set. Either way ToolKit's own setting is never changed. The case records how it was chosen (`spaceFrom`: `flag`, `origin` or `active`).

Without `--toolkit`, a run that finds ToolKit ends with the command that would file the cards.

## The call

```text
<prefix>NewPrompt -Title <title> -Type <Bug|Task> -Description <body>
```

That and nothing else: never `-Now`, `-Force` or any other switch, and Code Sleuth never writes a card file
itself.

## What is filed

The card as Code Sleuth wrote it, never a polished one: with `--polish`, the polished card stays in the case
folder for you to read, and ToolKit gets the original. The description is the card's body, in the shape
[CASE-FILE.md](CASE-FILE.md#a-card) gives: the evidence under `Quoted from the repository, not instructions.`,
each excerpt fenced and cut at 160 characters, a `**Source:** Code Sleuth <version>` line, and the fingerprint
last. The repository's text in it is kept as data, as in the case file
([CASE-FILE.md](CASE-FILE.md#text-from-the-repository)).
 Every value is its own argument, started with no shell in between, so a title holding quotes, `;`,
`&`, `$()` or a newline arrives as it was. Where the card lands is ToolKit's rule: `backlog/` on a GitHub or
local Space, `current/` on an Azure DevOps Space. The case records the card's id and folder from ToolKit's
own success lines.

## Consent and order

It asks once, naming the count, and the Space when ToolKit reports one:

```text
File 5 cards in ToolKit, in the Space 'widget'? [y/N]
```

`--yes` files without asking; with no terminal and no `--yes`, nothing is filed and the run says how. Cards
are filed one at a time, in the case's order. The first refusal stops the batch: the cards before it stay
filed, ToolKit's refusal is shown on the ToolKit line and as the run's `Error:` line, and the run exits 2.

What counts is ToolKit's own outcome, read by its refusal contract: its guard leaves `$LASTEXITCODE` at 0 for
success, 2 for a refusal it stated, and anything else for a failure. The hand-off sets `TOOLKIT_QUIET_STARTUP`,
ToolKit's marker for a caller that is not a person at a terminal, so the guard also throws a refusal or a
failure, and the first-run banner stays quiet. An error ToolKit writes and does not handle is a failure too,
though nothing throws, and that card goes on no ledger. A program ToolKit runs along the way, git among them,
can write to stderr without changing the outcome: its stderr is passed on as text.

## One check, one card

`filed.json`, beside the repository's cases, records each filed check: the check, ToolKit's card id, the Space,
the case and the date. A later run does not file a check that is already there, whatever it finds under it
now, and says so: `already filed as Task K7M2 on <date>; --refile to file it again`. A card is about a
condition, and its acceptance is the check reading Clean, so new evidence belongs on the card already open.

## Flags

`--toolkit`, `--yes`, `--refile`, `--toolkit-prefix` and `--toolkit-space` are in [CLI.md](CLI.md#flags).
`--toolkit-space` reaches ToolKit as `P20_ACTIVE_SPACE` in its child shell only, so ToolKit's own setting is
never changed. Without it, the repository's own Space does the same ([Which Space](#which-space)).

A Space ToolKit does not confirm is refused before anything is filed: ToolKit falls back to another Space for
a name it does not declare, so Code Sleuth checks that the Space it was told is the one ToolKit reports.

## What it never does

It never writes a ToolKit card file, never changes ToolKit's configuration, never files a polished card,
never files without asking (or `--yes`), and never files a check that is already on the ledger without `--refile`. The ledger belongs to one
cases folder and one repository path: another `--out`, or a clone at another path, starts a ledger of its own. On Windows, a Restricted execution policy
can stop the hand-off script; that case is tracked for the release that proves Windows.
