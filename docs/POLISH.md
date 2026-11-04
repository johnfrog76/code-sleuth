# The polish pass

With an API key, `--polish` has each card reworded to read more easily. Every path, number, masked value and
the fingerprint survive, or the rewrite is thrown away and the card stays as Code Sleuth wrote it.

## When it runs

Only with **both** an Anthropic API key and `--polish` on the run.

## Where the API key goes

Copy `.env.example`, from the root of the clone or the package, to Code Sleuth's own folder, and fill in your
API key. With no API key, the run prints the one line that does the copy for your platform -- `mkdir -p`,
`cp` and `chmod 600` on macOS and Linux, `New-Item` and `Copy-Item` in PowerShell on Windows -- with the
example's full path, wherever the package is (a clone, a global install or npx's cache), and the `.env`'s.
The case file keeps the same line with both paths in their `~` form, so a case you paste holds no home folder:

| Platform | File |
| --- | --- |
| macOS | `~/Library/Application Support/code-sleuth/.env` |
| Linux | `$XDG_DATA_HOME/code-sleuth/.env`, else `~/.local/share/code-sleuth/.env` |
| Windows | `%LOCALAPPDATA%\code-sleuth\.env` |

On macOS and Linux, make it yours alone: `chmod 600` on the file. If others can read it, the run warns once,
with the command that fixes it. An API key already set in your environment wins over the file
([CONFIGURATION.md](CONFIGURATION.md#environment-variables)).

- **No other `.env` is read.** Not the investigated repository's, and not the one in the folder you run from:
  those hold someone else's secrets.
- **It is parsed, never loaded.** Only the API key is taken from the file, and nothing is added to the
  environment, so npm, gh and ToolKit's shell, which Code Sleuth starts, never see it. It is held in memory for
  the polish request alone.
- **It is never written or printed:** not to a case, a config file or a log. The run says where the API key
  came from, never what it is.

| You have | The run says |
| --- | --- |
| no API key, no `--polish` | `Polish  off. Add an API key and --polish to have the cards reworded. To add one, run <the copy line> and fill it in.` |
| an API key, no `--polish` | `Polish  an API key is set (from ~/Library/Application Support/code-sleuth/.env): add --polish to have the cards polished.` |
| `--polish`, no API key | `Polish  No API key. The cards are as the sleuth wrote them. To add one, run <the copy line> and fill it in.` |
| an API key and `--polish` | `Polish  5 of 5 cards polished by claude-haiku-5-5, with the API key from the environment.` |

`--polish` without an API key is not a refusal: the run goes on. It is opt-in each time because it sends text
off the machine; an API key alone never turns it on.

## What is sent

One request per card, to `https://api.anthropic.com/v1/messages`: the card's title and body, already masked,
and the prompt, `src/polish/prompt.md`, which ships with the package. The prompt asks the model to reword
only: to keep every fact the guard checks, to add no specific the card does not give (a name, a place, a
count, an example, a kind), to keep each word's meaning, and to drop nothing. It asks; it cannot guarantee. Never a file from the repository, never
an unmasked value, never the repository's path on your machine. The header of the run names the request
before any is made.

The model is the current Haiku, `claude-haiku-5-5`, because a card is a short rewrite: small and fast is the
point. `CODE_SLEUTH_MODEL` overrides it.

## The guard

What comes back is kept only when it keeps each of these from the card it was made from, and adds none:

- the fingerprint line (the check, the case, the short commit),
- every path and `path:line` the card's evidence cites, word for word, whatever it looks like (`.env:3`,
  `Dockerfile`, `LICENSE`), and not inside a longer one (`.env:31` does not keep `.env:3`),
- every other path in backticks that reads as one: with a folder, an extension, a leading dot or a `:line`,
- every number, as many times as it appears,
- every masked value (`ghp_****9f`, `****`),
- the count of checkboxes,

and still has a card's shape: a title of at most 80 characters on one line, a body within 3,500 characters,
no headings. Otherwise the card stays as written, and `case.json` says why on that check:
`"polish": { "state": "kept-original", "reason": "path-dropped" }`. The reasons are `empty`, `shape-changed`,
`check-id-dropped`, `path-dropped`, `path-added`, `masked-value-changed`, `number-changed` and
`checkbox-count-changed`.

**A kept rewrite means the guard's rules did not fire, not that nothing changed.** The guard compares a list;
it cannot see meaning, so a word that adds a kind ("an email address" for "an address") passes it. The
prompt asks against that, and mostly holds. A second pass that has a model check the rewrite against the
original comes in a later release.

## When it fails

A failure is a line, not a stop. One attempt per card, a 60-second timeout, no retries: a bad key
(`bad-key`), a rate limit (`rate-limited`), an API it cannot reach (`unreachable`), a timeout (`timeout`), a
request the API rejects (`rejected`), a model that declines (`refused`) or an answer it cannot read
(`unreadable`) keeps that card as written, with the reason in the case, and the run still exits 0.

## Why plain `fetch`, not the Anthropic SDK

The request is one small `fetch`, not the official SDK. Code Sleuth's promise is that it sends nothing you did
not ask for, and it reads other people's dependency trees for a living. The SDK would bring eight packages,
a telemetry interface among them. That interface sends nothing on its own, but a stranger reading this
project's lockfile should not have to take that on trust. The polish pass is one optional request whose
failure changes nothing, so the SDK's retries and typed errors buy little here. Writing the request by hand
also lets two guarantees be plain in the code: the address is fixed (`ANTHROPIC_BASE_URL` is ignored), and no
client exists without an API key. The only runtime dependency stays `yaml`.
