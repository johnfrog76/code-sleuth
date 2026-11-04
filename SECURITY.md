# Security

## Reporting a problem

Please report a security problem privately, by email to `codesleuth.project (at) outlook.com`, the
project's own address. GitHub's private vulnerability reporting works too: on this repository, open
**Security**, then **Report a vulnerability**. Either way, only the maintainers see the report. Please don't
open a public issue for it.

Please include:

- what you found, and in which version or commit;
- how to reproduce it: the command, and a small repository or files that show it (never a real secret);
- what you think it lets someone do.

Reports are answered privately, and nothing about one is made public until it is fixed. The fix will say who
found it unless you'd rather it didn't.

## What counts

Code Sleuth reads repositories that may hold secrets, and it promises a few things. A report that breaks any
of them is a security problem:

- It never writes into the repository it investigates.
- A secret's value never appears in any output: the terminal, a case file, a card, or a polish request.
- The model key is read from `ANTHROPIC_API_KEY`, in the environment or in Code Sleuth's own `.env`, and is
  never written or printed. No other `.env` is read, and the key never reaches a process Code Sleuth starts.
- It sends nothing over the network except the calls the run names on its `Out` line before it makes them:
  the dependency lookups, which `--offline` turns off, and the polish request you asked for with `--polish`
  ([CONFIGURATION.md](docs/CONFIGURATION.md#what-leaves-the-machine)).
- Text from the repository never reaches a shell as a command. A repository's own git configuration can name
  commands too (a file-system monitor, a filter, a signature program, a hook); Code Sleuth turns off the ones
  its read-only git calls could reach, on every call.
- git never reaches the network on Code Sleuth's behalf. Every git call blocks every transport and lazy
  fetching, so a partial clone's missing objects are never fetched from its remote.

## Supported versions

Fixes go to the main branch and the next release. Only the latest release is supported.
