# Contributing

Thank you for wanting to help. This page is how to get a change in: where to start, how to set up and run the
tests, and what a pull request needs. Code Sleuth is small, and it means to stay simple, helpful and fun.

## Start with an issue

Open an issue before a pull request, so we can agree on what to change first. A false positive or a miss
from a real repository is especially welcome: describe the shape that tripped it, not the repository, and
never paste a real secret, even a revoked one. Keep other people's code and secrets private, here and anywhere the project talks.

## Set up

You need Node 24 (`.nvmrc`) and git. `package.json` overrides `minimatch` to 11.0.9 for the development tools'
tree: ESLint asks for 11, but typescript-eslint still asks for 10.x, the line with a known advisory
(GHSA-g3hv-75wg-m249). The override goes once typescript-eslint asks for 11 too. Nothing in the published package uses `minimatch`. [QUICKSTART.md](QUICKSTART.md) installs it from a clone;
[TESTING.md](TESTING.md) runs the tests and says what each suite guards; [ARCHITECTURE.md](ARCHITECTURE.md)
says how the parts fit. [AGENTS.md](../AGENTS.md) lists the rules that are easy to break, and
[spec/code-sleuth.spec.md](../spec/code-sleuth.spec.md) is the contract the code is held to.

## A pull request

- One change per pull request, from the main branch, with a description of what changed and why.
- Tests for what you changed. A new check comes with one fixture per input its rule tells apart.
- No real-looking secret in any file, fixtures included: test secrets are built from pieces at test time
  (`test/helpers/secrets.ts`).
- Docs change in the same pull request as the code they describe, and a change a user would notice adds a
  line to `CHANGELOG.md`.
- Paste the results of `npm test` and `npm run lint` in the description.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, `npm run lint` and `npm run build` on Node 24
  for every pull request and every push to main. It runs on the public repository; a private copy skips it.
- The periodic audit (`.github/workflows/periodic-audit.yml`) runs the quick start's npx line, with `--offline`
  and `--out` added, against the decoy case on Linux, macOS and Windows, monthly, on every `v*` tag and by
  hand, and opens an issue when it fails.
  It too runs only on the public repository. [TESTING.md](TESTING.md#the-periodic-audit) says what it checks.
- A release (`.github/workflows/release.yml`) starts from a pushed `vX.Y.Z` tag, and only from one. Before
  the tag, a pull request sets `package.json`'s version and moves the unreleased notes under a
  `## [X.Y.Z] - date` heading in `CHANGELOG.md`. The workflow refuses a tag that names another version than
  `package.json`, or has no changelog section; it runs the tests, packs the package, and makes the GitHub Release
  from the pushed tag, with that section as its notes and `code-sleuth-X.Y.Z.tgz` attached. The job that
  publishes holds the one write permission, with no checkout and no install. A tag is never moved or made again.
  The same tag stages the version on npm; [RELEASING.md](RELEASING.md) has the release from start to end.
- The project's page is `site/`, plain HTML and CSS. `.github/workflows/pages.yml` publishes it to GitHub Pages
  when a change to it reaches main, with the deck page built from `web/` beside it at `deck/`
  ([DECK.md](DECK.md)). CI installs, type-checks and builds `web/` too. A test holds its sample to a real run, so a change to the checklist's
  words may change the page too.
- Publishing the page the first time takes three steps, in order, since the workflow runs only on a public
  repository and a push that touches `site/`: make the repository public; set Settings, Pages, Build and
  deployment to "GitHub Actions"; then run the Pages workflow by hand (Actions, Pages, Run workflow).

## Code of conduct

Everyone here follows [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md). Report a conduct problem to
`codesleuth.project (at) outlook.com`. As the code of conduct says, community leaders are obligated to respect
the privacy and security of the reporter of any incident ([Enforcement](../CODE_OF_CONDUCT.md#enforcement)).
