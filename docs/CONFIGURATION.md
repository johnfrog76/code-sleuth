# Configuration

A first run needs none of this: Code Sleuth works with no setup beyond its flags. This page is everything
else it reads -- a few environment variables, your home folder and its own `.env` -- and every call it makes off
the machine.
It has no configuration file, and it never writes a setting anywhere.

## Environment variables

| Variable | Read by | Does |
| --- | --- | --- |
| `HOME` (`USERPROFILE` on Windows) | the cases folder and Code Sleuth's own folder | your home folder, through Node's `os.homedir()`: both folders are under it unless `XDG_DATA_HOME` or `LOCALAPPDATA` says otherwise |
| `CODE_SLEUTH_MODEL` | the polish pass | the model, in place of `claude-haiku-5-5` |
| `NO_COLOR` | the terminal output | any value but an empty one turns colour off |
| `XDG_DATA_HOME` | the cases folder, on Linux | where the cases folder goes, in place of `~/.local/share` |
| `LOCALAPPDATA` | the cases folder, on Windows | where the cases folder goes |
| `PATH` | the checks and the ToolKit hand-off | where `git`, `gh`, and `pwsh` or `powershell.exe` are looked for, and `npm` everywhere but Windows, where npm's own `npm-cli.js` beside Node is used ([KNOWN-GAPS.md](KNOWN-GAPS.md#not-proven-yet)) |

The API key goes in Code Sleuth's own `.env` ([POLISH.md](POLISH.md#where-the-api-key-goes)), or set the
variable named in `.env.example` in your environment; a value there wins. Either way it is never written or
printed, and with `--polish` it turns the polish pass on.

The API key's variable is read from you, as above, and removed from every process Code Sleuth starts, in any
letter case, so git, npm, gh and ToolKit's shell never see the key.

Some are set or cleared by Code Sleuth itself for the processes it starts, never read from you:

- `P20_ACTIVE_SPACE` is set in ToolKit's child shell only, to the Space `--toolkit-space` names, or else to
  the Space whose address is the repository's origin ([TOOLKIT.md](TOOLKIT.md#which-space)). Your own ToolKit
  setting is never changed.
- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and `GIT_CEILING_DIRECTORIES` are removed for every `git` it runs,
  and `GIT_OPTIONAL_LOCKS=0` and `GIT_NO_LAZY_FETCH=1` are set, so an inherited variable cannot point git at
  another repository, a read never refreshes the index, and a partial clone never fetches what it is missing.
- `npm_config_update_notifier=false` and `npm_config_fund=false` are set for npm, and `GH_PROMPT_DISABLED=1`
  and `GH_NO_UPDATE_NOTIFIER=1` for gh, so neither prints a notice or asks a question.
- `npm_config_cache` and `npm_config_logs_dir` are set for npm, to `npm/` in Code Sleuth's own folder
  ([below](#code-sleuths-own-folder)), so a repository's `.npmrc` cannot have npm write into the repository.

**Deliberately not read:** `ANTHROPIC_BASE_URL`. The polish request always goes to
`https://api.anthropic.com/v1/messages`. Nor are `ANTHROPIC_AUTH_TOKEN` or saved credential profiles.

For development only: `CHROME`, the browser `scripts/render-atoms.mjs` renders the atoms with, when Chrome is
not in its usual place. For the tests only: `CODE_SLEUTH_TOOLKIT` (a ToolKit checkout to run the real hand-off against) and
`UPDATE_GOLDEN` ([TESTING.md](TESTING.md)).

## What leaves the machine

Only these calls, and the run's header names each one, on its `Out` line, before any check runs. Code
Sleuth's own calls go nowhere else: git only reads the local repository, and with `--toolkit`, ToolKit's own
command files the cards in your ToolKit ([TOOLKIT.md](TOOLKIT.md)), as ToolKit does. `--offline` turns off every
call but the polish request, which only `--polish` turns on.

| Call | Made by | When | What is sent |
| --- | --- | --- | --- |
| `npm outdated --json --long` | `deps.outdated` | npm found, not `--offline`, and a `package.json` with dependencies beside `package-lock.json` or `npm-shrinkwrap.json` | package names, to npm's configured registry. npm's own configuration decides where that is (`.npmrc`, a scoped or private registry), and Code Sleuth leaves it alone. Never a file's contents, the repository's path or its URL |
| `npm audit --json` | `deps.advisories` | npm found, not `--offline`, and a `package.json` with dependencies beside `package-lock.json` or `npm-shrinkwrap.json` | what `npm audit` always sends to npm's configured registry: the lockfile's dependency tree, every locked package's name and version. Never a file's contents, the repository's path or its URL |
| `gh api /advisories` | `deps.advisories` | no npm, `gh` found, not `--offline`, and the same lockfile | the ecosystem (`npm`) and every locked package's name and version, to GitHub, in batches of fifty. Which advisory belongs to which locked version is worked out on the machine |
| the polish request | `--polish` | an API key, from the environment or Code Sleuth's `.env` | each card's text, already masked, to `https://api.anthropic.com/v1/messages` ([POLISH.md](POLISH.md)) |

With `--offline`, `deps.outdated` and `deps.advisories` make no call and read *not investigated*: with the
reason `--offline`, or with one that comes first, such as no npm. Code Sleuth sends nothing else: no telemetry, no update check. npm's own update notice and
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

## Code Sleuth's own folder

The cases folder sits in Code Sleuth's own per-user folder (`~/Library/Application Support/code-sleuth` on
macOS, `$XDG_DATA_HOME/code-sleuth` or `~/.local/share/code-sleuth` on Linux, `%LOCALAPPDATA%\code-sleuth` on
Windows). That folder also holds the one `.env` Code Sleuth reads, for the API key
([POLISH.md](POLISH.md#where-the-api-key-goes)). `--out` moves the cases, never the `.env`.

It also holds `npm/`, npm's cache and logs for the lookups Code Sleuth runs. npm would otherwise write them
where its configuration says, and a repository's own `.npmrc` can say inside the repository. A cache of its own
makes the first lookup on a machine a little slower than one through your usual npm cache. A
repository that holds this folder is refused when npm would run, as one that holds the cases folder is.

The cases folder also holds `machine-key`, a random key made on first use (readable by its owner only, on macOS
and Linux), which
hashes secrets so two runs can tell it is the same secret.
