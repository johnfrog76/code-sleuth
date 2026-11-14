import { codeSleuthDeck } from "./code-sleuth";
import type { Deck } from "./types";

// The registry. A deck plays on the deck page as soon as it is imported here and listed in DECKS; there is
// no other step.
//
// Registering a deck is two lines: one import, one entry. For a deck file `./my-deck.tsx` that exports
// `myDeck`:
//
//   import { myDeck } from "./my-deck";
//   export const DECKS: Deck[] = [myDeck];
//
// The page plays the first deck listed. docs/DECK.md says where a deck comes from and how it is carried here.
export const DECKS: Deck[] = [codeSleuthDeck];
