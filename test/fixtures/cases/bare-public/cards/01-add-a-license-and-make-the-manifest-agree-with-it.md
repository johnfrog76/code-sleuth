# Bug: Add a license, and make the manifest agree with it

No license, or one the manifest contradicts: nobody can tell what they're allowed to do with this code.

**What the books call it:** software license

**The fix**
Add a LICENSE file at the root with the full text of the license you choose (MIT and Apache-2.0 are common for open source), and set the same SPDX id in package.json's license field.

**Done when**
- [ ] `code-sleuth --goal public` reads `license.file` as Clean.

Found by Code Sleuth: license.file, case 2026-10-31-public-1, at cf617d7.
