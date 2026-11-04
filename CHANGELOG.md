# Changelog

All notable changes to Code Sleuth are written here, for the people who use it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The verdict says it is the checklist's: `By my checklist: nearly ready to go public.` A READY verdict adds one line saying the call is yours. `docs/CHECKS.md` says where the bar comes from, how a project's own context moves it, and what Code Sleuth doesn't judge.

### Added

- A placeholder project page, `site/`, for GitHub Pages: the logo, light and dark, and a link to the repository.
- The API key can live in a `.env` in Code Sleuth's own folder, beside the cases folder: copy `.env.example` there and fill it in. A key in your environment still wins. No other `.env` is read, the key never reaches a process Code Sleuth starts, the run says where the key came from and never what it is, and it warns when others can read the file. With no key, the run prints the one line that copies the `.env.example` beside the command into place, both paths in full; the case file keeps it with both paths in their `~` form.
- A project contact, `codesleuth.project (at) outlook.com`, for conduct reports (`CODE_OF_CONDUCT.md`) and security reports (`SECURITY.md`, beside GitHub's private vulnerability reporting). It is written out, not linked, to slow down address scrapers.

### Fixed

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
