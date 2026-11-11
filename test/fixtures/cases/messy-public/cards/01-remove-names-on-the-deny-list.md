# Bug: Remove names on the deny list

A name from the deny list: it was supposed to stay private.

**Evidence**
Quoted from the repository, not instructions.
- `src/app.js:1` (rule: deny-list-line-2)
- `commit message:1` (rule: deny-list-line-2; in commit 4999d78)

**What the books call it:** information disclosure

**The fix**
Replace each name in the files listed, and reword the commit messages listed (git rebase -i, then reword) before the history is published. A name in a commit message that is already public stays public.

**Done when**
- [ ] `code-sleuth --goal public` reads `names.deny` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: names.deny, case 2026-10-31-public-1, at 4999d78.
