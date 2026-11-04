# Known gaps

Where Code Sleuth stops today, so you know what to look at yourself: what is not built yet, what is known
to read wrong, and what has not been proven, with what you see when you hit each one.

## Not built yet

- **The security and quality goals.** `code-sleuth checks` lists them; a case for them is refused with
  `The security goal isn't ready to investigate yet: it is planned for a later release.` They hold too few checks
  today for a verdict to mean anything.
- **Advisory lookups beyond npm.** `deps.advisories` reads npm's lockfiles only. Another package manager's
  lockfile reads *not investigated*, with the reason. Another ecosystem's manifest (`requirements.txt`, `go.mod`
  and others) turns what would read clean into *not investigated*, naming the file; what the npm side finds
  still stands ([CHECKS.md](CHECKS.md#other-ecosystems)).
- **The ToolKit hand-off through ToolKit's agent.** Only the command-line path is built; the agent path comes
  with the office.
- **Dependency licenses beyond npm.** `license.deps` reads `package-lock.json` (v2 or v3) only. An old v1
  lockfile reads *not investigated*, naming it. Another ecosystem's manifest turns what would read clean into
  *not investigated*, naming the file; what the npm side finds still stands.
- **Issues and pull requests.** A public repository shows its tracker too ([CHECKS.md](CHECKS.md#public-facing-code)), and
  no check reads it yet: a secret or a name in an issue or a pull request comment is not looked for.
- **The example marker in three places.** A line carrying `code-sleuth:example` is not yet an example for
  `workflows.injection`, `workflows.prtarget`, or a `names.deny` match in a commit message: there it still
  counts ([CHECKS.md](CHECKS.md#example-locations)).

## Known to read wrong

- **CI other than GitHub's.** `ci.present` reads only `.github/workflows/`, so a repository on Azure Pipelines,
  GitLab CI, CircleCI or another reads `No CI` and `ci.tests` finds no test step. Tracked for a later release.
- **A clean secret check is not a promise.** The secret rules are a short list of well-known shapes
  ([CHECKS.md](CHECKS.md#the-secret-rules)): clean means none of them matched, not that there is no secret.
- **A kept rewrite is not a promise either.** The polish guard checks a list -- the fingerprint, paths,
  numbers, masked values and checkboxes ([POLISH.md](POLISH.md#the-guard)) -- and cannot see meaning. The
  prompt asks the model to add no specific and drop nothing, and nothing checks that it did. A rewrite that
  turns "an address" into "an email address" can still be kept. The maintainers ran the polish pass against the
  real API on 2026-11-02: four of four cards were polished, and the guard kept all four. That run's case files
  are not in the repository.

## Not proven yet

- **Commands named in a repository's git configuration.** Every git call that reads the repository turns off the file-system
  monitor, every filter driver (including one from an included config file, and one whose name holds an `=`),
  the signature program, hooks, the pager and an external diff, and never reads into a submodule, which has a
  config of its own. Other settings that name commands -- a credential helper, an SSH command, a proxy
  -- are used only when git talks to a remote, and Code Sleuth's git calls never do: every one turns off each
  transport by name (`protocol.<name>.allow=never` for git's own -- `file`, `git`, `ssh`, `http`, `https`, `ext`,
  `fd`, `ftp`, `ftps` -- and every `git-remote-<name>` helper in git's exec-path or on the PATH, set through
  git's own `GIT_CONFIG_KEY_<n>` variables, which outrank the repository's own config) and lazy fetching (`GIT_NO_LAZY_FETCH`), so a partial
  clone's missing objects stay missing, and `secrets.history` says the history was not read
  ([CHECKS.md](CHECKS.md#secretshistory-secrets-in-the-history)).

- **Programs found by their full path on Windows.** git, npm, gh and PowerShell are found in the PATH's absolute
  folders and started by their full path, so Windows never looks for one in the repository first. That
  defence is built, and its one test is skipped until Windows joins CI.
- **npm on Windows.** There, `npm` is a `.cmd` shim that Node will not start without a shell, so Code Sleuth
  runs npm's own `npm-cli.js` under Node where it is found beside it. Where it is not, `deps.outdated` reads
  *not investigated*, and `deps.advisories` asks `gh` instead, or reads *not investigated* too. None of this
  has run on Windows yet: CI runs on Linux only, and Windows CI is planned for a later release.
- **Windows.** The suite has not run on Windows, and neither has the ToolKit hand-off. A test holds `handoff.ps1`
  free of the newer syntax Windows PowerShell 5.1 cannot parse (`??`, `?.`, a ternary, `&&` and `||` chains,
  `-AsHashtable`), but it has not run under 5.1, and a `Restricted` execution
  policy can stop it. Tracked with the Windows CI.

## Slow on purpose

- **`secrets.history` on a long history.** It reads every line ever added, with `git log -p --all`. On a large
  repository the stakeout's dot for that check takes a while.
