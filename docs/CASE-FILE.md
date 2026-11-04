# The case file

Every run writes one case, in a new folder, outside the repository it investigated. Nothing in a case folder
is ever overwritten: a second run is a second case.

## Where it is

```text
<cases>/                                  your cases folder (QUICKSTART.md), or --out
  machine-key                             this machine's random key for hashing secrets
  <repo-key>/                             <folder name>-<first 8 of a hash of its path>
    filed.json                            what has been filed in ToolKit (TOOLKIT.md)
    <yyyy-MM-dd>-<goal>-<n>/              one case; n counts that day's runs of that goal from 1
      case.json
      case.md
      cards/
        01-remove-committed-secrets-from-the-working-tree.md
        02-add-a-code-of-conduct.md
```

Code Sleuth refuses a cases folder inside the repository, and a repository that holds the cases folder (so
`code-sleuth ~` is refused): either would have it reading or writing its own output. Every file is UTF-8 with
no byte-order mark and LF line endings: a carriage return, from a polished card or a line it quotes, is written
as LF.

## `case.json`

The record, for scripts and for a later run. `--json` prints the same object.

| Field | Holds |
| --- | --- |
| `caseFile` | the format's version, `1`. A reader refuses a version it does not know |
| `tool` | `{ "name": "code-sleuth", "version": ... }` |
| `case`, `goal` | the case's id (`2026-10-31-public-1`) and its goal |
| `repo` | `name`, `head`, `branch`, `dirty`, and the `origin` remote with no scheme or credentials; null past the name outside git. `partialClone: true` on a partial clone |
| `openedAt`, `closedAt` | UTC, to the second |
| `verdict` | by the checklist: `ready` (no smoking gun and no loose end), `nearly` (loose ends only) or `not-ready` |
| `counts` | `smoking-gun`, `loose-end`, `hunch`, `clean`, `not-investigated` |
| `enhancements` | `polish` (on with its model, or off and why, with `keyFrom`: where the API key came from, `the environment` or the `.env`'s path, never the key; or with no key, `keyFile`: the `.env` it would be read from, and `keyExample`: the `.env.example` to copy there, when the one that came with it is found -- a record, not a line to run, both in their `~` form) and `toolkit` (detected or not, the Space and how it was chosen -- `spaceFrom`: `flag`, `origin` or `active` -- and what was filed) |
| `exampleLocations` | the example locations in force: `globs` (the built-in `**/test/fixtures/**` and `**/__fixtures__/**`, then every `--examples` glob), `added` (the `--examples` globs alone) and `marker` (`code-sleuth:example`) |
| `checks` | each check in the goal's order: `id`, `title`, `booksName`, `verdict`, and `weight`, `evidence`, `fix` and `card` when found, or `reason` when not investigated. Any check with matches in example locations also has `examples`, every one of them, never counted ([CHECKS.md](CHECKS.md#example-locations)) |

Evidence is `{ path, line, excerpt, rule }`, with `commit` for a finding in history, `valueHash` for a secret,
and `weighed` when it weighs less than the goal says (`name-guess` or a `moderate` advisory, one step down; a
`low` advisory, two), and `marked` when its line carries the
example marker. Paths are relative to the
repository, always with `/`. **A secret's value is never stored**: the excerpt is masked (`ghp_****9f`) and
`valueHash` is a keyed hash, so two runs can tell it is the same secret without the hash being guessable.

The same repository at the same commit, under the same goal, gives the same `case.json` except for
`openedAt`, `closedAt` and `case`.

## `case.md`

The verdict, with one line saying the call is yours when it is READY, the counts, then the checklist: Smoking guns, Loose ends, Hunches, Clean, Not investigated, one
checkbox line per check with a link to its card. Then one polish line and one ToolKit line. Without ToolKit,
that last line is the one place Code Sleuth mentions it.

## A card

A smoking gun makes a **Bug** card and a loose end a **Task**; a hunch makes a Task only with `--all`. A card
is written in the shape ToolKit's `NewPrompt -Description` fills, so the same text is the markdown card and,
when filed, the real card's description:

```markdown
# Bug: Remove committed secrets from the working tree

A secret in plain sight: anyone who can read the repository can use it.

**Evidence**
- `config/dev.ts:12` -- `token: "ghp_****9f"` (rule: github-token)

**What the books call it:** hard-coded credential

**The fix**
Revoke each secret where it was issued first: once it is committed, treat it as public. ...

**Done when**
- [ ] Each secret is revoked where it was issued.
- [ ] `code-sleuth --goal public` reads `secrets.tree` as Clean.

Found by Code Sleuth: secrets.tree, case 2026-10-31-public-1, at 3f2a9c1.
```

- The heading is the card's own; the body is everything after it. The body has no `#` headings, only bold
  labels, and is at most 3,500 characters. It shows at most 20 lines of evidence, then `and <n> more in the
  case file`.
- The title is at most 80 characters and plain: a card is read in a backlog among other cards.
- The last line is the fingerprint: the check, the case and the short commit. Search your backlog for it.
- The file is named by its order and its title: `02-add-a-code-of-conduct.md`.
