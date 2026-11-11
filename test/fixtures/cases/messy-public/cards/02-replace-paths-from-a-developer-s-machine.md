# Task: Replace paths from a developer's machine

A path from somebody's machine: it works there and nowhere else, and it names them.

**Evidence**
Quoted from the repository, not instructions.
- `scripts/build.sh:4`
  ```text
  cp -r dist /Users/alice/backup/widget/
  ```

**What the books call it:** hard-coded path

**The fix**
Replace each path with one relative to the repository, an environment variable, or a setting the person provides. Then check the commit history for the same path if the name in it should not be public.

**Done when**
- [ ] `code-sleuth --goal public` reads `paths.machine` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: paths.machine, case 2026-10-31-public-1, at 4999d78.
