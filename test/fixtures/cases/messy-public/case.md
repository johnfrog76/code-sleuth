# Case 2026-10-31-public-1

**NOT READY** -- The verdict: not ready to go public. One smoking gun, eight loose ends.

- Repo: messy (main @ 4999d78, clean)
- Goal: going public
- Counts: 1 smoking gun, 8 loose ends, 5 hunches, 7 clean, 3 not investigated.

## Smoking guns

- [ ] **Names on the deny list** (`names.deny`): A name from the deny list: it was supposed to stay private. First: `src/app.js:1`, and 1 more. [card](cards/01-remove-names-on-the-deny-list.md)

## Loose ends

- [ ] **Paths from somebody's machine** (`paths.machine`): A path from somebody's machine: it works there and nowhere else, and it names them. `scripts/build.sh:4`. [card](cards/02-replace-paths-from-a-developer-s-machine.md)
- [ ] **A contributing guide** (`docs.contributing`): No CONTRIBUTING: a stranger who wants to help has to guess how. [card](cards/03-add-a-contributing-guide.md)
- [ ] **A code of conduct** (`docs.conduct`): No CODE_OF_CONDUCT: nobody knows the house rules. [card](cards/04-add-a-code-of-conduct.md)
- [ ] **A security policy** (`docs.security`): No SECURITY.md: nobody knows where to report a problem quietly. [card](cards/05-add-a-security-policy.md)
- [ ] **Issue and pull request templates** (`github.templates`): No templates: the first issue a stranger files will be a blank page. First: `.github/ISSUE_TEMPLATE/`, and 1 more. [card](cards/06-add-issue-and-pull-request-templates.md)
- [ ] **Continuous integration** (`ci.present`): No CI: nothing runs when someone pushes or opens a pull request. `.github/workflows/triage.yml`. [card](cards/07-add-a-ci-workflow-that-runs-on-push-and-pull-request.md)
- [ ] **pull_request_target with the pull request's code** (`workflows.prtarget`): A pull_request_target workflow checks out the pull request: a stranger's code runs with this repository's secrets. `.github/workflows/triage.yml:7`. [card](cards/08-stop-pull-request-target-workflows-running-pull-request-code.md)
- [ ] **Untrusted input in a workflow's shell** (`workflows.injection`): A stranger's text lands straight in a shell line: a title or a branch name can run commands. `.github/workflows/triage.yml:10`. [card](cards/09-pass-untrusted-workflow-inputs-through-environment-variables.md)

## Hunches

- [ ] **Tests in CI** (`ci.tests`): CI never runs the tests: green doesn't mean much yet. `.github/workflows/triage.yml`.
- [ ] **Workflow token permissions** (`workflows.permissions`): A workflow that doesn't say what its token may do, so it gets the repository's default. `.github/workflows/triage.yml`.
- [ ] **A lockfile** (`deps.lockfile`): Dependencies without a lockfile: every install can pull in something different. `package.json`.
- [ ] **Automated dependency updates** (`deps.updates`): Nothing keeps the dependencies up to date: they'll go stale quietly.
- [ ] **Markers left in the code** (`quality.markers`): Notes-to-self left in the code: a stranger will read them as promises. `scripts/build.sh:2`.

## Clean

- [x] **Secrets in the working tree** (`secrets.tree`): No secrets in plain sight. None of my rules matched.
- [x] **Secrets in the history** (`secrets.history`): Nothing buried in the history either. None of my rules matched.
- [x] **Key files and .env files** (`files.sensitive`): No key files or .env in the tree.
- [x] **A license** (`license.file`): A license, and the manifest agrees with it.
- [x] **Large files** (`files.large`): No files heavy enough to drag on every clone.
- [x] **A README that says how to start** (`docs.readme`): A README that tells a stranger how to start.
- [x] **A changelog** (`docs.changelog`): A changelog. Somebody's keeping the record.

## Not investigated

- [ ] **Dependency licenses** (`license.deps`): Not investigated. There's a package.json and no package-lock.json: run npm install to make one, and commit it.
- [ ] **Known advisories in dependencies** (`deps.advisories`): Not investigated. This makes a call off the machine, and --offline is set.
- [ ] **Dependencies a major version behind** (`deps.outdated`): Not investigated. This needs npm on the PATH.

Polish: No model key in the environment: the cards are as the sleuth wrote them.

ToolKit: found (tk, Space 'widget'); filed 1 card in the Space 'widget' (Bug K7M2); 1 was already filed.
