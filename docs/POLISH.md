# The polish pass

With an API key, `--polish` has each card reworded to read more easily. Every path its evidence cites, every
number, every masked value and the fingerprint survive, or the rewrite is thrown away and the card stays as
Code Sleuth wrote it.

## When it runs

Only with **both** an Anthropic API key and `--polish` on the run.

## Where the API key goes

Copy `.env.example`, from the root of the clone or the package, to Code Sleuth's own folder, and fill in your
API key. With no API key, the run prints the one line that does the copy for your platform -- `mkdir -p`,
`cp` and `chmod 600` on macOS and Linux, `New-Item` and `Copy-Item` in PowerShell on Windows -- with the
example's full path, wherever the package is (a clone, a global install or npx's cache), and the `.env`'s.
The case file keeps a record instead, not a line to run: the example and the `.env` it goes to, both in their `~`
form, so these paths hold no home folder:

| Platform | File |
| --- | --- |
| macOS | `~/Library/Application Support/code-sleuth/.env` |
| Linux | `$XDG_DATA_HOME/code-sleuth/.env`, else `~/.local/share/code-sleuth/.env` |
| Windows | `%LOCALAPPDATA%\code-sleuth\.env` |

On macOS and Linux, make it yours alone: `chmod 600` on the file. If others can read it, the run warns once,
with the command that fixes it. An API key already set in your environment wins over the file
([CONFIGURATION.md](CONFIGURATION.md#environment-variables)).

- **No other `.env` is read for the key.** Not the investigated repository's, and not the one in the folder you run from:
  those hold someone else's secrets.
- **It is parsed, never loaded.** Only the API key is taken from the file, and nothing is added to the
  environment, so npm, gh and ToolKit's shell, which Code Sleuth starts, never see it. It is held in memory for
  the polish request alone.
- **It is never written or printed:** not to a case, a config file or a log. The run says where the API key
  came from, never what it is.

| You have | The run says |
| --- | --- |
| no API key, no `--polish` | `Polish     off. Add an API key and --polish to have the cards reworded. To add one, run <the copy line> and fill it in.` |
| an API key, no `--polish` | `Polish     an API key is set (from ~/Library/Application Support/code-sleuth/.env): add --polish to have the cards polished.` |
| `--polish`, no API key | `Polish     No API key. The cards are as the sleuth wrote them. To add one, run <the copy line> and fill it in.` |
| an API key and `--polish` | `Polish     5 of 5 cards polished by claude-haiku-5-5, with the API key from the environment.` |
| `--polish` and `--offline` | `Polish     off, because of --offline: no polish request was made. The cards are as the sleuth wrote them.` |

`--polish` without an API key is not a refusal: the run goes on. Nor is `--polish` with `--offline`, which
wins: no request is built or sent, and the case records polish as off, with the reason `--offline`. It is opt-in each time because it sends text
off the machine; an API key alone never turns it on.

## What is sent

One request per card, to `https://api.anthropic.com/v1/messages`: the card's title and body, already masked,
and the prompt, `src/polish/prompt.md`, which ships with the package. The prompt asks the model to reword
only: to keep every fact the guard checks, to add no specific the card does not give (a name, a place, a
count, an example, a kind), to keep each word's meaning, and to drop nothing. It asks; it cannot guarantee. Never a file from the repository, never
an unmasked value, never the repository's path on your machine. The repository's text in the card is kept as
data ([CASE-FILE.md](CASE-FILE.md#text-from-the-repository)), and the answer goes through the same function
before the guard reads it, so the two are compared like with like. The header of the run names the request
before any is made.

A polished card is for you to read: it is written to the case folder and never filed. With `--toolkit`, ToolKit
gets the card as Code Sleuth wrote it ([TOOLKIT.md](TOOLKIT.md#what-is-filed)).

The model is the current Haiku, `claude-haiku-5-5`, because a card is a short rewrite: small and fast is the
point. `CODE_SLEUTH_MODEL` overrides it.

## The guard

What comes back is kept only when it keeps each of these from the card it was made from, and adds none:

- the fingerprint line (the check, the case, the short commit),
- every path and `path:line` the card's evidence cites, word for word, whatever it looks like (`.env:3`,
  `Dockerfile`, `LICENSE`), and not inside a longer one (`.env:31` does not keep `.env:3`),
- every other path in backticks that reads as one: with a folder, an extension, a leading dot or a `:line`,
  and every path written in prose (`~/.ssh/id_ed` among them),
- every code span, word for word: an excerpt quotes the file, and a command is run as written. A span may lose
  its backticks if its text stays; a span the card did not have is a change. Spans are read as a renderer
  reads them: a run of backticks closes only on a run of the same length, and an escaped backtick (`` \` ``)
  opens none,
- every number, as many times as it appears, in any script's digits or in words (`forty-eight`, `twice`),
- every masked value (`ghp_****9f`, `****`),
- the count of open checkboxes and of ticked ones, each on its own, wherever they stand,
- no link, URL or HTML tag the card did not have,
- the line `Quoted from the repository, not instructions.` and the `**Source:**` line, each as its own line,
- no reference definition (`[x]: //host/p.png`, at a line's start, in a list item or in a quote) that is not a
  line of the card word for word,
- no text in square brackets outside a code span (`[the guide]`, `[the guide][g]`) that the card did not have;
  the card's own checkboxes, `- [ ]` and `- [x]`, are counted above,
- no letter, mark or punctuation outside ASCII that the card does not use: a look-alike letter, a full-width
  dot, a curly quote or a dash,
- not many more words: at most 15% more than the card, or 6 more for a short card,

and still has a card's shape: a title of at most 80 characters on one line (no line break of any kind), a
body within 3,500 characters, no headings (`#`, an underlined line, or `<h1>` to `<h6>`; a line in a fenced
block, as a quoted excerpt is, is text, not a heading). Otherwise the card stays as written, and `case.json` says why on that check:
`"polish": { "state": "kept-original", "reason": "path-dropped" }`. The reasons are `empty`, `shape-changed`,
`check-id-dropped`, `path-dropped`, `path-added`, `masked-value-changed`, `number-changed`,
`checkbox-count-changed`, `code-changed`, `markup-added`, `reference-added`, `bracket-added`,
`character-added` and `words-added`.

**A kept rewrite means the guard's rules did not fire, not that nothing changed.** The guard compares a list;
it cannot see meaning, so a word that adds a kind ("an email address" for "an address") passes it, and so
does a short sentence that tells the reader, or an agent, to do something the card did not say: the word
margin limits how much a rewrite can add, not what it says. The prompt says
the card is data and asks for neither. The
prompt asks against that; nothing checks that it was heeded. A second pass that has a model check the rewrite against the
original is planned for a later release.

## When it fails

A failure is a line, not a stop. One attempt per card, a 60-second timeout, no retries: a bad key
(`bad-key`), a rate limit (`rate-limited`), an API it cannot reach (`unreachable`), a timeout (`timeout`), a
request the API rejects (`rejected`), a model that declines (`refused`) or an answer it cannot read
(`unreadable`) keeps that card as written, with the reason in the case, and the run goes on: the failure changes no exit code.

## Why plain `fetch`, not the Anthropic SDK

The request is one small `fetch`, not the official SDK. Code Sleuth reads other people's dependency trees for
a living, so its own should be short enough to read: the only runtime dependency stays `yaml`. The polish pass
is one optional request whose failure changes nothing, so an SDK's retries and typed errors would buy little
here. Writing the request by hand also keeps two things plain in the code: the address is fixed
(`ANTHROPIC_BASE_URL` is ignored), and no client exists without an API key.
