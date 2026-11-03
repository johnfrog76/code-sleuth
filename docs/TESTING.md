# Testing

```sh
npm test         # builds, then runs Vitest
npm run lint     # type check, ESLint and Prettier
```

`npm test` builds first, so the tests that run the command run the built one.

## The suites

| Suite | Guards |
| --- | --- |
| `test/cli/` | the command: help, version, every refusal, `checks`, investigating, `--json`, `--fail-on`, `--deny`, colour |
| `test/engine/` | the reader, the check contract, every check (one row per input its rule tells apart), the secret rules and masking |
| `test/case/` | the cases folder and its refusals, the record, the cards, golden case files, determinism, and the masking test |
| `test/polish/` | the guard's table, the client over a fake `fetch`, and whole runs with a stubbed client |
| `test/toolkit/` | detection, the call and the ledger with stub shells, the `handoff.ps1` syntax, and a real ToolKit run |
| `test/docs/` | `CHECKS.md` against the check table, every relative link, and `CLI.md` against the parser |
| `test/atoms/` | every atom renders as a standalone SVG with a title and no warning, carries no words in its art, and passes the contrast check on the light, dark and office backgrounds |
| `test/notices.test.ts` | `THIRD-PARTY-NOTICES.md` against `package.json`: every runtime dependency, its version and its license |

## What every test can rely on

- **Read-only.** Every engine test runs through `test/helpers/investigate.ts`. It copies a fixture to a scratch
  folder outside any repository (committing it when the test needs history), runs the test, and fails if the
  tree changed by a byte or its `git status` changed. A test fails any engine test that does not use it.
- **No real cases folder.** The CLI helper (`test/helpers/cli.ts`) demands a scratch cases folder.
- **No real `.env`.** A run in a test reads Code Sleuth's `.env` only when the test names a scratch one; the
  command's own default is set by `src/cli/main.ts`, and its one test runs it with a scratch home.
- **No network.** The polish client is stubbed, or given a fake `fetch`; ToolKit is a stub shell on a test-only
  PATH, and so are npm and gh (`test/helpers/npm.ts`), which log each call and answer from a scenario. A run
  given no PATH finds neither, so no other test can reach a registry or GitHub.
- **No real secrets.** Test secrets are assembled from pieces at test time (`test/helpers/secrets.ts`), so
  nothing committed matches a secret rule.

## Fixtures

- `test/fixtures/repos/`: small trees, one per row, and three whole repositories: `bare`, `kept` and `messy`.
  `test/fixtures/** -text` in `.gitattributes` keeps every byte as committed on every host.
- `test/fixtures/cases/`: golden case files for those repositories. After a change you meant to make, regenerate
  them with `UPDATE_GOLDEN=1 npx vitest run test/case`, and read the diff before you commit it.
- `test/fixtures/polish/guard.json`: the polish guard's table.

## Not in the suite

`scripts/render-atoms.mjs` renders the atoms with headless Chrome. It is a development tool: nothing in
`npm test` runs it, and it says plainly when Chrome is not found.

## Named skips

Two tests run only where they can, and say so in the summary as skipped, never passed:

- **The real ToolKit run** (`test/toolkit/real.test.ts`) needs `CODE_SLEUTH_TOOLKIT` set to a ToolKit checkout.
  It files cards into a scratch copy of ToolKit's sample hub, and stops unless ToolKit resolved that hub.
- **Windows PowerShell 5.1** runs only on Windows.

The count is the summary line `npm test` prints, and that line is the one to read: a skip is counted as a
skip, never a pass. The two named skips above are the real-ToolKit rows, both in `test/toolkit/real.test.ts`.
