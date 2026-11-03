# Task: Turn on automated dependency updates

Nothing keeps the dependencies up to date: they'll go stale quietly.

**What the books call it:** dependency management

**The fix**
Add a .github/dependabot.yml for each ecosystem in the repository (or a Renovate configuration), so updates arrive as pull requests.

**Done when**
- [ ] `code-sleuth --goal public` reads `deps.updates` as Clean.

Found by Code Sleuth: deps.updates, case 2026-10-31-public-1, at cf617d7.
