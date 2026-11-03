import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** One check filed as one ToolKit card. */
export interface LedgerEntry {
  check: string;
  card: string;
  space: string | null;
  case: string;
  date: string;
}

export const LEDGER_FILE = "filed.json";

/** `filed.json`, beside the repository's cases: what has been filed in ToolKit, one entry per check. */
export function ledgerPath(repoCasesFolder: string): string {
  return join(repoCasesFolder, LEDGER_FILE);
}

export function readLedger(path: string): LedgerEntry[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { filed?: LedgerEntry[] };
  return Array.isArray(parsed.filed) ? parsed.filed : [];
}

/**
 * Records a filed check, replacing an earlier entry for the same check (a --refile). The ledger's key is the
 * check id alone: one check files one card. Written whole to a temporary file and renamed into place, so a
 * run stopped part-way never leaves half a ledger.
 */
export function recordFiled(path: string, entry: LedgerEntry): LedgerEntry[] {
  const entries = [...readLedger(path).filter((e) => e.check !== entry.check), entry];
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ filed: entries }, null, 2) + "\n", "utf8");
  renameSync(temporary, path);
  return entries;
}
