# The polish pass

With a model key, `--polish` has each card reworded to read more easily. Every path, number, masked value and
the fingerprint survive, or the rewrite is thrown away and the card stays as Code Sleuth wrote it.

## When it runs

Only with **both** an Anthropic API key in `ANTHROPIC_API_KEY` and `--polish` on the run. The key is read from
that one variable and nowhere else, and it is never written: not to a case, a config file or a log, and never
printed.

| You have | The run says |
| --- | --- |
| no key, no `--polish` | `Polish  off. Set ANTHROPIC_API_KEY and add --polish to have the cards reworded.` |
| a key, no `--polish` | `Polish  a model key is set: add --polish to have the cards polished.` |
| `--polish`, no key | `Polish  No model key in the environment: the cards are as the sleuth wrote them.` |
| a key and `--polish` | `Polish  5 of 5 cards polished by claude-haiku-5-5.` |

`--polish` without a key is not a refusal: the run goes on. It is opt-in each time because it sends text
off the machine; a key in the environment alone never turns it on.

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
- every path and `path:line` in backticks,
- every number,
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
client exists without a key from `ANTHROPIC_API_KEY`. The only runtime dependency stays `yaml`.
