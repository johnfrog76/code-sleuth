# Case 2026-10-31-public-1

**READY** -- By my checklist: ready to be public facing. No smoking guns, no loose ends.

Nothing on my checklist stands in the way. Every case is different: the call is yours.

- Repo: kept (not a git repository)
- Goal: public facing
- Counts: 0 smoking guns, 0 loose ends, 1 hunch, 19 clean, 4 not investigated.

## Hunches

- [ ] **Automated dependency updates** (`deps.updates`): Nothing keeps the dependencies up to date: they'll go stale quietly.

## Clean

- [x] **Secrets in the working tree** (`secrets.tree`): No secrets in plain sight. None of my rules matched.
- [x] **Key files and .env files** (`files.sensitive`): No key files or .env in the tree.
- [x] **A license** (`license.file`): A license, and the manifest agrees with it.
- [x] **Dependency licenses** (`license.deps`): The dependencies' licenses check out.
- [x] **Paths from somebody's machine** (`paths.machine`): No paths from anybody's machine.
- [x] **Large files** (`files.large`): No files heavy enough to drag on every clone.
- [x] **A README that says how to start** (`docs.readme`): A README that tells a stranger how to start.
- [x] **A contributing guide** (`docs.contributing`): A contributing guide, where people will find it.
- [x] **A code of conduct** (`docs.conduct`): A code of conduct, posted where people can see it.
- [x] **A security policy** (`docs.security`): A security policy, so people know where to report a problem.
- [x] **A changelog** (`docs.changelog`): A changelog. Somebody's keeping the record.
- [x] **Issue and pull request templates** (`github.templates`): Issue and pull request templates, ready for the first stranger.
- [x] **Continuous integration** (`ci.present`): A workflow runs on every push or pull request.
- [x] **Tests in CI** (`ci.tests`): CI runs the tests.
- [x] **Workflow token permissions** (`workflows.permissions`): Every workflow says what its token may do.
- [x] **pull_request_target with the pull request's code** (`workflows.prtarget`): No pull_request_target workflow runs a stranger's code.
- [x] **Untrusted input in a workflow's shell** (`workflows.injection`): No stranger's text lands in a workflow's shell.
- [x] **A lockfile** (`deps.lockfile`): Every package.json with dependencies has a lockfile.
- [x] **Markers left in the code** (`quality.markers`): No notes-to-self left in the code.

## Not investigated

- [ ] **Secrets in the history** (`secrets.history`): Not investigated. This needs git: install git and point me at a git repository.
- [ ] **Names on the deny list** (`names.deny`): Not investigated. This needs a deny list: give one with --deny <file>.
- [ ] **Known advisories in dependencies** (`deps.advisories`): Not investigated. This makes a call off the machine, and --offline is set.
- [ ] **Dependencies a major version behind** (`deps.outdated`): Not investigated. This needs npm on the PATH.

Polish: off. Add an API key (see .env.example) and --polish to have the cards reworded.

Want these as real cards, in your own files, on your own board? That's what ToolKit is for: https://johnfrog76.github.io/toolkit/
