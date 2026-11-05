import { childEnv, commonArgs, type DetectOptions, type Detection } from "./detect.js";
import { plain, runHandoff } from "./shell.js";

export type FileResult =
  | { status: "filed"; card: string; folder?: string; path?: string }
  | { status: "refused"; sentence: string }
  | { status: "failed"; sentence: string };

/** A card ToolKit filed, whose id the success line did not show. */
export const UNKNOWN_CARD = "unknown";

const CREATED =
  /\[\+\]\s+Created\s+\S+\s+in\s+(\S+?)\/?\s+--\s+([A-Za-z][\w-]*)\s+([A-Za-z0-9]+),\s+offline\b/;
// To the end of its line: a path can hold a space (`/Users/A Person/hub/...`).
const PROMPT = /^\s*Prompt:\s*(file:.*?)\s*$/m;

/**
 * Reads ToolKit's two success lines, each with a tolerant pattern:
 *   [+] Created <file> in <folder>/ -- <Type> <id>, offline.
 *       Prompt: file:///<full path>
 * A line that does not match leaves that part unknown; the card is still filed.
 */
export function readCreated(output: string): { card: string; folder?: string; path?: string } {
  const text = plain(output);
  const created = CREATED.exec(text);
  const prompt = PROMPT.exec(text)?.[1];
  return {
    card: created ? `${created[2]} ${created[3]}` : UNKNOWN_CARD,
    ...(created ? { folder: created[1]! } : {}),
    ...(prompt ? { path: fromFileUrl(prompt) } : {}),
  };
}

/** `file:///C:/hub/x.md` is `C:/hub/x.md`; `file:////Users/x.md` and `file:///Users/x.md` are `/Users/x.md`. */
function fromFileUrl(url: string): string {
  const raw = url.replace(/^file:\/\/\//, "");
  // A path ToolKit did not encode can hold a bare %: read it as written, rather than throw mid-batch.
  let rest: string;
  try {
    rest = decodeURI(raw);
  } catch {
    rest = raw;
  }
  return /^[A-Za-z]:/.test(rest) || rest.startsWith("/") ? rest : `/${rest}`;
}

/** The sentence ToolKit stated for a refusal: its Error: line, else its last line. */
function sentenceOf(stdout: string, stderr: string): string {
  const lines = plain(`${stderr}\n${stdout}`)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const error = lines.find((l) => l.startsWith("Error:"));
  return (error ?? lines.at(-1) ?? "").replace(/^Error:\s*/, "");
}

/** Files one card through ToolKit's NewPrompt: a title, a type and a description, and nothing else. */
export function fileCard(
  detection: Extract<Detection, { state: "detected" }>,
  card: { title: string; type: "Bug" | "Task"; body: string },
  options: DetectOptions,
): FileResult {
  const args = [
    ...commonArgs(detection.prefix, options.moduleRoot),
    "-Title",
    card.title,
    "-Type",
    card.type,
    "-Description",
    card.body,
  ];
  const result = runHandoff(detection.shell, args, childEnv(options));
  if (result.error) return { status: "failed", sentence: result.error.message };
  if (result.status === 0) return { status: "filed", ...readCreated(result.stdout) };
  const sentence = sentenceOf(result.stdout, result.stderr);
  if (result.status === 2) return { status: "refused", sentence };
  return { status: "failed", sentence: sentence || `exit code ${result.status}` };
}
