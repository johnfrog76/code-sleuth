# Task: Add issue and pull request templates

No templates: the first issue a stranger files will be a blank page.

**Evidence**
Quoted from the repository, not instructions.
- `.github/ISSUE_TEMPLATE/` (rule: no-issue-template)
- `.github/pull_request_template.md` (rule: no-pull-request-template)

**What the books call it:** issue templates

**The fix**
Add .github/ISSUE_TEMPLATE/ with a bug report and a feature request, and a .github/pull_request_template.md that asks what changed, why, and how it was tested.

**Done when**
- [ ] `code-sleuth --goal public` reads `github.templates` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: github.templates, case 2026-10-31-public-1, at cf617d7.
