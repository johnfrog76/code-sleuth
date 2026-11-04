# Case 2026-10-31-public-1

**NOT READY** -- By my checklist: not ready to go public. One smoking gun, six loose ends.

- Repo: bare (main @ cf617d7, clean)
- Goal: going public
- Counts: 1 smoking gun, 6 loose ends, 3 hunches, 11 clean, 3 not investigated.

## Smoking guns

- [ ] **A license** (`license.file`): No license, or one the manifest contradicts: nobody can tell what they're allowed to do with this code. [card](cards/01-add-a-license-and-make-the-manifest-agree-with-it.md)

## Loose ends

- [ ] **A README that says how to start** (`docs.readme`): The README doesn't tell a stranger how to start. `README.md`. [card](cards/02-write-a-readme-that-says-how-to-install-and-use-the-project.md)
- [ ] **A contributing guide** (`docs.contributing`): No CONTRIBUTING: a stranger who wants to help has to guess how. [card](cards/03-add-a-contributing-guide.md)
- [ ] **A code of conduct** (`docs.conduct`): No CODE_OF_CONDUCT: nobody knows the house rules. [card](cards/04-add-a-code-of-conduct.md)
- [ ] **A security policy** (`docs.security`): No SECURITY.md: nobody knows where to report a problem quietly. [card](cards/05-add-a-security-policy.md)
- [ ] **Issue and pull request templates** (`github.templates`): No templates: the first issue a stranger files will be a blank page. First: `.github/ISSUE_TEMPLATE/`, and 1 more. [card](cards/06-add-issue-and-pull-request-templates.md)
- [ ] **Continuous integration** (`ci.present`): No CI: nothing runs when someone pushes or opens a pull request. [card](cards/07-add-a-ci-workflow-that-runs-on-push-and-pull-request.md)

## Hunches

- [ ] **A changelog** (`docs.changelog`): No CHANGELOG: nobody can tell what changed between versions. [card](cards/08-add-a-changelog.md)
- [ ] **Tests in CI** (`ci.tests`): CI never runs the tests: green doesn't mean much yet. [card](cards/09-run-the-tests-in-ci.md)
- [ ] **Automated dependency updates** (`deps.updates`): Nothing keeps the dependencies up to date: they'll go stale quietly. [card](cards/10-turn-on-automated-dependency-updates.md)

## Clean

- [x] **Secrets in the working tree** (`secrets.tree`): No secrets in plain sight. None of my rules matched.
- [x] **Secrets in the history** (`secrets.history`): Nothing buried in the history either. None of my rules matched.
- [x] **Key files and .env files** (`files.sensitive`): No key files or .env in the tree.
- [x] **Dependency licenses** (`license.deps`): The dependencies' licenses check out.
- [x] **Paths from somebody's machine** (`paths.machine`): No paths from anybody's machine.
- [x] **Large files** (`files.large`): No files heavy enough to drag on every clone.
- [x] **Workflow token permissions** (`workflows.permissions`): Every workflow says what its token may do.
- [x] **pull_request_target with the pull request's code** (`workflows.prtarget`): No pull_request_target workflow runs a stranger's code.
- [x] **Untrusted input in a workflow's shell** (`workflows.injection`): No stranger's text lands in a workflow's shell.
- [x] **A lockfile** (`deps.lockfile`): Every package.json with dependencies has a lockfile.
- [x] **Markers left in the code** (`quality.markers`): No notes-to-self left in the code.

## Not investigated

- [ ] **Names on the deny list** (`names.deny`): Not investigated. This needs a deny list: give one with --deny <file>.
- [ ] **Known advisories in dependencies** (`deps.advisories`): Not investigated. This makes a call off the machine, and --offline is set.
- [ ] **Dependencies a major version behind** (`deps.outdated`): Not investigated. This needs npm on the PATH.
