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
| `test/case/` | the cases folder and its refusals, the record, the cards, golden case files, determinism, and the masking test (a secret check's finding, and a secret on a line any other check reports) |
| `test/polish/` | the guard's table, the client over a fake `fetch`, and whole runs with a stubbed client |
| `test/toolkit/` | detection, the call and the ledger with stub shells, the `handoff.ps1` syntax, and a real ToolKit run |
| `test/docs/` | `CHECKS.md` against the check table, every relative link, `CLI.md` against the parser, and the project's page: its sample against a real run, its local files, no script |
| `test/atoms/` | every atom renders as a standalone SVG with a title and no warning, carries no words in its art, and passes the contrast check on the light, dark and office backgrounds; the project's page takes its verdict colours from the tokens |
| `test/cli/nowrite.test.ts` | a whole run, with the real npm in its offline mode, gh, git and the ToolKit hand-off, writes nothing into the repository, even with an `.npmrc` that points npm's cache and logs into it |
| `test/spawn.test.ts` | the model key never reaches a child process, in any letter case, and every child starts through `src/spawn.ts` |
| `test/gitsafe.test.ts` | with a real git, a repository's own configuration never has Code Sleuth run a command: a file-system monitor, each kind of filter, a signature program, a hook; a partial clone fetches nothing, with both guards and with `protocol.allow=never` alone; and only `src/engine/repo.ts` spawns git |
| `test/notices.test.ts` | `THIRD-PARTY-NOTICES.md` against `package.json`: every runtime dependency, its version and its license |
| `test/decoy.test.ts` | the words `scripts/check-decoy-case.mjs` expects, against the copy files they come from |

## What every test can rely on

- **Read-only.** Every engine test runs through `test/helpers/investigate.ts`. It copies a fixture to a scratch
  folder outside any repository (committing it when the test needs history), runs the test, and fails if the
  tree changed by a byte, a link that points elsewhere, or its `git status` changed. A test fails any engine test that does not use it.
- **One run on this repository.** `test/selfrun.test.ts` runs the built command on Code Sleuth's own tree,
  offline, with `--out` in scratch, and fails when a secret, a machine path or a note-to-self is found that is
  not marked `code-sleuth:example`: test bait must carry the marker. It reads the whole history too, so it
  needs a full clone; CI checks out every commit for it.
- **No real cases folder.** The CLI helper (`test/helpers/cli.ts`) demands a scratch cases folder.
- **No real `.env`.** A run in a test reads Code Sleuth's `.env` only when the test names a scratch one; the
  command's own default is set by `src/cli/main.ts`, and its one test runs it with a scratch home.
- **No network.** The polish client is stubbed, or given a fake `fetch`; ToolKit is a stub shell on a test-only
  PATH, and so are npm and gh (`test/helpers/npm.ts`), which log each call and answer from a scenario. A run
  given no PATH finds neither, so no other test can reach a registry or GitHub. The one test of a hostile
  `.npmrc` runs the real npm against two listeners on `127.0.0.1`, with a scratch user config that names one of
  them as the registry: nothing leaves the machine.
- **No real secrets.** Test secrets are assembled from pieces at test time (`test/helpers/secrets.ts`), so
  nothing committed matches a secret rule.

## Fixtures

- `test/fixtures/repos/`: small trees, one per row, and three whole repositories: `bare`, `kept` and `messy`.
  `test/fixtures/** -text` in `.gitattributes` keeps every byte as committed on every host.
- `test/fixtures/cases/`: golden case files for those repositories. After a change you meant to make, regenerate
  them with `UPDATE_GOLDEN=1 npx vitest run test/case`, and read the diff before you commit it.
- `test/fixtures/polish/guard.json`: the polish guard's table.

## The periodic audit

`.github/workflows/periodic-audit.yml` runs the quick start's first command, the npx line from the home folder,
with `--offline` and `--out` added, against the decoy case, on Linux, macOS and Windows (PowerShell 7) with
Node 24. It runs once a month, on every `v*` tag, and by hand (Actions, periodic-audit, Run workflow). A tag
push runs that tag; the others run the newest `v*` release. The quick start must name the tag, or the run
fails, so a tag push also holds a release to its docs. A tag that carries the two scripts is checked with its
own. Like CI, it runs only in this repository, while it is public. When a job fails or times out, a last job
opens an issue that links the run, or comments on the audit's issue that is still open.

The decoy case is a folder of small repositories, each made to trip Code Sleuth up one way: an `.npmrc` with a
trap, an index that lists a file outside the repository, a 99 MB file, a file name holding a verdict line and
a lone carriage return, a planted `.env` and token, terminal control characters in a file and in a file name,
a replacement object that hides a commit, and a git config that never answers. Its tokens are made up at run
time. On Windows, `names`, `slowgit` and the control-character file name in `bidi` are skipped, and both
scripts say so; a skip anywhere else fails. `scripts/check-decoy-case.mjs` then checks each expected result,
one PASS or FAIL line each: every run exits 0; the trap never fires; nothing reads clean that could not be
read, and the outside file's text is nowhere; the large file is found and what was too large to read says so;
the only verdict line is the real one; secrets are found, shown masked only, and no made-up value, nor any 12
characters of its middle, is written or printed; no control, bidi or zero-width character or lone carriage
return is written or printed, nor held in a string of a `.json` file; the hidden commit's token is found; the
git checks are not investigated when git does not answer; every decoy is byte for byte unchanged; and
`--offline --toolkit` is refused. It exits 1 on any FAIL. A last step is the control for the trap: npx started
inside a second `npmrc` decoy must set its trap off, or passing the first check proves nothing on that system;
when it does not, the step prints what npx said. On Windows the trap is the `node-options` one alone, with no
`registry` line: npm starts `git` and `script-shell` with no shell, and Node does not start a `.cmd` that way, so
a `.cmd` there could never fire and would stop npm first; and the `--require` fires only once npx has installed
what it runs.

To run it by hand against a build, from a clone, with two empty folders outside every repository:

```sh
node scripts/make-decoy-case.mjs <decoy> > <runs>/make.txt
node scripts/check-decoy-case.mjs --before <decoy> <runs>
cd ~
code-sleuth <decoy>/env --goal public --offline --out <runs>/cases > <runs>/env.txt 2>&1; echo $? > <runs>/env.exit
```

Run the last line once for each decoy the first line made, then once more as
`code-sleuth <decoy>/env --goal public --offline --toolkit --out <runs>/cases`, with its output in
`<runs>/toolkit-offline.txt` and its exit code in `<runs>/toolkit-offline.exit`. Then:

```sh
node scripts/check-decoy-case.mjs <decoy> <runs>
```

The header of each script says what it reads and writes. `test/decoy.test.ts` holds the checker's expected
words to the copy files, so a change to those words fails in `npm test` before it fails the audit.

## Not in the suite

`scripts/render-atoms.mjs` renders the atoms with headless Chrome. It is a development tool: nothing in
`npm test` runs it, and it says plainly when Chrome is not found. Nothing in `npm test` runs the two periodic
audit scripts either.

## Named skips

Three tests run only where they can, and say so in the summary as skipped, never passed:

- **The real ToolKit run** (`test/toolkit/real.test.ts`) needs `CODE_SLEUTH_TOOLKIT` set to a ToolKit checkout.
  It files cards into a scratch copy of ToolKit's sample hub, and stops unless ToolKit resolved that hub.
- **Windows PowerShell 5.1** runs only on Windows.
- **The execution policy, for real** (`test/toolkit/policy-real.test.ts`) runs only on Windows with
  `CODE_SLEUTH_POLICY_TEST=Restricted`, as CI's `windows-policy` job sets it after setting the policy.

The count is the summary line `npm test` prints, and that line is the one to read: a skip is counted as a
skip, never a pass. The named skips are the two real-ToolKit rows in `test/toolkit/real.test.ts` and the real policy row.
