# Quick start

From nothing to your first case: a checklist of what's worth doing before a repository is public facing, and a
card, ready to file, for each item that needs work (the lightest items, hunches, get one when you ask with
`--all`). Code Sleuth runs on your machine, reads the repository and
never writes to it.

## What you need

- **Node 24** (the repository's `.nvmrc` names it). Download it from [nodejs.org](https://nodejs.org/en/download),
  or with a version manager: [nvm](https://github.com/nvm-sh/nvm) on macOS and Linux (`nvm install` in the
  clone reads `.nvmrc`), [nvm-windows](https://github.com/coreybutler/nvm-windows) on Windows
  (`nvm install 24`, then `nvm use 24`).
- **git 2.31 or newer**, for the history checks. An older git is refused, since it would ignore the settings
  that keep a repository from running its own commands. Without git, `secrets.history` reads *not investigated* and says why, and
  `names.deny` reads the files but not the commit messages, and says so when the files are clean.

Code Sleuth is not on npm yet. You run it straight from GitHub with npx, or from a clone.

## Try it with npx

From your home folder, not the repository you want to know about, with the path to that repository:

```sh
cd ~ && npx github:johnfrog76/code-sleuth#v0.2.0 path/to/your/repo --goal public
```

Start npx outside the repository: npm reads the `.npmrc` of the folder it starts in, so a repository's own
settings would reach npm before Code Sleuth starts. On Windows, in PowerShell 5.1, which has no `&&`, run
`cd ~` first, then the npx line; in cmd, which does not read `~`, run `cd %USERPROFILE%` first, then the npx
line with the path to your repository.

`#v0.2.0` pins the release you run, so a new commit on GitHub doesn't change what runs. The first run builds
Code Sleuth from source, with its development tools, then runs it. Wherever these docs say `code-sleuth`, put
`npx github:johnfrog76/code-sleuth#v0.2.0` in its place, from outside the repository.

## Install from a clone

To keep it on your PATH, or to work on it:

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
now there is one goal to pick: **the public-facing goal**. Security and quality are planned for a later release.

You get the verdict by Code Sleuth's checklist (MET, NEARLY MET or NOT MET), the checklist grouped by how
much each finding weighs, and where the case file went. MET means nothing on the checklist stands in the
way. MET is a finding by this checklist, not permission to publish: see
[what the verdict means and doesn't](CHECKS.md#what-the-verdict-means-and-doesnt).

```text
Case file  ~/Library/Application Support/code-sleuth/cases/widget-1a2b3c4d/2026-10-31-public-1/case.md
Cards      5 in cards/ (hunches get cards with --all)
```

The case file is written to your own cases folder, never into the repository. It holds `case.json`, `case.md`
and a card for each smoking gun and loose end (hunches get one with `--all`): see [CASE-FILE.md](CASE-FILE.md). Every check, and how to fix what it finds, is in
[CHECKS.md](CHECKS.md).

Where your cases folder is, on each platform, is in [CONFIGURATION.md](CONFIGURATION.md#the-cases-folder).

## Useful flags

`--deny <file>` checks for names that must not appear; `--fail-on smoking-gun` exits 1 when one is found, for
CI; `--json` prints the record. Every flag, every refusal and the exit codes are in [CLI.md](CLI.md).

## Turn on the polish pass

With an Anthropic API key, `--polish` has each card reworded to read more easily, and a rewrite that drops or
changes a path its evidence cites, a number or a masked value is thrown away ([POLISH.md](POLISH.md#the-guard)).

The API key goes in a `.env` in Code Sleuth's own folder, beside your cases; no other `.env` is read. A key set
in your environment works too, and wins. From the clone,
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

Not working from a clone? Run Code Sleuth once with no API key: it puts a copy of `.env.example` beside where
the `.env` goes, and its Polish line gives the one line that copies it into place, with both paths in full. Then:

```sh
code-sleuth --goal public --polish
```

The Polish line says where the API key came from, never what it is. Each request carries one card's text, already
masked, and Code Sleuth's prompt. A card's evidence lines quote the lines they point at, so short excerpts of your
files go with it, masked like everything else; never a whole file. See [POLISH.md](POLISH.md).

## File the cards in ToolKit

With [ToolKit](https://johnfrog76.github.io/toolkit/) installed, `--toolkit` files each card as a real
ToolKit card, through ToolKit's own command, once each:

```sh
code-sleuth --goal public --toolkit
```

It asks first, naming the count, and the Space when ToolKit reports one. See [TOOLKIT.md](TOOLKIT.md).
