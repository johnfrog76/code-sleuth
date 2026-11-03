# Task: Pass untrusted workflow inputs through environment variables

A stranger's text lands straight in a shell line: a title or a branch name can run commands.

**Evidence**
- `.github/workflows/triage.yml:10` -- `echo "Triaging ${{ github.event.pull_request.title }}"`

**What the books call it:** script injection

**The fix**
Move each expression into an env: entry on the step and use the variable in the shell, quoted ("$TITLE"), so the text is data and never code.

**Done when**
- [ ] `code-sleuth --goal public` reads `workflows.injection` as Clean.

Found by Code Sleuth: workflows.injection, case 2026-10-31-public-1, at 4999d78.
