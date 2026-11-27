# Releasing

A version tag pushed (`v0.3.0`) starts two workflows. `.github/workflows/release.yml` makes the GitHub Release,
with the version's changelog section as notes and the packed package attached. `.github/workflows/publish.yml`
stages the same version on npm. This page is how the npm side works, and the release from start to end.

Code Sleuth is published to npm with npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers). No
npm token is stored anywhere. The workflow proves who it is to npm with a short-lived token from GitHub, and npm
adds provenance on its own: a signed record of the commit and the workflow that built the package.

The workflow **stages** each version and never publishes it straight away. `npm stage publish` puts the version
in npm's staging area, and it goes live only when the maintainer approves it on npm with two-factor
authentication. Only the maintainer pushes a version tag, and only the maintainer approves.

## Before the first release

These steps happen once.

1. **An npm account for the project**, with two-factor authentication turned on. It owns the package.
2. **The package's name on npm.** npm sets up a trusted publisher only for a package that already exists on
   the registry, so the very first step is taken by hand, by the maintainer, on their own machine, signed in to
   the project's npm account. There are two ways to take it:
   - **Try this first: stage a placeholder.** From a clean clone, run `npm stage publish`. npm's staging docs
     say that staging a package that does not exist yet publishes a placeholder version, `0.0.0-stage`. Approve
     nothing. Then set up the trusted publisher (step 3), and the first real version goes through the workflow,
     with provenance. If npm refuses the trusted publisher, or the workflow's stage, take the documented way
     below instead.
   - **The documented way: publish the first version by hand.** From a clean clone at the release commit (the
     version set, as in [Each release](#each-release) below), run `npm ci`, `npm test`,
     `node scripts/check-pack.mjs`, then `npm publish`. This first version has no provenance. Every version after
     it goes through the workflow.
3. **The trusted publisher**, on the package's settings page on npmjs.com (Trusted Publisher, GitHub Actions):
   - repository: `johnfrog76/code-sleuth`
   - workflow file: `publish.yml`, the name exactly
   - environment: none
   - allowed actions: `npm stage publish` only

   npm wants the first publish through a new trusted publisher within two days of setting it up, or the setting
   expires and has to be made again. So set it up on the day of the release.

## Each release

1. **A release pull request** sets `version` in `package.json`, and moves the unreleased notes in
   `CHANGELOG.md` under a `## [X.Y.Z] - date` heading. It goes through review and CI like any other pull
   request.
2. **The maintainer tags the merged commit**, with `v` and the version: `git tag v0.3.0`, then
   `git push origin v0.3.0`. Nothing else starts either workflow. A tag is never moved or made again.
3. **release.yml makes the GitHub Release.** It refuses a tag that is not `vX.Y.Z`, a tag that names another
   version than `package.json`, and a version with no changelog section. It runs the tests, packs the package,
   and makes the Release from the pushed tag, with that section as its notes and `code-sleuth-X.Y.Z.tgz`
   attached.
4. **publish.yml stages the version on npm.** It makes the same tag check, then runs `npm ci` (which builds),
   `npm test`, and `node scripts/check-pack.mjs` (below), and stages the package with `npm stage publish`.
5. **The maintainer reviews and approves** the staged version on npm, with two-factor authentication
   (`npm stage list`, then `npm stage approve <id>`, or on npmjs.com). Only then can anyone install it.
6. **Check it:** `npm audit signatures` in a project that installs it, and `npx code-sleuth --version` on a
   clean machine.

## The packed files

`scripts/check-pack.mjs` asks `npm pack --dry-run --json` which files the package would hold, and checks each
against `files` in `package.json`. A packed file must sit under a `files` entry, or be one npm always packs: the
root's `package.json`, `README` and `LICENSE` (or `LICENCE`, in any case, with any extension), and the `bin`
file. Every `files` entry must pack at least one file. It names any file that does not belong, or any entry that
packs nothing, and stops the release before anything is staged. `test/check-pack.test.ts` holds its matching.

## What the workflow needs

From npm's docs, and held by `test/docs/publish.test.ts`:

- a GitHub-hosted runner, and `id-token: write` on the job, the only permission besides `contents: read`;
- npm 11.15.0 or later for `npm stage publish` (the workflow installs an exact version), and Node 22.14.0 or
  later (it uses the version in `.nvmrc`);
- `repository.url` in `package.json` matching this repository exactly;
- a public repository and a public package, for provenance.
