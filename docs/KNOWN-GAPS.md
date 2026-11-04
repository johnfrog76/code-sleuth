# Known gaps

What is stubbed, specified but not built, or known to read wrong, and what you see when you hit it.

## Not built yet

- **The security and quality goals.** `code-sleuth checks` lists them; a case for them is refused with
  `The security goal isn't ready to investigate yet: it comes in the next release.` They hold too few checks
  today for a verdict to mean anything.
- **Advisory lookups beyond npm.** `deps.advisories` reads npm's `package-lock.json` only; another package
  manager's lockfile, or a Python project, reads *not investigated* with the reason.
- **The ToolKit hand-off through ToolKit's agent.** Only the command-line path is built; the agent path comes
  with the office.
- **Dependency licenses beyond npm.** `license.deps` reads `package-lock.json` (v2 or v3) only; another
  ecosystem, or an old v1 lockfile, reads *not investigated* with the reason.

## Known to read wrong

- **CI other than GitHub's.** `ci.present` reads only `.github/workflows/`, so a repository on Azure Pipelines,
  GitLab CI, CircleCI or another reads `No CI` and `ci.tests` finds no test step. Tracked for the next release.
- **A clean secret check is not a promise.** The secret rules are a short list of well-known shapes
  ([CHECKS.md](CHECKS.md#the-secret-rules)): clean means none of them matched, not that there is no secret.
- **A kept rewrite is not a promise either.** The polish guard checks a list -- the fingerprint, paths,
  numbers, masked values and checkboxes ([POLISH.md](POLISH.md#the-guard)) -- and cannot see meaning. The
  prompt asks the model to add no specific and drop nothing, which it mostly does. A rewrite that turns "an
  address" into "an email address" can still be kept. The polish pass was run against the real API on
  2026-11-02: four of four cards were polished, and the guard kept all four.

## Not proven yet

- **npm on Windows.** There, `npm` is a `.cmd` shim that Node will not start without a shell, so Code Sleuth
  runs npm's own `npm-cli.js` under Node where it is found beside it. Where it is not, `deps.outdated` reads
  *not investigated*, and `deps.advisories` asks `gh` instead, or reads *not investigated* too. None of this
  has run on Windows yet: CI runs on Linux only, and Windows joins it in the next release.
- **Windows.** The suite has not run on Windows, and neither has the ToolKit hand-off. `handoff.ps1` is held
  free of syntax Windows PowerShell 5.1 cannot parse, but has not run under it, and a `Restricted` execution
  policy can stop it. Tracked for the next release, which proves Windows in CI.

## Slow on purpose

- **`secrets.history` on a long history.** It reads every line ever added, with `git log -p --all`. On a large
  repository the stakeout's dot for that check takes a while.
