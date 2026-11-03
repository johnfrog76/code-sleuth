#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { run } from "./run.js";

const terminal = {
  stdin: process.stdin.isTTY === true,
  stdout: process.stdout.isTTY === true,
  stderr: process.stderr.isTTY === true,
};

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  terminal,
  env: process.env,
  ...(terminal.stdin && terminal.stdout
    ? {
        ask: async (question: string) => {
          const prompt = createInterface({ input: process.stdin, output: process.stdout });
          try {
            return await prompt.question(question);
          } finally {
            prompt.close();
          }
        },
      }
    : {}),
});
