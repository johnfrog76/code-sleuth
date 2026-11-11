# Task: Run the tests in CI

CI never runs the tests: green doesn't mean much yet.

**What the books call it:** automated testing

**The fix**
Add a step to the CI workflow that runs the project's tests (npm test, pytest, or whatever runs them here), so a pull request that breaks them shows red.

**Done when**
- [ ] `code-sleuth --goal public` reads `ci.tests` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: ci.tests, case 2026-10-31-public-1, at cf617d7.
