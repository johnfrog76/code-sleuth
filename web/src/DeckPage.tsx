import { useCallback, useEffect, useMemo } from "react";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import { MemoryRouter, useLocation } from "react-router-dom";
import { BAKED_VOICES, voiceUrl } from "./deck/bakedVoices";
import { DeckPlayer } from "./deck/deck-engine/DeckPlayer";
import type { DeckMode } from "./deck/deck-engine/DeckPlayer";
import { DECKS } from "./deck/decks/index";
import type { Deck } from "./deck/decks/types";
import { ViewportProvider } from "./deck/viewport";

// The deck page: the first deck in the registry, playing over the whole window to an audience, reading
// itself aloud in its baked voices. It is served at deck/, beside the project's page, so leaving the deck
// goes one folder up, to that page.
//
// The player is Connected Deck's DeckPlayer, handed over as a page with no server needs it: audience mode
// only (there is no notes window to open, so no Podium), no live voice service, and narration on from the
// start. A browser may hold the first clip until the viewer presses something; the player's sound control
// is there for that. Its controller pages and exits through a router, so it plays inside an in-memory one
// holding two entries, the page and the deck. The address bar is never touched.

const PAGE_PATH = "/";
const AUDIENCE_ONLY: readonly DeckMode[] = ["audience"];

/** Where leaving the deck goes: the project's page, one folder up. */
export const LANDING = "../";

function leave() {
  window.location.assign(new URL(LANDING, window.location.href));
}

/** Leaves the page when the player's controller navigates away from the deck (its exit, or Escape). */
function ExitWatch({ deckPath, onExit }: { deckPath: string; onExit: () => void }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname !== deckPath) onExit();
  }, [pathname, deckPath, onExit]);
  return null;
}

function Player({ deck }: { deck: Deck }) {
  const slides = useMemo(() => deck.slides(), [deck]);
  const deckPath = `/deck/${deck.id}`;
  const onExit = useCallback(leave, []);
  const resolve = useCallback(
    (slide: { id: string }, voice: string) => voiceUrl(deck.id, slide.id, voice),
    [deck.id],
  );
  return (
    <MemoryRouter initialEntries={[PAGE_PATH, deckPath]} initialIndex={1}>
      <ExitWatch deckPath={deckPath} onExit={onExit} />
      <DeckPlayer
        deckId={deck.id}
        slides={slides}
        mode="audience"
        offeredModes={AUDIENCE_ONLY}
        voices={BAKED_VOICES}
        hasApi={false}
        resolveNarrationUrl={resolve}
        narrateByDefault
      />
    </MemoryRouter>
  );
}

/** What the page says while the registry is empty. */
export function NotHereYet() {
  return (
    <div className="empty">
      <p className="empty-line">The deck isn&rsquo;t here yet.</p>
      <p>
        <a href={LANDING}>Back to Code Sleuth</a>
      </p>
    </div>
  );
}

export function DeckPage({ decks = DECKS }: { decks?: readonly Deck[] }) {
  const deck = decks[0];
  return (
    <FluentProvider theme={webDarkTheme} style={{ colorScheme: "dark", minHeight: "100vh" }}>
      <ViewportProvider>
        <main>{deck ? <Player deck={deck} /> : <NotHereYet />}</main>
      </ViewportProvider>
    </FluentProvider>
  );
}
