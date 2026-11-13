# Code Sleuth

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

**Point it at a repo and run. A checklist and card-ready issues come back.**

The project's page: [johnfrog76.github.io/code-sleuth](https://johnfrog76.github.io/code-sleuth/).

Code Sleuth gives you a helpful list of what's worth doing before your code is public facing. Your public
repositories are often how people first meet your work, so it pays to have them show it well. Every project's
bar is its own, so treat the list as a place to start, not the final word.

It's a sloth private eye for your repository: point it at one and it investigates, then hands back that list
and a card for each item that needs work, written so you can file it. The lightest items, hunches, get a card
when you ask with `--all`.

It runs on your machine. Without `--polish`, the only calls it makes are the dependency lookups, which it
names before it runs and `--offline` turns off. Two things make it better, and neither is required:

| You have | You get |
| --- | --- |
| A repository | The investigation, the checklist, and card-ready issues as markdown |
| An API key in Code Sleuth's `.env`, and `--polish` | Each card reworded by a small model, with every path its evidence cites, every number and every masked value checked to be unchanged |
| ToolKit installed, and `--toolkit` | Each card filed as a real ToolKit card, once you say yes |

## Quick start

It is not on npm yet: run it from a clone, with Node 24.

```sh
git clone https://github.com/johnfrog76/code-sleuth.git && cd code-sleuth
npm ci && npm link
code-sleuth path/to/your/repo --goal public
```

You get the verdict and the checklist, and a case file in your own cases folder, never in the repository.
[docs/QUICKSTART.md](docs/QUICKSTART.md) walks through it, and
[what the verdict means and doesn't](docs/CHECKS.md#what-the-verdict-means-and-doesnt) is worth a read
before you act on one. A MET means the list is met; your software may have requirements of its own, and
[what MET doesn't cover](docs/CHECKS.md#what-met-doesnt-cover) names the ones worth a look.

## Documentation

| Read | For |
| --- | --- |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | install from a clone, the first case, `--polish`, the ToolKit hand-off |
| [docs/CLI.md](docs/CLI.md) | every command, flag and refusal, and the exit codes |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | the environment variables it reads, Code Sleuth's own `.env`, what leaves the machine, and the cases folder |
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

Version 0.2.0, released as the `v0.2.0` tag on GitHub: the whole loop on one goal, the public-facing goal. It is not on npm yet. The
security and quality goals are planned for a later release.

## License

MIT. See [LICENSE](LICENSE).
