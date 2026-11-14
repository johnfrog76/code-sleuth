import { BREAKPOINTS } from "../media";
import { useViewport } from "../viewport";

// Code Sleuth's own file, not part of the copied engine (see NOTICE.md). A deck made where decks are made
// asks `useCompactLayout()` whether the window is a phone. Connected Deck answers that question in one place,
// `../viewport`, so this hook asks it there rather than running a second matchMedia subscription: the deck
// and the player then agree on where "compact" begins. It needs the page's ViewportProvider above it.

/** The widest window that is still compact: below the `sm` breakpoint, 575px. */
export const COMPACT_MAX_WIDTH = BREAKPOINTS.sm - 1;

/** True on a phone-width window; live, so rotating a phone flips it. */
export function useCompactLayout(): boolean {
  return useViewport().isMobile;
}
