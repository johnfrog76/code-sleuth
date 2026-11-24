# The deck

Code Sleuth has a short product deck: the detective's story, narrated, played in the browser. This page says
where it is made, where it lives here, how a deck is registered, and how its page is built and served.

The deck page is built and ready, but the deck has not arrived yet. Until it does, the page says so and links
back to the project's page, and nothing links to it.

## Where the deck is made

The deck is made in a separate deck studio, with its art, its notes and its narration (spec 10.4: "built
separately and shipped as files"). The studio's ship step carries it here as files, byte for byte, after two
plain rewrites that fit its imports to this player: `../engine/` becomes `../deck-engine/`, and
`GiveawayButton` becomes `CopyLinkButton`.

So the deck files and their voices are never edited here. A change made here is a bug: the next ship writes
over it. Change the deck where it is made, and ship it again.

## The home

Everything the deck needs is under `web/src/deck/`, the deck's home:

```text
web/src/deck/
  decks/
    index.ts        the registry: DECKS, the decks this page can play
    types.ts        the authoring contract: Deck, Slide, DeckState
    <deck>.tsx      a deck, and its figures file (shipped)
  voices/
    <deckId>/       its narration, <slideId>-<voiceId>.mp3 (shipped)
  bakedVoices.ts    finds the clips, as bundled URLs
  deck-engine/      the player, copied from Connected Deck
  shared/, *.tsx    what the player imports from outside its folder, copied with it
```

A deck imports the player's pieces from `../deck-engine/` (`makeSlide`, `PresenterNoteKit`,
`useCompactLayout`, `CopyLinkButton`) and its types from `./types`. `CopyLinkButton` with no `url` copies this
repository's address.

## Registering a deck

A deck plays as soon as `decks/index.ts` imports it and lists it in `DECKS`: one import line, one entry.

```ts
import { myDeck } from "./my-deck";

export const DECKS: Deck[] = [myDeck];
```

The page plays the first deck listed. The ship step reports the line the registry still lacks, and whether
this page names the deck yet, in "The decks here" below. Both change in the same commit as the deck.

## The decks here

- **code-sleuth** (`decks/code-sleuth.tsx`, with `decks/code-sleuth-figures.tsx` and `voices/code-sleuth/`): the product deck, eleven slides, the sloth's story from the jungle to the hat tip. The landing page's "Watch the video" opens it.

## The page

`web/` is its own private npm project (Vite, React and Fluent UI), apart from the published package: its
dependencies are not Code Sleuth's, and nothing in it ships with the command. Its entry is `web/index.html`,
which loads `web/src/main.tsx` and nothing else.

The page plays the registered deck over the whole window, to an audience: the viewer's bar only, no
presenter's notes, and narration on from the start, from the clips in `voices/`. A browser may hold the first
clip until the viewer presses something; the sound control is there for that. Leaving the deck, with its Exit
button or Escape, goes to `../`, the project's page.

`npm run build` in `web/` writes `web/dist/`, with every address relative (`base: "./"`), so the page works
under any path. `.github/workflows/pages.yml` builds it and publishes it at `deck/`, beside the project's page:
one folder holds `site/` as it is, and the build at `deck/`. The project's page stays plain HTML with no script.

CI's test job installs, type-checks and builds `web/` on every pull request.

## Running it locally

```sh
cd web
npm ci
npm run dev        # the page, served by Vite
npm run typecheck  # tsc
npm run build      # web/dist/
npm run smoke:landing                 # both pages, in Chrome, as Pages serves them
npm run smoke:landing -- --serve      # the same, then keeps serving them and prints the address
```

Served alone by Vite, the page has no project's page one folder up, so leaving the deck lands back on itself.
`npm run smoke:landing` serves both, put together by the Pages workflow's own "Assemble the page" step.

The smoke test builds `web/`, assembles the two pages, serves them on a local port and drives the machine's
Chrome (`CHROME_PATH` names another Chromium-based browser). It holds that the project's page shows "Watch
the video" and that it opens `deck/`; that the deck page plays slide 1, with `1 / N` in its bar; that every
baked clip is in the build and answers as audio; that Escape goes back to the project's page; that neither
page scrolls sideways on a 390 px phone; and that neither logs an error. `--shots <dir>` saves screenshots,
and `--host` and `--port` choose where it listens. CI runs it after the build.

The root's `npm run lint` checks the page's own files (`web/src/*.tsx`, `web/index.html`, its config) with
ESLint and Prettier, and leaves `web/src/deck/` alone: it holds the copied engine and the shipped deck, which
keep the style they came in.

## The engine

`web/src/deck/deck-engine/` is the deck player from Connected Deck, an MIT project, copied at commit `cbb3f9e5`
without its tests. The files it imports from outside its folder came with it, to the same relative paths.
`deck-engine/NOTICE.md` keeps the license and lists what changed here: `CopyLinkButton`'s default link, a
`useCompactLayout` that asks the player's viewport, a plain-text notes viewer in place of the Markdown one, and
two of the deck studio's words in `types.ts`. [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) records the
copy.

A change to the player belongs in Connected Deck first, then comes here as a new copy.
