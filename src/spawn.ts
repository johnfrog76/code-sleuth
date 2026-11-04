import {
  spawnSync,
  type SpawnSyncOptions,
  type SpawnSyncOptionsWithBufferEncoding,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from "node:child_process";

/** The variable the model key is read from. Its value never reaches a process Code Sleuth starts. */
export const KEY_VARIABLE = "ANTHROPIC_API_KEY";

/**
 * The environment a child gets: the one given, without the model key, in any letter case. Windows matches
 * variable names without regard to case, and a copy of `process.env` keeps the person's own casing, so
 * `anthropic_api_key` would reach a child there. Dropping every casing everywhere is simpler, and harmless.
 */
export function withoutKey(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env))
    if (name.toUpperCase() !== KEY_VARIABLE) child[name] = value;
  return child;
}

/**
 * Every child process Code Sleuth starts goes through here: git, npm, gh and ToolKit's shell. An argument array,
 * never a command string, and an environment with the model key taken out. A test holds every other file in
 * `src/` away from `node:child_process`.
 */
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string>;
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithBufferEncoding,
): SpawnSyncReturns<Buffer>;
export function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions,
): SpawnSyncReturns<string | Buffer> {
  return spawnSync(command, args, { ...options, env: withoutKey(options.env ?? process.env) });
}
