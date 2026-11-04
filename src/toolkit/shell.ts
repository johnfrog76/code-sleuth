import { spawnChild } from "../spawn.js";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The one PowerShell file Code Sleuth ships. The same relative path from `src/toolkit/` and `dist/toolkit/`. */
export const HANDOFF = fileURLToPath(new URL("../../toolkit/handoff.ps1", import.meta.url));

/** The shells that can run ToolKit, in the order they are asked. Windows PowerShell 5.1 is ToolKit's floor. */
export const SHELLS = ["pwsh", "powershell.exe"] as const;
export type ShellName = (typeof SHELLS)[number];

export interface Shell {
  name: ShellName;
  path: string;
}

/** The first shell on the PATH, by asking the file system, never by guessing a location. */
export function findShell(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): Shell | undefined {
  const folders = (env.PATH ?? env.Path ?? "").split(delimiter).filter((folder) => folder !== "");
  for (const name of SHELLS) {
    const file = platform === "win32" && !name.endsWith(".exe") ? `${name}.exe` : name;
    for (const folder of folders) {
      const path = join(folder, file);
      if (isExecutable(path, platform)) return { name, path };
    }
  }
  return undefined;
}

function isExecutable(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface HandoffResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/**
 * Runs `handoff.ps1` in a fresh shell, with no profile: ToolKit's verbs load from PSModulePath, not from a
 * profile. Every value is its own argument, spawned directly: no shell parses any of it, so a title holding
 * quotes, `;`, `&`, `$()` or a newline arrives as it was.
 */
export function runHandoff(shell: Shell, args: readonly string[], env: NodeJS.ProcessEnv): HandoffResult {
  const result = spawnChild(shell.path, ["-NoProfile", "-NonInteractive", "-File", HANDOFF, ...args], {
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ...(result.error ? { error: result.error } : {}),
  };
}

const ESC = String.fromCharCode(27);
const STYLES = new RegExp(
  `${ESC}\\[[0-9;?]*[A-Za-z]|${ESC}\\][^${String.fromCharCode(7)}]*${String.fromCharCode(7)}`,
  "g",
);

/** Output without colour codes or terminal links, whatever the shell thought it was writing to. */
export function plain(text: string): string {
  return text.replace(STYLES, "").replace(/\r\n/g, "\n");
}
