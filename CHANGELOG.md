# Changelog

All notable changes to Code Sleuth are written here, for the people who use it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The docs open with what each one gives you, and claim only what the code and tests back. `docs/CHECKS.md` says what being public facing opens (the files, the history and the tracker) and that the tracker is not read yet. A goal that is not ready says it is planned for a later release, not that it comes in the next one.
- The verdict says it is the checklist's: `By my checklist: nearly ready to be public facing.` A READY verdict adds one line saying the call is yours. `docs/CHECKS.md` says where the bar comes from, how a project's own context moves it, and what Code Sleuth doesn't judge.
- The goal's words: the output, the case file, `--help`, the goal prompt, the docs and the project's page call the goal "public facing" wherever a person reads it. The verdict reads `By my checklist: not ready to be public facing.`, the goal prompt asks `Is it ready to be public facing?`, and the run's goal line is `Goal  public facing`. The flag stays `--goal public`.
- The README opens with the ASCII sloth alone. The drawn logo is gone from it, because GitHub's mobile app showed it as a broken image. The project page and the social preview still carry it.

### Added

- A placeholder project page, `site/`, for GitHub Pages: the logo, light and dark, and a link to the repository.
- The API key can live in a `.env` in Code Sleuth's own folder, beside the cases folder: copy `.env.example` there and fill it in. A key in your environment still wins. No other `.env` is read, the key never reaches a process Code Sleuth starts, the run says where the key came from and never what it is, and it warns when others can read the file. With no key, the run prints the one line that copies the `.env.example` beside the command into place, both paths in full; the case file keeps it with both paths in their `~` form.
- A project contact, `codesleuth.project (at) outlook.com`, for conduct reports (`CODE_OF_CONDUCT.md`) and security reports (`SECURITY.md`, beside GitHub's private vulnerability reporting). It is written out, not linked, to slow down address scrapers.

### Fixed

- A secret's value no longer reaches output in clear in four more ways. A line another check reports was cut to 160 characters before it was masked, so a token the cut split matched no rule and went out with most of it showing; every excerpt is now masked first, then cut. A not-investigated reason can quote the repository (a manifest's `license`, a file's name), and is now masked too. Where two matches overlap, as an access key id runs into its secret, the whole span is masked, not only the first. An `.npmrc` token holding `$&` was pasted back beside its mask; it is now cut out at its own place.
- The one writer guard no longer lets a case land in the repository. A folder inside the repository whose name starts with two dots, such as `--out repo/..cases`, read as outside it, so the case, the cards and the machine key were written there; a step up now counts only as a whole `..`. Pointed at a folder inside a repository, the guard compared against that folder alone, so `--out` could land beside it; it now holds the whole repository, and a submodule's superproject. The same holds for `--deny` and for where ToolKit would file.
- A repository's `.npmrc` can no longer have your npm token, or any of your environment's variables, sent to a host it chooses. npm ran in the repository, so its `.npmrc` was npm's project config: a `proxy` received your registry token, and a `${NAME}` in a registry URL sent that variable's value. npm now runs on a copy of `package.json` and the lockfile in Code Sleuth's own folder, so the repository's `.npmrc` is never read, and npm sees only the variables it needs, with those your own `.npmrc` names. `deps.outdated` gives npm a `package.json` naming each direct dependency from npm's registry at `*`, devDependencies among them, since with nothing installed `npm outdated` leaves out each missing devDependency; no spec from the repository reaches npm, so a git, path, URL or alias dependency is never fetched, and is named in the result instead.
- A repository can no longer have Code Sleuth's `git status` run a filter through a submodule, or through a filter named with an `=`. `status` read into each submodule, whose own config can name a filter; it no longer reads into one, so a change inside a submodule no longer marks the repository dirty. A setting given with `-c` is split at its first `=`, so a driver named `a=b` was never turned off; every setting now goes through git's `GIT_CONFIG_KEY_<n>` variables, which take the key whole. A git older than 2.31, which would ignore those variables without a word, is refused: one `Error:` line and one `Hint:` line, before the repository is read.
- Every folder Code Sleuth writes to goes through one guard. A repository that holds Code Sleuth's own folder, as `code-sleuth ~ --out elsewhere` does, is refused when npm would run, since npm keeps its cache and logs there.
- git's `fd`, `ftp` and `ftps` transports, and any `git-remote-<name>` helper on the machine, are turned off by name too.
- The case file keeps the `.env.example` to copy as a record (`keyExample`), not a line with a quoted `~` that would not run; the terminal still prints the line to run.
- Every case file is written with LF line endings, a polished card that came back with CRLF among them.
- A repository's own git config can no longer re-allow a transport. Every git call turned off transports with `protocol.allow=never`, which a repository's `protocol.<name>.allow` overrides; each transport is now turned off by name, on the command line, which outranks the repository's config. `--toolkit` is refused when ToolKit does not say where the cards would land.
- A file that would not parse no longer reads as no file. A `package.json` that isn't JSON made `deps.advisories`, `deps.outdated` and `deps.lockfile` read clean with nothing read, and could tip `license.deps`, `license.file`, `ci.tests` and `deps.updates` either way; each now reads not investigated, naming the file. `license.file` reads not investigated, rather than clean, when it cannot tell which license the file's text is.
- Nothing Code Sleuth runs writes into the repository it investigates. A repository's `.npmrc` could point npm's cache and its debug log into the tree, and npm writes a log on every command; npm's cache and logs now go to Code Sleuth's own folder. `--toolkit` is refused when a folder ToolKit would write a card into is the repository or inside it; a hub that only holds the repository, as ToolKit's default hub does, files as before.
- On a partial clone, Code Sleuth's git no longer fetches missing objects from the remote, a call off the machine the run never named. Every git call now blocks every transport and lazy fetching, the Repo line says "a partial clone", and `secrets.history` reads not investigated: some of the history is not there.
- A check that read nothing no longer reads clean. On a project in another ecosystem (Python, Go, Rust and others), `deps.advisories`, `deps.outdated` and `license.deps` read not investigated and name the manifest they found; beside an npm project, a clean npm side says the other side was not read. `names.deny` outside git reads not investigated when the files are clean, since the commit messages were not read, and a workflow that doesn't parse as YAML makes the workflow checks read not investigated, naming it.
- The polish guard keeps every path the card's evidence cites, word for word. It used to know a path only by its shape, so a rewrite that changed `.env:3` or dropped a bare `Dockerfile` or `LICENSE` was kept. It also counts each number: dropping one of two equal numbers is no longer kept.
- A secret on a line another check reports is masked too. A token in a `TODO` comment, a home-folder path or a workflow line was kept whole in `case.json`, the cards and the polish request; every excerpt, and every path, now goes through the secret rules in one place, whichever check found it.
- A repository's own git configuration can no longer have Code Sleuth run a command. A file-system monitor or a filter driver named in the investigated repository's `.git/config` ran when Code Sleuth read its status or file list; every git call now turns those off, along with the signature program, hooks, the pager and an external diff. A filter marked required, as git-lfs marks its own, no longer makes reading the status fail.
- An API key set in the environment no longer reaches the processes Code Sleuth starts. git, npm, gh and ToolKit's shell inherited it before; a key from Code Sleuth's `.env` never did. Every child now starts through one helper that takes the key out, in any letter case since Windows matches names without regard to case, and a test keeps any new child from skipping it.
- The build makes `dist/cli/main.js` executable itself, so `code-sleuth` runs after any rebuild, a re-clone under an old `npm link` among them, instead of answering "permission denied".
- A clean `npm ci` no longer reports moderate vulnerabilities: the development tools' `minimatch` is overridden to 11.0.4, past the advisory. Nothing Code Sleuth runs used it.
- `--toolkit` files in the repository's own ToolKit Space, the one whose address is its `origin`, rather than whichever Space is active. With no matching Space it falls back to the active one, and the footer says so.

## [0.1.0] - 2026-11-03

The first release: the whole loop on one goal, going public. Run from a clone, through `npm link`.

### Added

- `code-sleuth [<folder>] --goal public` investigates a repository and prints the verdict (READY, NEARLY or
  NOT READY) and the checklist, in the detective's voice. With no `--goal` in a terminal, it asks.
- Twenty-four checks for going public: secrets in the tree and in history, key and `.env` files, the license
  and dependency licenses, paths from somebody's machine, a deny list (`--deny`), large files, the README and
  community files, issue and pull request templates, CI and tests in CI, workflow permissions,
  `pull_request_target` and script injection, lockfiles, known advisories, dependency updates, dependencies a
  major version behind, and markers left in the code.
  `code-sleuth checks` lists them.
- A case file for every run, written outside the repository: `case.json`, `case.md` and one card per finding,
  in the shape a ToolKit card's description takes.
- Secrets are masked everywhere (`ghp_****9f`) and never stored; a keyed hash tells two runs it is the same
  secret.
- `--polish`: with an API key set, each card is reworded by Claude Haiku, and a rewrite that drops
  or changes a path, a number, a masked value or the fingerprint is thrown away.
- `--toolkit`: with ToolKit installed, each card is filed as a real ToolKit card through ToolKit's own
  command, once per check, after asking. `--yes`, `--refile`, `--toolkit-space` and `--toolkit-prefix`.
- `--out`, `--all`, `--json`, and `--fail-on smoking-gun|loose-end` for CI.
- `deps.outdated`: going public finds a direct dependency a major version or more behind its latest, through `npm outdated`, which sends package names to npm's configured registry. The run names that call before it makes it, and `--offline` turns it off.
- `deps.advisories`: going public and security find a locked package with a known advisory, through `npm audit`, or through GitHub's advisory database with `gh` when there is no npm. Both send the lockfile's package names and versions; the run names the call before it makes it, and `--offline` turns it off. A critical or high advisory is a smoking gun, a moderate one a loose end, a low one a hunch.
- A logo: the sloth private eye's head and hat, in the README and as the favicon and social preview.

### Changed

- The polish prompt asks the model to reword only: to add no specific the card does not give (a name, a place, a count, an example, a kind), to keep each word's meaning, and to drop nothing. The docs now say what the guard checks -- every path, number, masked value and the fingerprint -- and that it cannot see meaning.
- A match in an example location (`test/fixtures/`, `__fixtures__/`, a line marked `code-sleuth:example`, or `--examples <glob>`) is shown and no longer counted: it makes no card and changes no verdict, and the case asks you to check that it is fake.

### Fixed

- With `--toolkit` and no terminal to ask in, the run says once, not twice, that nothing was filed and how to file.
