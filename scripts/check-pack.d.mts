// The types of scripts/check-pack.mjs, for its test.
export function checkPack(
  manifest: { files?: string[]; bin?: string | Record<string, string>; main?: string },
  packed: readonly string[],
): { unexpected: string[]; empty: string[] };
