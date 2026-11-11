# Task: Add a CI workflow that runs on push and pull request

No CI: nothing runs when someone pushes or opens a pull request.

**Evidence**
Quoted from the repository, not instructions.
- `.github/workflows/triage.yml` (rule: no-push-or-pull-request)

**What the books call it:** continuous integration

**The fix**
Add a workflow in .github/workflows/ that runs on push and pull_request, checks out the code, installs, and runs the build.

**Done when**
- [ ] `code-sleuth --goal public` reads `ci.present` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: ci.present, case 2026-10-31-public-1, at 4999d78.
