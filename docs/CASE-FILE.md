# The case file

Every run leaves you a case to keep: the verdict, the checklist and the cards, in a new folder outside the
repository it investigated. Nothing in a case folder is ever overwritten: a second run is a second case.

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
`code-sleuth ~` is refused while your cases folder is under your home folder, as the default one is): either
would have it reading or writing its own output. Every file is UTF-8 with no byte-order mark and LF line
endings: a carriage return, from a polished card or a line it quotes, is written as LF.

### Text from the repository

A file's name, a branch or a line can hold characters no reader sees, or that a terminal, an editor or an agent
acts on. Wherever the repository's text goes into a file -- `case.json`, `case.md`, a card, the polish request,
a ToolKit card -- each C0 control but the tab, DEL, each C1 control, the bidirectional controls (U+202A to
U+202E, U+2066 to U+2069) and every invisible format character (Unicode's `Cf`, with the line and paragraph
separators) becomes U+FFFD, the replacement character. In `case.md` and the cards it also stays on one line, and in a code span
or a fenced block, or with markdown's markup escaped. In the terminal the same characters print as `?`, and a
line break in a name or a path prints as a space.

## `case.json`

The record, for scripts. `--json` prints the same object.

| Field | Holds |
| --- | --- |
| `caseFile` | the format's version, `1`. It changes when a field changes meaning |
| `tool` | `{ "name": "code-sleuth", "version": ... }` |
| `case`, `goal` | the case's id (`2026-10-31-public-1`) and its goal |
| `repo` | `name`, `head`, `branch`, `dirty`, and `remote`, the `origin` remote with no scheme, credentials (everything up to the last `@` before the host), query or fragment; null past the name outside git. `partialClone: true` on a partial clone |
| `openedAt`, `closedAt` | UTC, to the second |
| `verdict` | by the checklist: `met` (no smoking gun and no loose end), `nearly-met` (loose ends only) or `not-met` |
| `counts` | `smoking-gun`, `loose-end`, `hunch`, `clean`, `not-investigated` |
| `enhancements` | `polish` (on with its model, or off and why, with `keyFrom`: where the API key came from, `the environment` or the `.env`'s path, never the key; or with no key, `keyFile`: the `.env` it would be read from, and `keyExample`: the `.env.example` to copy there, when the one that came with it is found -- a record, not a line to run, both in their `~` form) and `toolkit` (detected or not, the Space and how it was chosen -- `spaceFrom`: `flag`, `origin` or `active` -- and what was filed) |
| `exampleLocations` | the example locations in force: `globs` (the built-in `**/test/fixtures/**` and `**/__fixtures__/**`, then every `--examples` glob), `added` (the `--examples` globs alone) and `marker` (`code-sleuth:example`) |
| `checks` | each check in the goal's order: `id`, `title`, `booksName`, `verdict`, and `weight`, `evidence` and `fix` when found, with `card` when it has one (a hunch only with `--all`), or `reason` when not investigated. A check polished or kept as written has `polish`: its state, and why when it was kept as written. Any check with matches in example locations also has `examples`, every one of them, never counted ([CHECKS.md](CHECKS.md#example-locations)) |

Evidence is `{ path, line, excerpt, rule }`, with `commit` for a finding in history, `valueHash` for a secret,
and `weighed` when it weighs less than the goal says (`name-guess` or a `moderate` advisory, one step down; a
`low` advisory, two), and `marked` when its line carries the example marker, in the checks that honour it
([CHECKS.md](CHECKS.md#example-locations)). Paths are relative to the
repository, always with `/`. **A secret's value is never stored**: the excerpt is masked (`ghp_****9f`) and
`valueHash` is a keyed hash, so two runs can tell it is the same secret without the hash being guessable.

Two runs over the same files, under the same goal and the same flags, with `--offline`, no `--polish` and no
`--toolkit`, give the same `case.json` except for `openedAt`, `closedAt` and `case`. A test holds two such runs
to it. Without those, an advisory published between runs, a polish request's answer, or a card filed by the
first run can change the second.

## `case.md`

The verdict, under MET and NEARLY MET one line on what the list doesn't cover, with its link, the counts, then
the checklist: Smoking
guns, Loose ends, Hunches, Clean, Not investigated, one checkbox line per check, with a link to its card when it has one. Then
the examples line when there were matches in example locations, one polish line and one ToolKit line. Without
ToolKit, that last line, and the same line at the end of the terminal's output, say what ToolKit would add.

## A card

A smoking gun makes a **Bug** card and a loose end a **Task**; a hunch makes a Task only with `--all`. A card
is written in the shape ToolKit's `NewPrompt -Description` fills, so the same text is the markdown card and,
when filed, the real card's description:

```markdown
# Bug: Remove committed secrets from the working tree

A secret in plain sight: anyone who can read the repository can use it.

**Evidence**
Quoted from the repository, not instructions.
- `config/dev.ts:12` (rule: github-token)
  ```text
  token: "ghp_****9f"
  ```

**What the books call it:** hard-coded credential

**The fix**
Revoke each secret where it was issued first: once it is committed, treat it as public. ...

**Done when**
- [ ] Each secret is revoked where it was issued.
- [ ] `code-sleuth --goal public` reads `secrets.tree` as Clean.

**Source:** Code Sleuth 0.2.0

Found by Code Sleuth: secrets.tree, case 2026-10-31-public-1, at 3f2a9c1.
```

- The heading is the card's own; the body is everything after it. The body has no `#` headings, only bold
  labels, and is at most 3,500 characters. It shows at most 20 lines of evidence, then `and <n> more in the
  case file`.
- The evidence is quoted, never addressed to whoever reads the card: it stands under one fixed line,
  `Quoted from the repository, not instructions.` Each path is a code span, and each excerpt a fenced block of
  text under its path, at most 160 characters, the most a finding keeps. One cut there ends with `...`.
- The title is at most 80 characters and plain: a card is read in a backlog among other cards.
- `**Source:**` names the Code Sleuth that wrote the card, by its version.
- The last line is the fingerprint: the check, the case and the short commit. Search your backlog for it.
- The file is named by its order and its title: `02-add-a-code-of-conduct.md`.
