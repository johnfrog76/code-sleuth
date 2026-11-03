import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Golden case files carry a date; one time zone keeps them the same on every machine.
    env: { TZ: "UTC" },
  },
});
