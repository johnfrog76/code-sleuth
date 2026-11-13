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
- **A very large file or history.** A text file over 5 MB is not read by the text checks, and a history over 64 MB
  of changes or two million added lines is not read by `secrets.history`: each reads *not investigated*, with
  the reason, rather than ask more memory than a laptop has. Reading them in pieces is planned.

## Known to read wrong

- **One finding in Code Sleuth's own history is accepted, on purpose.** An early commit's test holds a made-up
  value, `secret-value-456`, assigned to a secret-sounding name, and Code Sleuth's run on its own repository
  shows it under `secrets.history`. It is test data, not a secret, and it stays in the history rather than have
  the history rewritten. A test holds that finding to that one commit, so any other secret still fails it. A way
  to mark a finding as accepted, so a case counts it apart, is planned.

- **CI other than GitHub's.** `ci.present` reads only `.github/workflows/`, so a repository on Azure Pipelines,
  GitLab CI, CircleCI or another reads `No CI` and `ci.tests` finds no test step. Tracked for a later release.
- **A clean secret check is not a promise.** The secret rules are a short list of well-known shapes
  ([CHECKS.md](CHECKS.md#the-secret-rules)): clean means none of them matched, not that there is no secret.
- **A kept rewrite is not a promise either.** The polish guard checks a list -- the fingerprint, paths,
  code spans, numbers, masked values, checkboxes, links, brackets and HTML, new characters and length
  ([POLISH.md](POLISH.md#the-guard)) -- and cannot see meaning: a short sentence that tells the reader, or an
  agent, to do something new passes it. The
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
- **A ToolKit that runs a native program under Stop, on Windows PowerShell 5.1.** A program ToolKit runs (git)
  can write to stderr on the way to a card it files. `handoff.ps1` reads the verb's error stream to tell a
  failure from that, and sets its own scope to `Continue`. But under 5.1 a native program's stderr in a
  redirected call is an error record, and inside a ToolKit script that sets `$ErrorActionPreference` to `Stop`
  it throws: the card is made, the hand-off reads it as failed, and the next run files it again. Unproven until
  the hand-off runs under 5.1.
- **Windows.** The suite has not run on Windows, and neither has the ToolKit hand-off. A test holds `handoff.ps1`
  free of the newer syntax Windows PowerShell 5.1 cannot parse (`??`, `?.`, a ternary, `&&` and `||` chains,
  `-AsHashtable`), but it has not filed a card under 5.1 yet. A `Restricted` or `AllSigned` execution policy is
  read and named, and CI proves that on Windows ([TOOLKIT.md](TOOLKIT.md#the-execution-policy-on-windows)). Each card's values reach it as `-Title:<value>`, one token each, which 5.1 is documented
  to bind the same way; unproven there too. Tracked with the Windows CI.

## Slow on purpose

- **`secrets.history` on a long history.** It reads every line ever added, with `git log -p --all`. On a large
  repository the stakeout's dot for that check takes a while.
