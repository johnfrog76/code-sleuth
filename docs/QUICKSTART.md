# Quick start

Code Sleuth investigates a repository on your machine against one goal, and hands back a checklist and a
card for each thing that stands in the way. It reads the repository and never writes to it.

## What you need

- **Node 24** (the repository's `.nvmrc` names it). Download it from [nodejs.org](https://nodejs.org/en/download),
  or with a version manager: [nvm](https://github.com/nvm-sh/nvm) on macOS and Linux (`nvm install` in the
  clone reads `.nvmrc`), [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows
  (`nvm install 24`, then `nvm use 24`).
- **git**, for the history checks. Without it, those checks read *not investigated* and say why.

Code Sleuth is not on npm yet. You run it from a clone.

## Install from a clone

```sh
git clone https://github.com/johnfrog76/code-sleuth.git
cd code-sleuth
npm ci
npm link
```

`npm ci` installs and builds: the build is the package's `prepare` script, which `npm ci` runs, and `npm link`
runs again before it puts `code-sleuth` on your PATH. `code-sleuth --version` checks it.

## The first run

In the repository you want to know about:

```sh
code-sleuth --goal public
```

Or point it at one: `code-sleuth path/to/repo --goal public`. With no `--goal` in a terminal, it asks. For
now there is one goal to pick: **going public**. Security and quality come in the next release.

You get the verdict (READY, NEARLY or NOT READY), the checklist grouped by how much each finding weighs,
and where the case file went:

```text
Case file  ~/Library/Application Support/code-sleuth/cases/widget-1a2b3c4d/2026-10-31-public-1/case.md
Cards      5 in cards/ (hunches get cards with --all)
```

The case file is written to your own cases folder, never into the repository. It holds `case.json`, `case.md`
and one card per finding: see [CASE-FILE.md](CASE-FILE.md). Every check, and how to fix what it finds, is in
[CHECKS.md](CHECKS.md).

Where your cases folder is, on each platform, is in [CONFIGURATION.md](CONFIGURATION.md#the-cases-folder).

## Useful flags

`--deny <file>` checks for names that must not appear; `--fail-on smoking-gun` exits 1 when one is found, for
CI; `--json` prints the record. Every flag, every refusal and the exit codes are in [CLI.md](CLI.md).

## Turn on the polish pass

With an Anthropic API key, `--polish` has each card reworded to read more easily, and a rewrite that drops or
changes a path, a number or a masked value is thrown away.

The API key goes in a `.env` in Code Sleuth's own folder, beside your cases, and nowhere else. From the clone,
copy the example there, then open the copy and fill in your API key:

```sh
# macOS
mkdir -p ~/Library/Application\ Support/code-sleuth
cp .env.example ~/Library/Application\ Support/code-sleuth/.env
chmod 600 ~/Library/Application\ Support/code-sleuth/.env

# Linux
mkdir -p "${XDG_DATA_HOME:-$HOME/.local/share}/code-sleuth"
cp .env.example "${XDG_DATA_HOME:-$HOME/.local/share}/code-sleuth/.env"
chmod 600 "${XDG_DATA_HOME:-$HOME/.local/share}/code-sleuth/.env"
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\code-sleuth" | Out-Null
Copy-Item .env.example "$env:LOCALAPPDATA\code-sleuth\.env"
```

Not working from a clone? Run Code Sleuth once with no API key: its Polish line names the `.env.example` that
came with it and gives the one line that copies it into place, with both paths in full. Then:

```sh
code-sleuth --goal public --polish
```

The Polish line says where the API key came from, never what it is. It sends each card's text, already
masked, and nothing else. See [POLISH.md](POLISH.md).

## File the cards in ToolKit

With [ToolKit](https://johnfrog76.github.io/toolkit/) installed, `--toolkit` files each card as a real
ToolKit card, through ToolKit's own command, once each:

```sh
code-sleuth --goal public --toolkit
```

It asks first, naming the count and the Space. See [TOOLKIT.md](TOOLKIT.md).
