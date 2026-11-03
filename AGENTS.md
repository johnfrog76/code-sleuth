# Agents

How we work here: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

The contract is `spec/code-sleuth.spec.md`. Read the sections a task touches before building it. If an
issue and the spec disagree, the spec decides; if behaviour and the spec disagree, the behaviour is the bug.

## Build and check

```sh
npm ci           # installs, and builds through prepare
npm test         # builds, then runs Vitest
npm run lint     # tsc, ESLint and Prettier
```

How the parts fit, and where each lives, is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). What every test
can rely on (read-only fixtures, no real cases folder, no network, no real secrets), the fixtures and the
named skips are [docs/TESTING.md](docs/TESTING.md). Every doc is listed in [docs/README.md](docs/README.md);
a fact lives in the one that owns it, and the others link to it.

**One runtime dependency, `yaml`,** pinned exactly, for reading GitHub workflow files, through
`src/engine/workflows.ts` and its safe defaults only. Adding another runtime dependency needs the maintainers' agreement.

## Rules that are easy to break

1. **Never write into the investigated repository.** The case file goes to the per-user cases folder or
   `--out`; an `--out` inside the repository is refused.
2. **Deterministic first.** Every finding is a rule over files. The model only rewrites card prose, and a
   rewrite that changes a fact is thrown away.
3. **A check that cannot run is `not-investigated`, with a reason. Never `clean`.**
4. **Secrets are masked everywhere** (`ghp_****9f`): terminal, `case.json`, cards, the polish request. The
   value is never stored, only a keyed hash.
5. **No real-looking secret is ever committed**, fixtures included. Test secrets are assembled from
   fragments at test time (`test/helpers/secrets.ts`), and a test that needs one builds its tree in code:
   `investigate({ name, files }, ...)`, with `commits` for history.
6. **Every child process gets an argument array**, never a command string built from repository text. On
   Windows, `npm` is a `.cmd` shim and goes through one spawn helper.
7. **`toolkit/handoff.ps1` stays Windows PowerShell 5.1-clean**: no ternary, `??`, `?.`, `-AsHashtable`, or
   `&&` and `||` chains.
8. **The model key is read from `ANTHROPIC_API_KEY`, in the environment or in Code Sleuth's own `.env`, and
   never written or printed.** No other `.env` is read, and the key never reaches a child's environment. No
   telemetry.
9. **Check ids are goal-free** (`secrets.tree`); a goal is a list of ids with weights.
10. **A refusal is one `Error:` line and one `Hint:` line, exit 2**, printed by `src/cli/refusal.ts`. Exit 1
    only from `--fail-on`.
11. **Words live in copy files** (`src/cli/copy.ts`, `src/engine/copy.ts`, `src/case/copy.ts`), not in
    the rules. The detective's voice outside, plain facts inside. Card titles carry no detective words.

## Writing

Everything here is written for strangers: no machine paths, no private repository names, no people's
names. Plain words, short sentences, double hyphens (`--`) rather than dashes. Docs and `CHANGELOG.md`
change in the same commit as the code they describe.
