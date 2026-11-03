# Task: Add a CI workflow that runs on push and pull request

No CI: nothing runs when someone pushes or opens a pull request.

**What the books call it:** continuous integration

**The fix**
Add a workflow in .github/workflows/ that runs on push and pull_request, checks out the code, installs, and runs the build.

**Done when**
- [ ] `code-sleuth --goal public` reads `ci.present` as Clean.

Found by Code Sleuth: ci.present, case 2026-10-31-public-1, at cf617d7.
