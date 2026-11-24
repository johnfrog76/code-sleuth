# Third-party notices

What ships with Code Sleuth, and under which license. Code Sleuth itself is MIT ([LICENSE](LICENSE)).

## Runtime dependencies

These are installed with the package and run when it runs.

<!-- The rows below are held to package.json by test/notices.test.ts: every runtime dependency, its version
and its license, and no row for one that is not there. -->

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `yaml` | 2.9.1 | ISC | <https://github.com/eemeli/yaml> |

## Development dependencies

None of them ship in the package. TypeScript, Vitest, ESLint, Prettier and their dependencies are used to build
and test Code Sleuth, and are not part of the installed package. Run from GitHub with npx, the first run fetches
them to build it.

## Copied source

Not part of the installed package. These are copied into the repository and used by the deck page, `web/`,
which is published beside the project's page ([docs/DECK.md](docs/DECK.md)).

| Source | Version | License | Copyright | What was copied, and where |
| --- | --- | --- | --- | --- |
| Connected Deck, <https://github.com/johnfrog76/connected-deck> | commit `cbb3f9e5` | MIT | Copyright (c) 2026 John Webster | `src/deck-engine/` (the deck player, without its tests) to `web/src/deck/deck-engine/`, and the files it imports from outside that folder (`decks/types.ts`, `presenterMode.tsx`, `SettingsForm.tsx`, `settingsRules.ts`, `viewport.tsx`, `media.ts`, `voicePreference.tsx`, `shared/MarkdownViewer.tsx`, `shared/usePersistedState.ts`, `shared/ZoomControl.tsx`) to the same paths under `web/src/deck/` |

`web/src/deck/deck-engine/NOTICE.md` carries the license in full and lists the few changes made here. The deck
page's npm dependencies (React, Fluent UI, React Router) are bundled into the page, not the package; they are
listed, with their licenses, in `web/package-lock.json`.

## Repeating the scan

```sh
npm ls --omit=dev --all
npm query ':root > .prod' | node -e 'for (const p of JSON.parse(require("fs").readFileSync(0, "utf8"))) console.log(p.name, p.version, p.license)'
```

The first lists everything that ships; the second prints each runtime dependency's name, version and license.
