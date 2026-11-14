// Which voices exist for which slide, and where their audio is.
//
// The file name is the whole contract: voices/<deckId>/<slideId>-<voiceId>.mp3, carried here from where the
// deck is made. Vite turns the glob into hashed asset URLs at build time, relative to the page under its
// `base: "./"`, so there is no list to fall out of step with the files: a voice is offered exactly when its
// file is here. The files sit under src/, not public/, so each ships once.
//
// The glob is relative to THIS file. Move it and a wrong path finds no file and raises no error: the deck
// plays silent and nothing says why.
const voiceUrls = import.meta.glob<string>("./voices/*/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

const urlByKey = new Map<string, string>();
for (const [path, url] of Object.entries(voiceUrls)) {
  const tail = path.split("/voices/")[1]; // "<deckId>/<slideId>-<voice>.mp3"
  if (tail) urlByKey.set(tail, url);
}

// The voice list is the engine's: its ids are the ones the clips were baked with, in their file names.
export { NARRATION_VOICES as BAKED_VOICES } from "./deck-engine/narrationConstants";

/** The clip's bundled URL, or null when it was not baked (the player stays silent on that slide). */
export function voiceUrl(deckId: string | undefined, slideId: string | undefined, voice: string): string | null {
  if (!deckId || !slideId) return null;
  return urlByKey.get(`${deckId}/${slideId}-${voice}.mp3`) ?? null;
}
