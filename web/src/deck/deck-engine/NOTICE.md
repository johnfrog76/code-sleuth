# The deck engine

This folder is the deck player from Connected Deck, copied as it was at commit `cbb3f9e5`
(<https://github.com/johnfrog76/connected-deck>, `src/deck-engine/`), without its tests. It was first copied at
`6e1293f`; at `cbb3f9e5` four files came again: `ComponentFrame.tsx` (its `transparent`, `inverse` and `zoomStep`,
and its zoom on a phone), `artScale.tsx` (new), `SlideRenderer.tsx` and `../shared/ZoomControl.tsx`. Connected Deck is
MIT licensed:

```text
MIT License

Copyright (c) 2026 John Webster

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The files it imports from outside this folder came from the same commit, to the same relative paths under
`web/src/deck/`: `decks/types.ts`, `presenterMode.tsx`, `SettingsForm.tsx`, `settingsRules.ts`, `viewport.tsx`,
`media.ts`, `voicePreference.tsx`, and `shared/` (`MarkdownViewer.tsx`, `usePersistedState.ts`,
`ZoomControl.tsx`).

## What changed here

- `CopyLinkButton.tsx`: `url` is optional and defaults to Code Sleuth's repository, so a deck's closing slide
  can use the button with no props.
- `useCompactLayout.ts` is new: it answers from `../viewport`, where Connected Deck asks the same question.
- `../shared/MarkdownViewer.tsx` is trimmed: it shows plain-string notes as plain paragraphs, without
  react-markdown and remark-gfm. Only the presenter's notes window uses it, and this page never opens one.
- `../decks/types.ts` adds `DeckState.Complete` and an optional `project` field, the deck studio's words.
- `../decks/index.ts` is Code Sleuth's own registry, not a copy.

Everything else is byte for byte as copied. A change to the player belongs in Connected Deck first.
