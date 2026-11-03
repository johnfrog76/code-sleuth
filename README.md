# Code Sleuth

<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
    <img src="assets/logo.svg" alt="Code Sleuth" height="96">
  </picture>
</p>

```text
 ===============___=============================================
 ==============( ( (============================================
                \ \                _.-""""""""""""-._
                 \ \              /____________________\
                  \ \        .---'                      '---.
                   \ \       `------------------------------'
                    \ \           .-""""""""""""""""-.
                     \ \         |  (o)            (o)  |
                      \ \        |  ///    .--.    \\\  |
                       \ \       | //      `--'      \\ |
                        \ \       \      \______/      /
                         \ \       '-.______________.-'
                          \ \     |\   .----------.   /|__
                           \ \____| \  |   o  o   |  / | \ \
                            \_____|  \_|   o  o   |_/  |  \_\__.----.
                                  `----'----------`----'       /      \
                                                               \      /
                                                                `----'
```

**Point it at a repo, pick a goal, run. A checklist and card-ready issues come back.**

Code Sleuth is a sloth private eye for your repository. Ask it one question -- is this ready to go public,
is it secure, is it in good shape -- and it investigates, then hands back a checklist and an issue for each
loose end, written so you can file it.

It runs on your machine and sends nothing anywhere. Two things make it better, and neither is required:

| You have | You get |
| --- | --- |
| A repository | The investigation, the checklist, and card-ready issues as markdown |
| An Anthropic API key in the environment, and `--polish` | Each card reworded by a small model, with every path, number and masked value checked to be unchanged |
| ToolKit installed | Each card filed as a real ToolKit card |

## Quick start

It is not on npm yet: run it from a clone, with Node 24.

```sh
git clone https://github.com/johnfrog76/code-sleuth.git && cd code-sleuth
npm ci && npm link
code-sleuth path/to/your/repo --goal public
```

You get the verdict and the checklist, and a case file in your own cases folder, never in the repository.
[docs/QUICKSTART.md](docs/QUICKSTART.md) walks through it.

## Documentation

| Read | For |
| --- | --- |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | install from a clone, the first case, `--polish`, the ToolKit hand-off |
| [docs/CLI.md](docs/CLI.md) | every command, flag and refusal, and the exit codes |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | the environment variables it reads, and the cases folder |
| [docs/CHECKS.md](docs/CHECKS.md) | every check: what it reads, what it finds, its weight per goal, the fix |
| [docs/CASE-FILE.md](docs/CASE-FILE.md) | the case folder, `case.json`, `case.md` and the cards |
| [docs/POLISH.md](docs/POLISH.md) | the polish pass: what is sent, the guard, the key |
| [docs/TOOLKIT.md](docs/TOOLKIT.md) | the ToolKit hand-off: how it is found, the call, the ledger |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the parts fit, and the repository's layout |
| [docs/TESTING.md](docs/TESTING.md) | the suites, the fixtures, and the named skips |
| [docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md) | what is not built yet, known to read wrong, or not proven |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | helping: issues, pull requests, the rules |
| [LICENSE](LICENSE) | MIT |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | the Contributor Covenant, version 2.1 |
| [SECURITY.md](SECURITY.md) | reporting a security problem privately |
| [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) | what ships with the package, and under which license |
| [CHANGELOG.md](CHANGELOG.md) | what changed, version by version |

[docs/README.md](docs/README.md) is the map, with the order to read them in.

## Status

Before its first release. The first milestone, **The case**, is the whole loop on one goal: going public.

## License

MIT. See [LICENSE](LICENSE).
