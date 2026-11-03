# Configuration

Everything Code Sleuth reads besides the repository and its flags. It has no configuration file, and it
never writes a setting anywhere.

## Environment variables

| Variable | Read by | Does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | the polish pass | the model key. Read from here and nowhere else, never written or printed. With `--polish`, turns the polish pass on ([POLISH.md](POLISH.md)) |
| `CODE_SLEUTH_MODEL` | the polish pass | the model, in place of `claude-haiku-5-5` |
| `NO_COLOR` | the terminal output | any value turns colour off |
| `XDG_DATA_HOME` | the cases folder, on Linux | where the cases folder goes, in place of `~/.local/share` |
| `LOCALAPPDATA` | the cases folder, on Windows | where the cases folder goes |
| `PATH` | the ToolKit hand-off | where `pwsh` or `powershell.exe` is looked for |

Two more, set or cleared by Code Sleuth itself for the processes it starts, never read from you:

- `P20_ACTIVE_SPACE` is set in ToolKit's child shell only, to the Space `--toolkit-space` names, or else to
  the Space whose address is the repository's origin ([TOOLKIT.md](TOOLKIT.md#which-space)). Your own ToolKit
  setting is never changed.
- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and `GIT_CEILING_DIRECTORIES` are removed for every `git` it runs,
  and `GIT_OPTIONAL_LOCKS=0` is set, so an inherited variable cannot point git at another repository and a
  read never refreshes the index.

**Deliberately not read:** `ANTHROPIC_BASE_URL`. The polish request always goes to
`https://api.anthropic.com/v1/messages`. Nor are `ANTHROPIC_AUTH_TOKEN` or saved credential profiles.

For development only: `CHROME`, the browser `scripts/render-atoms.mjs` renders the atoms with, when Chrome is
not in its usual place. For the tests only: `CODE_SLEUTH_TOOLKIT` (a ToolKit checkout to run the real hand-off against) and
`UPDATE_GOLDEN` ([TESTING.md](TESTING.md)).

## What leaves the machine

Only these calls, and the run's header names each one, on its `Out` line, before any check runs. Nothing runs
that is not named there. `--offline` turns off every call but the polish request, which only `--polish` turns
on.

| Call | Made by | When | What is sent |
| --- | --- | --- | --- |
| `npm outdated --json --long` | `deps.outdated` | npm found, not `--offline`, and a `package.json` with dependencies beside `package-lock.json` | package names, to npm's configured registry. npm's own configuration decides where that is (`.npmrc`, a scoped or private registry), and Code Sleuth leaves it alone. Never a file's contents, the repository's path or its URL |
| `npm audit --json` | `deps.advisories` | npm found, not `--offline`, and a `package.json` with dependencies beside `package-lock.json` | every locked package's name and version, to npm's configured registry, as `npm audit` always does. Never a file's contents, the repository's path or its URL |
| `gh api /advisories` | `deps.advisories` | no npm, `gh` found, not `--offline`, and the same lockfile | the ecosystem (`npm`) and every locked package's name and version, to GitHub, in batches of fifty. Which advisory belongs to which locked version is worked out on the machine |
| the polish request | `--polish` | a key in `ANTHROPIC_API_KEY` | each card's text, already masked, to `https://api.anthropic.com/v1/messages` ([POLISH.md](POLISH.md)) |

With `--offline`, `deps.outdated` and `deps.advisories` read *not investigated*, with the reason `--offline`,
and make no call. Code Sleuth sends nothing else: no telemetry, no update check. npm's own update notice and
funding message, and gh's update notice and prompts, are turned off for the calls it makes.

## The cases folder

Where every case is written. Never inside the repository it investigates.

| Platform | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/code-sleuth/cases` |
| Linux | `$XDG_DATA_HOME/code-sleuth/cases`, else `~/.local/share/code-sleuth/cases` |
| Windows | `%LOCALAPPDATA%\code-sleuth\cases` |

`--out <dir>` names another. Either way, a cases folder inside the repository is refused, and so is a
repository that holds the cases folder (`code-sleuth ~`). Both compare real paths, links and letter case
resolved. What is inside the folder is in [CASE-FILE.md](CASE-FILE.md).

The cases folder also holds `machine-key`, a random key made on first use and readable by its owner only, which
hashes secrets so two runs can tell it is the same secret.
