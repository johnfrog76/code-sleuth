import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The read-only guarantee holds only if no engine test opens a repository around the helper.
const folder = fileURLToPath(new URL("./", import.meta.url));
const files = (readdirSync(folder, { recursive: true }) as string[])
  .map((name) => name.split("\\").join("/"))
  .filter((name) => name.endsWith(".test.ts") && name !== "every-test-is-read-only.test.ts");

describe.each(files)("%s", (name) => {
  const source = readFileSync(`${folder}${name}`, "utf8");
  it("runs through investigate() or investigateAsync(), and never opens a repository itself", () => {
    // investigateAsync holds the same guarantee for a body that awaits.
    expect(source).toMatch(/\binvestigate(?:Async)?\(/);
    expect(source).not.toMatch(/\bopenRepo\b/);
  });
});
