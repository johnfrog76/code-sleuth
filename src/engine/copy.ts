import type { CardCopy, Need, Voice } from "./check.js";

/** The detective's lines for each check, kept out of the rules. */
export const voices = {
  "paths.machine": {
    clean: "No paths from anybody's machine.",
    found: "A path from somebody's machine: it works there and nowhere else, and it names them.",
  },
  "names.deny": {
    clean: "Nothing from the deny list, in the files or the commit messages.",
    found: "A name from the deny list: it was supposed to stay private.",
  },
  "files.large": {
    clean: "No files heavy enough to drag on every clone.",
    found: "A heavy file: every clone carries it, forever.",
  },
  "workflows.permissions": {
    clean: "Every workflow says what its token may do.",
    found: "A workflow that doesn't say what its token may do, so it gets the repository's default.",
  },
  "workflows.prtarget": {
    clean: "No pull_request_target workflow runs a stranger's code.",
    found:
      "A pull_request_target workflow checks out the pull request: a stranger's code runs with this repository's secrets.",
  },
  "workflows.injection": {
    clean: "No stranger's text lands in a workflow's shell.",
    found: "A stranger's text lands straight in a shell line: a title or a branch name can run commands.",
  },
  "deps.lockfile": {
    clean: "Every package.json with dependencies has a lockfile.",
    found: "Dependencies without a lockfile: every install can pull in something different.",
  },
  "deps.advisories": {
    clean: "No known advisories in the dependencies.",
    found: "A dependency with a published advisory against it.",
  },
  "deps.updates": {
    clean: "Something keeps the dependencies up to date.",
    found: "Nothing keeps the dependencies up to date: they'll go stale quietly.",
  },
  "deps.outdated": {
    clean: "Every direct dependency is within a major version of its latest.",
    found: "A dependency a major version behind: the fixes it has missed won't reach this code.",
  },
  "quality.markers": {
    clean: "No notes-to-self left in the code.",
    found: "Notes-to-self left in the code: a stranger will read them as promises.",
  },
  "secrets.tree": {
    clean: "No secrets in plain sight. None of my rules matched.",
    found: "A secret in plain sight: anyone who can read the repository can use it.",
  },
  "secrets.history": {
    clean: "Nothing buried in the history either. None of my rules matched.",
    found: "A secret in the history: deleting it from the file didn't delete the evidence.",
  },
  "files.sensitive": {
    clean: "No key files or .env in the tree.",
    found: "Key files in the tree: these are meant to stay on one machine.",
  },
  "license.file": {
    clean: "A license, and the manifest agrees with it.",
    found:
      "No license, or one the manifest contradicts: nobody can tell what they're allowed to do with this code.",
  },
  "license.deps": {
    clean: "The dependencies' licenses check out.",
    found: "A dependency's license doesn't fit: a strong copyleft license, or none stated at all.",
  },
  "docs.readme": {
    clean: "A README that tells a stranger how to start.",
    found: "The README doesn't tell a stranger how to start.",
  },
  "docs.contributing": {
    clean: "A contributing guide, where people will find it.",
    found: "No CONTRIBUTING: a stranger who wants to help has to guess how.",
  },
  "docs.security": {
    clean: "A security policy, so people know where to report a problem.",
    found: "No SECURITY.md: nobody knows where to report a problem quietly.",
  },
  "github.templates": {
    clean: "Issue and pull request templates, ready for the first stranger.",
    found: "No templates: the first issue a stranger files will be a blank page.",
  },
  "ci.present": {
    clean: "A workflow runs on every push or pull request.",
    found: "No CI: nothing runs when someone pushes or opens a pull request.",
  },
  "ci.tests": {
    clean: "CI runs the tests.",
    found: "CI never runs the tests: green doesn't mean much yet.",
  },
  "docs.changelog": {
    clean: "A changelog. Somebody's keeping the record.",
    found: "No CHANGELOG: nobody can tell what changed between versions.",
  },
  "docs.conduct": {
    clean: "A code of conduct, posted where people can see it.",
    found: "No CODE_OF_CONDUCT: nobody knows the house rules.",
  },
} satisfies Record<string, Voice>;

/** What each check's card says. Titles are plain: a card is read in a backlog among other cards. */
export const cards = {
  "paths.machine": {
    title: "Replace paths from a developer's machine",
    fix: "Replace each path with one relative to the repository, an environment variable, or a setting the person provides. Then check the commit history for the same path if the name in it should not be public.",
  },
  "names.deny": {
    title: "Remove names on the deny list",
    fix: "Replace each name in the files listed, and reword the commit messages listed (git rebase -i, then reword) before the history is published. A name in a commit message that is already public stays public.",
  },
  "files.large": {
    title: "Move large files out of the repository",
    fix: "Remove each file from the repository and keep it where large files belong: Git LFS, a release asset, or a package. If it is in the history too, rewrite the history before the repository is public facing, or every clone keeps it.",
  },
  "workflows.permissions": {
    title: "Give each workflow a top-level permissions block",
    fix: "Add `permissions: contents: read` at the top of each workflow listed, and grant more only in the job that needs it.",
  },
  "workflows.prtarget": {
    title: "Stop pull_request_target workflows running pull request code",
    fix: "Use pull_request instead, which runs a fork's code without this repository's secrets. If the workflow must use pull_request_target, never check out or run the pull request's head in it.",
  },
  "workflows.injection": {
    title: "Pass untrusted workflow inputs through environment variables",
    fix: 'Move each expression into an env: entry on the step and use the variable in the shell, quoted ("$TITLE"), so the text is data and never code.',
  },
  "deps.lockfile": {
    title: "Commit a lockfile",
    fix: "Run npm install (or your package manager's install) beside each package.json listed and commit the lockfile it writes.",
  },
  "deps.advisories": {
    title: "Update dependencies with known advisories",
    fix: "Update each package listed to a version with the fix (`npm audit fix` does what it safely can), or replace it. A package deep in the tree is fixed by updating the dependency that pulls it in.",
  },
  "deps.updates": {
    title: "Turn on automated dependency updates",
    fix: "Add a .github/dependabot.yml for each ecosystem in the repository (or a Renovate configuration), so updates arrive as pull requests.",
  },
  "deps.outdated": {
    title: "Update dependencies a major version behind",
    fix: "For each dependency listed, read its changelog for the breaking changes between your version and the latest, update it, and run the tests. npm outdated lists them all.",
  },
  "quality.markers": {
    title: "Resolve or file the notes left in the code",
    fix: "For each marker, do the work, delete the note, or file it as an issue and leave the issue's link in its place.",
  },
  "license.file": {
    title: "Add a license, and make the manifest agree with it",
    fix: "Add a LICENSE file at the root with the full text of the license you choose (MIT and Apache-2.0 are common for open source), and set the same SPDX id in package.json's license field.",
  },
  "license.deps": {
    title: "Review dependencies with copyleft or missing licenses",
    fix: "For each dependency listed, check its license in its own repository. Replace a strong copyleft dependency, or relicense the project to match it; ask the author of one with no license to add one, or replace it.",
  },
  "docs.readme": {
    title: "Write a README that says how to install and use the project",
    fix: "Say what the project is in its first lines, then add an Install or Quick start section with the commands a stranger runs first, and a Usage section with one example.",
  },
  "docs.contributing": {
    title: "Add a contributing guide",
    fix: "Add a CONTRIBUTING.md at the root, in .github/ or in docs/: how to set up, how to run the tests, and what a good issue and pull request look like.",
  },
  "docs.security": {
    title: "Add a security policy",
    fix: "Add a SECURITY.md at the root, in .github/ or in docs/: which versions get fixes, and how to report a vulnerability privately (GitHub's private vulnerability reporting, or an address).",
  },
  "github.templates": {
    title: "Add issue and pull request templates",
    fix: "Add .github/ISSUE_TEMPLATE/ with a bug report and a feature request, and a .github/pull_request_template.md that asks what changed, why, and how it was tested.",
  },
  "ci.present": {
    title: "Add a CI workflow that runs on push and pull request",
    fix: "Add a workflow in .github/workflows/ that runs on push and pull_request, checks out the code, installs, and runs the build.",
  },
  "ci.tests": {
    title: "Run the tests in CI",
    fix: "Add a step to the CI workflow that runs the project's tests (npm test, pytest, or whatever runs them here), so a pull request that breaks them shows red.",
  },
  "secrets.tree": {
    title: "Remove committed secrets from the working tree",
    fix: "Revoke each secret where it was issued first: once it is committed, treat it as public. Then remove it from the file and read it from the environment instead.",
    doneWhen: ["Each secret is revoked where it was issued."],
  },
  "secrets.history": {
    title: "Revoke secrets that are in the git history",
    fix: "Revoke each secret where it was issued: anyone with a clone has the history. Then either rewrite the history to remove it (git filter-repo does this) and force-push, or accept that the old value is public.",
    doneWhen: ["Each secret is revoked where it was issued."],
  },
  "files.sensitive": {
    title: "Remove key files and .env files from the repository",
    fix: "Revoke what each file holds. Remove it from git with git rm --cached, add its pattern to .gitignore, and keep an .env.example with the names and no values.",
    doneWhen: ["What each file held is revoked where it was issued."],
  },
  "docs.changelog": {
    title: "Add a changelog",
    fix: "Add a CHANGELOG.md at the root, with one line per change a user would notice, newest first.",
  },
  "docs.conduct": {
    title: "Add a code of conduct",
    fix: "Add a CODE_OF_CONDUCT.md at the root, in .github/ or in docs/. The Contributor Covenant is a common start; say in it who to contact about a problem.",
  },
} satisfies Record<string, CardCopy>;

/** Why a check reads not investigated when a file it needs would not parse. */
export const unreadableReasons = {
  manifest: (path: string) => `${path} isn't JSON I can read, so I couldn't check what it says.`,
  license: (file: string, stated: string) =>
    `I couldn't tell which license ${file} is from its text, so I couldn't check it agrees with package.json's ${stated}.`,
};

/** Why names.deny reads not investigated when the files are clean. */
export const denyReasons = {
  messagesUnread:
    "Nothing from the deny list in the files, but the commit messages were not read: that needs git and a git repository.",
  messagesShallow:
    "Nothing from the deny list in the files or the commit messages here, but this is a shallow clone: the messages before its cut were not read.",
};

/** Why a workflow check reads not investigated when a workflow would not parse. */
export const workflowReasons = {
  unreadable: (path: string) => `${path} doesn't parse as YAML, so I couldn't read it.`,
  longLine: (path: string, line: number) =>
    `${line > 0 ? `Line ${line} of ${path}` : `A line of ${path}`} is longer than 65,536 characters, so I didn't read it.`,
};

/** Why a check that would read clean reads not investigated: what it needed to read is over the size it reads. */
export const tooLargeReasons = {
  text: (path: string, more: number) =>
    `${path}${more > 0 ? `, and ${more} more,` : ""} is over 5 MB, so I didn't read it, and can't call this clean.`,
  history:
    "The history is larger than I read (over 64 MB of changes, or two million added lines), so I didn't read it, and can't call it clean.",
};

/** Why a check that would read clean reads not investigated: the index names a path it would not read. */
export const refusedReasons = {
  leadsOutside: (path: string, more: number) =>
    `The index lists ${path}${more > 0 ? `, and ${more} more,` : ""} leading outside the repository, so I didn't read it, and can't call this clean.`,
};

/** Why a deps check that found another ecosystem's manifest reads not investigated, not clean. */
export const ecosystemReasons = {
  otherOnly: (path: string, ecosystem: string) =>
    `Code Sleuth reads npm projects so far; this is a ${ecosystem} project (${path}).`,
  npmCleanOtherUnread: (path: string, ecosystem: string) =>
    `The npm side is clean, but Code Sleuth reads npm projects so far, and ${path} (${ecosystem}) was not read.`,
};

/**
 * Why a check that reads the npm lockfile could not: there is none. One short sentence, the same for each, pointing
 * at deps.lockfile, whose line and card carry the fix, so one missing lockfile reads as one thing to do (#99).
 */
const needsLockfile = "This reads the npm lockfile, and there isn't one: deps.lockfile has the fix.";

/** Why license.deps could not read the dependencies' licenses, and what would let it. */
export const licenseDepsReasons = {
  noLockfile: needsLockfile,
  unreadable: (lockfile: string) => `${lockfile} is not JSON I can read.`,
  oldLockfile: (lockfile: string) =>
    `${lockfile} is an old lockfile without license fields: regenerate it with npm 7 or later.`,
};

/** A reason about one npm project below the root names its folder first: `In web/: ...`. The root's stands alone. */
export const inFolder = (folder: string, reason: string) =>
  folder === "" ? reason : `In ${folder}/: ${reason}`;

/** One lookup's call on the Out line, naming the folder it is for when that is not the root. */
export const callIn = (folder: string, call: string) => (folder === "" ? call : `${call} (for ${folder}/)`);

/** What deps.advisories says about its call, each finding, and why it could not look. */
export const advisoriesReasons = {
  outgoing: {
    npm: "npm audit sends the lockfile's package names and versions to npm's configured registry",
    gh: "gh api asks GitHub's advisory database about the lockfile's package names and versions",
  },
  noLockfile: needsLockfile,
  otherLockfile:
    "deps.advisories reads npm's package-lock.json, and this project locks with another package manager.",
  noTool: "This needs npm, or the GitHub CLI (gh) signed in, on the PATH.",
  npmFailed:
    "npm audit did not answer with its report: check that npm install works here, and that npm can reach its registry.",
  ghFailed: "gh api did not answer: check that gh is signed in (gh auth status) and can reach GitHub.",
  unreadableLockfile: (lockfile: string) => `${lockfile} is not JSON I can read.`,
  /** `minimist 1.2.0, critical: Prototype Pollution in minimist, and 1 more` */
  excerpt: (name: string, version: string | undefined, severity: string, title: string, more: number) =>
    `${name}${version === undefined ? "" : ` ${version}`}, ${severity}` +
    (title === "" ? "" : `: ${title}`) +
    (more > 0 ? `, and ${more} more` : ""),
};

/** What deps.outdated says about its one call, and why it could not make it. */
export const outdatedReasons = {
  outgoing:
    "npm outdated asks npm's configured registry for each direct dependency's latest version (names only)",
  noLockfile: needsLockfile,
  otherLockfile:
    "deps.outdated reads npm's package-lock.json, and this project locks with another package manager.",
  noNpm: "This needs npm on the PATH.",
  failed:
    "npm outdated did not answer with its list: check that npm install works here, and that npm can reach its registry.",
  unreadableLockfile: (lockfile: string) => `${lockfile} is not JSON I can read.`,
  /** Some dependencies come from elsewhere, and none of those looked up is behind. */
  leftOut: (deps: readonly LeftOut[]) =>
    `${leftOutList(deps)}: I only look up dependencies from npm's registry, and none of those is behind.`,
  /** Every dependency comes from elsewhere, so nothing was looked up. */
  allLeftOut: (deps: readonly LeftOut[]) =>
    `${leftOutList(deps)}: I only look up dependencies from npm's registry, so I looked nothing up.`,
};

type LeftOut = { name: string; source: "git" | "path" | "url" | "alias" | "other" };

const SOURCE_WORDS: Record<LeftOut["source"], string> = {
  git: "comes from git",
  path: "comes from a path on disk",
  url: "comes from a URL",
  alias: "is an npm: alias",
  other: "names a source I don't read",
};

const leftOutList = (deps: readonly LeftOut[]) =>
  deps.map(({ name, source }) => `${name} ${SOURCE_WORDS[source]}`).join("; ");

/** The refusal for a git too old to take its safe settings from GIT_CONFIG_KEY_<n>, which it would ignore. */
export const gitTooOld = (version: string) =>
  `git ${version} is too old for me: it would ignore the settings that keep a repository from running its own commands.`;
export const gitTooOldHint = "Install git 2.31 or newer, then run me again.";

/** Why the history could not be read, though git is there. */
export const historyPartial =
  "This is a partial clone: some of the history isn't here, and I don't fetch it. Run me on a full clone to read it.";

export const historyShallow =
  "This is a shallow clone: the history stops where it was cut, and what came before isn't here. Run me on a full clone (git fetch --unshallow) to read it.";

/** Why a check that threw read nothing. */
export const checkFailed = (message: string) =>
  `This check stopped before it could read everything: ${message}. Nothing it found is counted.`;

export const historyUnreadable =
  "git could not read the history: check that git log works in this repository.";

/** Why a check that needs git reads not investigated when git was there and did not answer in time. */
export const gitTimedOutReason = "git did not answer in time, so I couldn't read what it would have told me.";

/** Why a check could not run, and what would let it. */
export const needReasons: Record<Need, string> = {
  git: "This needs git: install git and point me at a git repository.",
  npm: "This needs npm on the PATH.",
  gh: "This needs the GitHub CLI, gh, on the PATH and signed in.",
  "pip-audit": "This needs pip-audit on the PATH.",
  network: "This makes a call off the machine, and --offline is set.",
  denyList: "This needs a deny list: give one with --deny <file>.",
};
