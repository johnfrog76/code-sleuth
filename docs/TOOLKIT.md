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
itself. Every value is its own argument, started with no shell in between, so a title holding quotes, `;`,
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

It never writes a ToolKit card file, never changes ToolKit's configuration, never files without asking (or
`--yes`), and never files a check that is already on the ledger without `--refile`. The ledger belongs to one
cases folder and one repository path: another `--out`, or a clone at another path, starts a ledger of its own. On Windows, a Restricted execution policy
can stop the hand-off script; that case is tracked for the release that proves Windows.
