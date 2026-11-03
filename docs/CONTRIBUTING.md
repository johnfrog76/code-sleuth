# Contributing

Thank you for wanting to help. Code Sleuth is small, and it means to stay simple, helpful and fun.

## Start with an issue

Open an issue before a pull request, so we can agree on what to change first. A false positive or a miss
from a real repository is especially welcome: describe the shape that tripped it, not the repository, and
never paste a real secret, even a revoked one. Keep other people's code and secrets private, here and anywhere the project talks.

## Set up

You need Node 24 (`.nvmrc`) and git. [QUICKSTART.md](QUICKSTART.md) installs it from a clone;
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

## Code of conduct

Everyone here follows [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md). Report a conduct problem to
`codesleuth.project (at) outlook.com`; reports are kept confidential.
