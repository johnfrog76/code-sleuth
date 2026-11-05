#!/usr/bin/env node
import { join } from "node:path";
import { defaultKeyFile, userFolder } from "../case/folder.js";
import { terminalAsk } from "./ask.js";
import { run, unexpected } from "./run.js";

const terminal = {
  stdin: process.stdin.isTTY === true,
  stdout: process.stdout.isTTY === true,
  stderr: process.stderr.isTTY === true,
};

// A reader that closes the pipe early (`| head`) ends what is printed, not the run: its case is still written,
// and its exit code still says what was found.
let closed = { stdout: false, stderr: false };
for (const [name, stream] of [
  ["stdout", process.stdout],
  ["stderr", process.stderr],
] as const) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE") throw error;
    closed = { ...closed, [name]: true };
  });
}

const io = {
  stdout: (text: string) => {
    if (!closed.stdout) process.stdout.write(text);
  },
  stderr: (text: string) => {
    if (!closed.stderr) process.stderr.write(text);
  },
  terminal,
  env: process.env,
  keyFile: defaultKeyFile(),
  npmFolder: join(userFolder(), "npm"),
  ...(terminal.stdin && terminal.stdout
    ? {
        ask: terminalAsk(),
      }
    : {}),
};

try {
  process.exitCode = await run(process.argv.slice(2), io);
} catch (error) {
  // run() answers every error itself; this is the last line, for one thrown outside it.
  process.exitCode = unexpected(error, io);
}
