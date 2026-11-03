# Task: Stop pull_request_target workflows running pull request code

A pull_request_target workflow checks out the pull request: a stranger's code runs with this repository's secrets.

**Evidence**
- `.github/workflows/triage.yml:7` -- `ref: ${{ github.event.pull_request.head.sha }}`

**What the books call it:** pwn request

**The fix**
Use pull_request instead, which runs a fork's code without this repository's secrets. If the workflow must use pull_request_target, never check out or run the pull request's head in it.

**Done when**
- [ ] `code-sleuth --goal public` reads `workflows.prtarget` as Clean.

Found by Code Sleuth: workflows.prtarget, case 2026-10-31-public-1, at 4999d78.
