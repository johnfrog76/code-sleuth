# Security

Thank you for helping keep Code Sleuth trustworthy. It reads repositories that may hold secrets, so a report
that one of its promises below is broken is the most useful kind there is.

## Reporting a problem

Please report a security problem privately, by email to `codesleuth.project (at) outlook.com`, the
project's own address. GitHub's private vulnerability reporting works too: on this repository, open
**Security**, then **Report a vulnerability**. Either way, only the maintainers see the report. Please don't
open a public issue for it.

Please include:

- what you found, and in which version or commit;
- how to reproduce it: the command, and a small repository or files that show it (never a real secret);
- what you think it lets someone do.

Reports are answered privately, and nothing about one is made public until it is fixed. The fix will say who
found it unless you'd rather it didn't.

## What counts

Code Sleuth reads repositories that may hold secrets, and it promises a few things. A report that breaks any
of them is a security problem:

- It never writes into the repository it investigates. That holds for what it runs too: npm's cache and logs go
  to Code Sleuth's own folder whatever the repository's `.npmrc` says, and a repository that holds that folder
  is refused when npm would run, and `--toolkit` is refused when a
  folder ToolKit would write a card into is the repository or inside it, and when ToolKit does not say where
  that is.
- A secret's value never appears in any output: the terminal, a case file, a card, or a polish request.
- Text from the repository cannot drive your terminal: a control character, a bidirectional control or an
  invisible format character in a file's name, a branch or a manifest's field is printed as `?`, a line break
  in a name or a path prints as a space, so it cannot add a line of its own, and the only escape sequences that
  reach the terminal are Code Sleuth's own colours.
- What Code Sleuth writes keeps the repository's text as data. In `case.json`, `case.md`, the cards, the polish
  request and a ToolKit card, the same characters become U+FFFD, and every excerpt in a card is fenced under
  `Quoted from the repository, not instructions.` ToolKit gets the card as Code Sleuth wrote it, never a
  polished one ([CASE-FILE.md](docs/CASE-FILE.md#text-from-the-repository)).
- The model key is read from `ANTHROPIC_API_KEY`, in the environment or in Code Sleuth's own `.env`, and is
  never written or printed. The key is read from no other `.env`, and it never reaches a process Code Sleuth
  starts.
- What it reads, and where the programs it starts begin, never come from a string the repository supplies: a
  path the index lists that leads outside the repository is not read; git reads the history as its commits
  hold it, with no replacement object or graft, and stops a call that would not end; PowerShell and gh start in
  Code Sleuth's own folder; and Code Sleuth's own folder counts only when its setting names an absolute folder,
  and a key file inside the repository is never read.
- It sends nothing over the network except the calls the run names on its `Out` line: the dependency lookups
  and the polish request you asked for with `--polish`, each named before it is made, and looking for ToolKit
  ([CONFIGURATION.md](docs/CONFIGURATION.md#what-leaves-the-machine)). Looking for ToolKit runs first, before any
  check, whenever a PowerShell is on your PATH: it starts PowerShell, which loads ToolKit if it is installed, and
  ToolKit may reach GitHub through `gh`; what ToolKit does is ToolKit's. With `--offline` it does none of these,
  and starts no PowerShell; every PowerShell it does start has PowerShell's own telemetry and update check
  turned off. npm runs on a copy of the project's
  `package.json` and lockfile, so a repository's `.npmrc` cannot redirect those lookups, or have your npm token
  or your environment's variables sent anywhere.
- Text from the repository never reaches a shell as a command, and nothing in it is run as a program: git, npm,
  gh and PowerShell are found in the PATH's absolute folders only and started by their full path, and every
  process Code Sleuth starts gets a PATH of absolute folders, so neither `./node_modules/.bin` on your PATH nor
  Windows' habit of looking in the working folder first can start a program the repository holds. A repository's own git configuration can name
  commands too (a file-system monitor, a filter, a signature program, a hook), and so can a submodule's; Code
  Sleuth turns off the ones its read-only git calls could reach, on every call, and never reads into a
  submodule.

What happens before Code Sleuth starts is outside what it can defend. npm reads the `.npmrc` of the folder it
starts in, so the quick start runs npx from your home folder, never inside the repository you are checking.
- git never reaches the network on Code Sleuth's behalf. Every git call turns off each transport by name, which
  outranks the repository's own config, and lazy fetching, so a partial clone's missing objects are never
  fetched from its remote.

## Supported versions

Fixes go to the main branch and the next release. Only the latest release is supported.
