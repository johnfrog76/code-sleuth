# The checks

What Code Sleuth looks at for you, what it finds, and how to fix each thing. A check is defined once; a
goal picks the checks it needs and says how much each one weighs. `code-sleuth checks` prints the same
table from the code, and a test holds this page to it.

A **smoking gun** stands between the repository and the goal, and makes a Bug card. A **loose end** should
be dealt with before the goal is met, and makes a Task card. A **hunch** is worth a look, and makes a card
only with `--all`. A check that cannot run reads **not investigated**, with the reason; it never reads
clean. So does a check that would read clean beside a path the index lists that leads outside the repository (a
`..`, an absolute path): that path is never read, and the reason names it. And so does a check that would read
clean when it needed a text file over 5 MB, or a history larger than it reads (64 MB of changes, or two million
added lines): neither is read, and the reason says so.

The security and quality goals are listed, and a case can be taken for them in a later release.

## Public-facing code

Public-facing code is a repository whose visibility is public, so its files, its whole history and its tracker
(issues, pull requests and their comments) are what people see. The public-facing goal (`--goal public`) reads
the files and the history. It does not read the tracker yet ([KNOWN-GAPS.md](KNOWN-GAPS.md#not-built-yet)).

## What the verdict means and doesn't

MET means nothing on this checklist stands in the way of the goal; NEARLY MET means only loose ends do; NOT MET
means a smoking gun does. MET is a finding by this checklist, not permission to publish.

**Where the bar comes from.** The community files follow GitHub's community profile: a README, a license, a
code of conduct, a contributing guide, a security policy, and issue and pull request templates. The workflow,
dependency and CI checks follow OpenSSF Scorecard where Scorecard has a matching check. The secret, path and
deny-list checks look for what anyone could read in the files and the history once they are public.

**Your context moves it.** Who owns the code, what it is and who will read it can raise the bar or lower it.
A solo project may not need templates; an employer's repository may need a review this list knows nothing
about. Where a check can reasonably not apply, its entry below says so.

**What Code Sleuth doesn't judge:** legal and provenance questions (who may publish this code, and where it
came from), an employer's or a client's rules, trademarks and names beyond your deny list, the text in the
tracker, and the code itself, which is a review's job. A person decides those.

## What MET doesn't cover

MET tells you nothing on this list stands in your way. Your software may have requirements of its own, and
these are worth a look of your own before you go:

- **How it runs.** Code Sleuth reads files and history. It never builds, runs or tests the code, so how the
  software behaves when it runs is outside the list.
- **Settings on GitHub.** Branch protection, who can push, secret scanning, and the Actions and Pages settings
  live on GitHub, not in the files. Code Sleuth reads the files.
- **What the code means.** A rule finds a token, a path or a missing file. It doesn't review logic, so a flaw
  in what the code does is a review's job.
- **What dependencies do.** The dependency checks read names, versions, licenses and known advisories, for npm
  projects. What a dependency does when it installs or runs is not on the list.
- **Where Code Sleuth doesn't look yet.** The tracker, dependencies outside npm, and some rules in commit
  messages ([KNOWN-GAPS.md](KNOWN-GAPS.md)). A check that couldn't run says so under Not investigated, with its
  reason.
- **What already left the repository.** A secret that was ever pushed may sit in a fork, a clone or a cache.
  Taking it out of the history doesn't call it back: revoke it where it was issued.
- **People and content.** Who has access, and what the words, images and data in the repository say about
  people, are a person's call.
- **The snapshot.** A case is the repository at one commit, on one day. A new commit, or an advisory published
  tomorrow, can change it: run it again before you go.

## Weights

<!-- The rows below are held to the code by test/docs/checks.test.ts. -->

| Check | Public facing | Security | Quality |
| --- | --- | --- | --- |
| `secrets.tree` | smoking gun | smoking gun | -- |
| `secrets.history` | smoking gun | smoking gun | -- |
| `files.sensitive` | smoking gun | smoking gun | -- |
| `license.file` | smoking gun | -- | -- |
| `license.deps` | loose end | -- | -- |
| `paths.machine` | loose end | -- | -- |
| `names.deny` | smoking gun | -- | -- |
| `files.large` | loose end | -- | -- |
| `docs.readme` | loose end | -- | -- |
| `docs.contributing` | loose end | -- | -- |
| `docs.conduct` | loose end | -- | -- |
| `docs.security` | loose end | -- | -- |
| `docs.changelog` | hunch | -- | hunch |
| `github.templates` | loose end | -- | -- |
| `ci.present` | loose end | -- | -- |
| `ci.tests` | hunch | -- | -- |
| `workflows.permissions` | hunch | -- | -- |
| `workflows.prtarget` | loose end | -- | -- |
| `workflows.injection` | loose end | -- | -- |
| `deps.lockfile` | hunch | -- | -- |
| `deps.advisories` | smoking gun | smoking gun | -- |
| `deps.updates` | hunch | -- | -- |
| `deps.outdated` | loose end | -- | hunch |
| `quality.markers` | hunch | -- | -- |

## What each check does

Every check that reads a file's contents or the history skips anything under a `node_modules/`, `vendor/`,
`dist/` or `build/` folder. `files.sensitive` and `files.large` look at every tracked file,
those folders included, since a key file or a heavy file there is published too: their names and sizes, an
`.npmrc`'s contents, and the first bytes of a large file to tell binary from text.

A check that reads a `package.json` reads **not investigated** when that file isn't JSON it can read, naming it:
`deps.advisories`, `deps.outdated`, `deps.lockfile`, `license.deps`, `license.file`, `ci.tests` and
`deps.updates`, wherever their answer would depend on it.

### `secrets.tree`: Secrets in the working tree

- **Reads:** tracked text files (every file under the folder when it is not a repository)
- **Finds:** a match of the secret rules (below) in a line
- **Needs:** nothing
- **What the books call it:** hard-coded credential
- **The fix:** Revoke each secret where it was issued first: once it is committed, treat it as public. Then remove it from the file and read it from the environment instead.

### `secrets.history`: Secrets in the history

- **Reads:** every line added in `git log -p --all`, every file as text (a `-diff` or `binary` attribute, or the
  repository's own `core.bigFileThreshold`, hides nothing), and the lines added in resolving a merge, against
  its first parent
- **Finds:** the same rules over history: a secret removed from the tree but still in history is still a secret
- **Needs:** `git`. On a partial clone it reads **not investigated**: some of the history is not there, and
  Code Sleuth never fetches it. On a shallow clone too: the history before its cut is not there. And when git
  cannot read the history of a repository that has refs, it says so, rather than reading it as no history
- **What the books call it:** credential in version control history
- **The fix:** Revoke each secret where it was issued: anyone with a clone has the history. Then either rewrite the history to remove it (git filter-repo does this) and force-push, or accept that the old value is public.

### `files.sensitive`: Key files and .env files

- **Reads:** tracked file names, and `.npmrc` contents
- **Finds:** `.env` and `.env.*` (not `.env.example`), `*.pem`, `*.p12`, `*.key`, `*.keystore`, `id_rsa*` (not `*.pub`), an `.npmrc` with an `_authToken` that is not `${...}`
- **Needs:** nothing
- **What the books call it:** sensitive file exposure
- **The fix:** Revoke what each file holds. Remove it from git with git rm --cached, add its pattern to .gitignore, and keep an .env.example with the names and no values.

### `license.file`: A license

- **Reads:** `LICENSE*`, `LICENCE*`, `COPYING*` at the root (not code or data that starts so, such as
  `license-checker.json`), and `package.json` `license`
- **Finds:** no license file; or a manifest license that the file, identified by its text, contradicts
- **Needs:** nothing
- **Not investigated** when `package.json` states a license and the file's text is not one it can tell, so the two cannot be compared
- **What the books call it:** software license
- **The fix:** Add a LICENSE file at the root with the full text of the license you choose (MIT and Apache-2.0 are common for open source), and set the same SPDX id in package.json's license field.

### `license.deps`: Dependency licenses

- **Reads:** every `package-lock.json` (lockfile v2 or v3), each on its own
- **Finds:** a dependency under a strong copyleft license (GPL, AGPL, SSPL) in a project that is not, or with no license stated; development-only packages are not read. An SPDX expression is read with its grouping: `GPL-3.0 AND (MIT OR Apache-2.0)` binds to the GPL
- **Needs:** nothing
- **Not investigated** with a `package.json` and no lockfile, or another ecosystem's manifest ([other ecosystems](#other-ecosystems)); and, when nothing is found, with a lockfile it cannot read or an old v1 one, naming it. A finding in one lockfile stands whatever another holds, and a lockfile in an example location is left out
- **What the books call it:** license compliance
- **The fix:** For each dependency listed, check its license in its own repository. Replace a strong copyleft dependency, or relicense the project to match it; ask the author of one with no license to add one, or replace it.

### `paths.machine`: Paths from somebody's machine

- **Reads:** tracked text files
- **Finds:** a home folder with a name in it: `/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\`
- **Needs:** nothing
- **What the books call it:** hard-coded path
- **The fix:** Replace each path with one relative to the repository, an environment variable, or a setting the person provides. Then check the commit history for the same path if the name in it should not be public.

### `names.deny`: Names on the deny list

- **Reads:** tracked text files and every commit message, against `--deny <file>`
- **Finds:** any name on the deny list (each line that is not blank or a `#` comment), whole-word, ignoring case; the finding names the list line, never the word
- **Needs:** `denyList`. Outside git, with nothing in the files, it reads **not investigated**: the commit messages
  were not read. On a shallow clone, with nothing found, it reads not investigated too: the messages before its
  cut were not read
- **What the books call it:** information disclosure
- **The fix:** Replace each name in the files listed, and reword the commit messages listed (git rebase -i, then reword) before the history is published. A name in a commit message that is already public stays public.

### `files.large`: Large files

- **Reads:** tracked files
- **Finds:** a file over 5 MB, or a binary over 1 MB that is not an image or a font
- **Needs:** nothing
- **What the books call it:** repository bloat
- **The fix:** Remove each file from the repository and keep it where large files belong: Git LFS, a release asset, or a package. If it is in the history too, rewrite the history before the repository is public facing, or every clone keeps it.

### `docs.readme`: A README that says how to start

- **Reads:** `README*` at the root
- **Finds:** absent, under 10 lines, or no heading that reads as install, usage, quick start, getting started, set up or run
- **Needs:** nothing
- **What the books call it:** README
- **The fix:** Say what the project is in its first lines, then add an Install or Quick start section with the commands a stranger runs first, and a Usage section with one example.

### `docs.contributing`: A contributing guide

- **Reads:** `CONTRIBUTING*` at the root, in `.github/` or `docs/`
- **Finds:** absent
- **Needs:** nothing
- **What the books call it:** contribution guidelines
- **May not apply:** to a solo project that takes no contributions; its README can say so instead.
- **The fix:** Add a CONTRIBUTING.md at the root, in .github/ or in docs/: how to set up, how to run the tests, and what a good issue and pull request look like.

### `docs.conduct`: A code of conduct

- **Reads:** `CODE_OF_CONDUCT*`, the same places
- **Finds:** absent
- **Needs:** nothing
- **What the books call it:** code of conduct
- **May not apply:** to a project that takes no contributions and has no community space.
- **The fix:** Add a CODE_OF_CONDUCT.md at the root, in .github/ or in docs/. The Contributor Covenant is a common start; say in it who to contact about a problem.

### `docs.security`: A security policy

- **Reads:** `SECURITY*`, the same places
- **Finds:** absent
- **Needs:** nothing
- **What the books call it:** vulnerability disclosure policy
- **The fix:** Add a SECURITY.md at the root, in .github/ or in docs/: which versions get fixes, and how to report a vulnerability privately (GitHub's private vulnerability reporting, or an address).

### `docs.changelog`: A changelog

- **Reads:** `CHANGELOG*` at the root
- **Finds:** absent
- **Needs:** nothing
- **What the books call it:** changelog
- **May not apply:** to a project with no releases, or one that keeps its record in release notes.
- **The fix:** Add a CHANGELOG.md at the root, with one line per change a user would notice, newest first.

### `github.templates`: Issue and pull request templates

- **Reads:** `.github/ISSUE_TEMPLATE/` (or `ISSUE_TEMPLATE.md`), a pull request template at the root, in `.github/` or `docs/`
- **Finds:** either absent
- **Needs:** nothing
- **What the books call it:** issue templates
- **May not apply:** to a solo project, or one that takes no issues.
- **The fix:** Add .github/ISSUE_TEMPLATE/ with a bug report and a feature request, and a .github/pull_request_template.md that asks what changed, why, and how it was tested.

### `ci.present`: Continuous integration

- **Reads:** `.github/workflows/*.yml`
- **Finds:** no workflow that runs on `push` or `pull_request`
- **Needs:** nothing
- **Not investigated** when none is found and a workflow doesn't parse as YAML, naming it: it may be the one
- **What the books call it:** continuous integration
- **May not apply:** to a repository with nothing to build or test, such as notes or a sample.
- **The fix:** Add a workflow in .github/workflows/ that runs on push and pull_request, checks out the code, installs, and runs the build.

### `ci.tests`: Tests in CI

- **Reads:** the workflows' `run:` steps and `package.json` `scripts.test`
- **Finds:** no step that runs the tests (`npm test`, `pytest`, `go test`, the test script itself, ...)
- **Needs:** nothing
- **Not investigated** when none is found and a workflow doesn't parse as YAML, naming it, or when
  `package.json` can't be read
- **What the books call it:** automated testing
- **The fix:** Add a step to the CI workflow that runs the project's tests (npm test, pytest, or whatever runs them here), so a pull request that breaks them shows red.

### `workflows.permissions`: Workflow token permissions

- **Reads:** each workflow
- **Finds:** no top-level `permissions:` block
- **Needs:** nothing
- **Not investigated** when a workflow doesn't parse as YAML and nothing else is found, naming the workflow
- **What the books call it:** least privilege
- **The fix:** Add `permissions: contents: read` at the top of each workflow listed, and grant more only in the job that needs it.

### `workflows.prtarget`: pull_request_target with the pull request's code

- **Reads:** each workflow
- **Finds:** `pull_request_target` together with a checkout of the pull request's head or its merge commit
  (`head.sha`, `head.ref`, `merge_commit_sha`, `refs/pull/`)
- **Needs:** nothing
- **Not investigated** when a workflow doesn't parse as YAML and nothing else is found, naming the workflow; or
  when a line of a `run:` is longer than 65,536 characters, which it skips, naming the line
- **What the books call it:** pwn request
- **The fix:** Use pull_request instead, which runs a fork's code without this repository's secrets. If the workflow must use pull_request_target, never check out or run the pull request's head in it.

### `workflows.injection`: Untrusted input in a workflow's shell

- **Reads:** each workflow's `run:` lines
- **Finds:** a `${{ github.event.* }}` field a stranger writes (titles, bodies, branch names, commit messages) placed straight in a shell line, in dotted or index syntax (`github.event['issue']['title']`)
- **Needs:** nothing
- **Not investigated** when a workflow doesn't parse as YAML and nothing else is found, naming the workflow; or
  when a `run:` line is longer than 65,536 characters, which it skips, naming the line
- **What the books call it:** script injection
- **The fix:** Move each expression into an env: entry on the step and use the variable in the shell, quoted ("$TITLE"), so the text is data and never code.

### `deps.lockfile`: A lockfile

- **Reads:** every `package.json` with dependencies
- **Finds:** no lockfile beside it, or above it in a workspace
- **Needs:** nothing
- **What the books call it:** dependency pinning
- **The fix:** Run npm install (or your package manager's install) beside each package.json listed and commit the lockfile it writes.

### `deps.advisories`: Known advisories in dependencies

- **Reads:** every package and version in `package-lock.json` (or `npm-shrinkwrap.json`), through
  `npm audit --json` when npm is found, else through GitHub's advisory database with `gh api /advisories`
- **Finds:** a locked package with a known advisory against its version. The evidence lists each package and version once,
  at its heaviest advisory, with the line it sits on in the lockfile. A package that is only vulnerable
  through another is not listed again
- **Weighs:** by severity. Critical or high keeps the goal's weight; moderate is one step down, low or info two.
  The heaviest piece of evidence decides, and each lighter one says why on its card
- **Needs:** `network`, and npm or `gh`. With both, npm is asked. Whether `gh` is signed in is not asked ahead,
  since that would call GitHub: a `gh` that is not reads not investigated with the reason
- **Sends:** through `npm audit`, what it always sends to npm's configured registry: the lockfile's
  dependency tree, the package names and versions in it. Through `gh`, the package names and versions, to
  GitHub, in batches of fifty. Nothing else from the files, and never the repository's path. npm runs on a copy of
  `package.json` and the lockfile in Code Sleuth's own folder, so the repository's `.npmrc` is never read; your
  own npm settings, your auth among them, still apply. `--offline` turns it off, and the run's header names it before it
  runs
- **Reads clean** with no `package.json` at the root, or none with dependencies, and no other ecosystem's manifest and
  no npm project below the root, and makes
  no call (with `--offline`, it reads not investigated even then). **Not investigated** with an npm project
  below the root (it reads the root's alone so far, and names the other), with no npm lockfile, with another package manager's lockfile, with `--offline`,
  with neither tool, or with another ecosystem's manifest ([other ecosystems](#other-ecosystems))
- **What the books call it:** known vulnerable component
- **The fix:** Update each package listed to a version with the fix (`npm audit fix` does what it safely can), or replace it. A package deep in the tree is fixed by updating the dependency that pulls it in.

### `deps.updates`: Automated dependency updates

- **Reads:** `.github/dependabot.yml`, Renovate configs, `package.json` `renovate`
- **Finds:** none of them
- **Needs:** nothing
- **What the books call it:** dependency management
- **May not apply:** to an archived or one-off repository that will not be maintained.
- **The fix:** Add a .github/dependabot.yml for each ecosystem in the repository (or a Renovate configuration), so updates arrive as pull requests.

### `deps.outdated`: Dependencies a major version behind

- **Reads:** `package.json`'s direct dependencies and devDependencies, their installed versions in
  `package-lock.json`, and their latest versions from `npm outdated --json --long`
- **Finds:** a direct dependency a major version or more behind its latest (for a `0.x` version, a minor
  counts, as npm's caret does). The evidence lists each one; the check counts once
- **Needs:** `npm`, `network`
- **Sends:** package names, read from `package.json`, to npm's configured registry, the one `npm outdated` asks.
  Nothing else from the files, and never the repository's path. npm runs in Code Sleuth's own folder, on a
  `package.json` that names each direct dependency from npm's registry at `*` and nothing else, so no spec from
  the repository reaches npm and the repository's `.npmrc` is never read; the installed versions come from the
  lockfile, on the machine. A dependency from anywhere else -- git (`git+ssh:`, `github:`, `user/repo`), a path
  (`file:`, `link:`, `workspace:`, a tarball), a URL, or an `npm:` alias -- is never looked up, and is named. It leaves your own npm
  registry settings (your `.npmrc`, a scoped or private registry) alone; it overrides only where npm keeps its cache and logs, and turns off npm's update and funding notices. `--offline` turns it off, and the run's header names it before it runs
- **Reads clean** with no `package.json` at the root, or none of its dependencies, and no other ecosystem's manifest
  and no npm project below the root, and
  makes no call, when npm is found and the run is not `--offline`; **not investigated** with an npm project
  below the root, named, when `npm outdated` exits 1 with nothing printed, with no lockfile, a lockfile from another package manager, no npm,
  a dependency from a source other than npm's registry and none of the others behind (each one named),
  `--offline`, or another ecosystem's manifest ([other ecosystems](#other-ecosystems))
- **What the books call it:** outdated dependency
- **The fix:** For each dependency listed, read its changelog for the breaking changes between your version and the latest, update it, and run the tests. npm outdated lists them all.

### `quality.markers`: Markers left in the code

- **Reads:** tracked source files (not prose, not lockfiles)
- **Finds:** `TODO`, `FIXME`, `HACK` or `XXX` in a comment
- **Needs:** nothing
- **What the books call it:** technical debt markers
- **The fix:** For each marker, do the work, delete the note, or file it as an issue and leave the issue's link in its place.

## Other ecosystems

The dependency checks (`deps.advisories`, `deps.outdated` and `license.deps`) read npm projects so far. A
manifest of another ecosystem -- `requirements.txt`, `pyproject.toml` or `Pipfile` (Python), `go.mod` (Go),
`Cargo.toml` (Rust), `Gemfile` (Ruby), `pom.xml` or `build.gradle` (Java), `composer.json` (PHP) -- makes a
check that would read clean read **not investigated** instead, naming the file. Beside an npm project, the npm
side is still checked: what it finds stands, and a clean npm side says the other side was not read. With no
manifest of any of these, there is nothing to check, and the checks read clean, unless one cannot run (with `--offline`, or with no npm
for `deps.outdated`).

## A guess from a name

The `assigned-secret` rule (a long, random-looking value assigned to a name with `secret`, `token`,
`password`, `passwd`, `api_key`, `access_key`, `private_key` or `auth_key` in it, the underscore optional) is a guess, so it weighs one step down: a smoking gun becomes a loose end. The case says which
evidence was weighed down, and why.

## Example locations

A repository that tests a scanner keeps deliberate bait in its fixtures: a fake token, a home-folder path, a
`TODO`. A match in an example location is **shown and never counted**: it makes no card, even with `--all`,
and never changes the verdict. A real match elsewhere still counts.

The example locations are:

- a path under a `test/fixtures/` or `__fixtures__/` folder, at any depth, for every check;
- a line carrying `code-sleuth:example`, for the secret checks, `paths.machine`, `files.sensitive`,
  `quality.markers`, and `names.deny` in files (not yet `workflows.injection`, `workflows.prtarget`, or a commit
  message);
- a path matching any `--examples <glob>` given on the run ([CLI.md](CLI.md#flags)).

A check whose only matches were examples reads **Clean**, with its own line saying so:
`[x] paths.machine  Clean, apart from 3 matches in example locations, not counted.` A check with real matches
too stays found, on its real evidence, and says how many more were examples. Below the checklist, the case adds one line:
`N matches in example locations were not counted; check that they are fake.` A real key committed into a
fixture is still a real leak: the case stops counting it, but never hides it. `case.json` keeps every example
match, with its path and line, and records the example locations in force ([CASE-FILE.md](CASE-FILE.md)).

## The secret rules

Private key headers, AWS access key ids, GitHub tokens (`ghp_`, `gho_`, `ghs_`, `ghu_`, `ghr_`,
`github_pat_`), npm tokens, Slack tokens and incoming webhooks, Teams incoming webhooks, Anthropic API keys
(`sk-ant-`), OpenAI project keys (`sk-proj-`), Stripe live keys (`sk_live_`, `rk_live_`), Google API
keys, and the name guess above. A bare `sk-` has no rule: it matches hashes and base64.

**A clean secret check means none of these rules matched, not that there is no secret.** The rules are a
short list of well-known shapes. A value is never stored or printed: it is shown as its first four and last
two characters (`ghp_****9f`), and the case keeps a keyed hash of it so two runs can tell it is the same.
