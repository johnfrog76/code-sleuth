import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPTIONS } from "../../src/cli/run.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The documents a reader moves between: the root ones, and everything under docs/. */
const documents = [
  ...[
    "README.md",
    "AGENTS.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "CHANGELOG.md",
    "THIRD-PARTY-NOTICES.md",
  ].map((f) => join(ROOT, f)),
  ...(readdirSync(join(ROOT, "docs"), { recursive: true }) as string[])
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(ROOT, "docs", f)),
];

/** The text a reader sees as prose: fenced code blocks and inline code removed. */
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

/** GitHub's anchor for a heading: lower case, punctuation dropped (but - and _), spaces as hyphens. */
export const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");

const anchorsOf = (file: string) =>
  new Set([...readFileSync(file, "utf8").matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => slug(m[1]!)));

const links = documents.flatMap((file) =>
  [...prose(readFileSync(file, "utf8")).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
    .map((m) => m[1]!)
    .filter((target) => !/^(?:[a-z]+:|\/\/)/i.test(target))
    .map((target) => ({ from: relative(ROOT, file), target })),
);

describe("every relative link in the docs", () => {
  it("is checked: there are links to check", () => {
    expect(links.length).toBeGreaterThan(20);
  });

  it.each(links.map((l) => [l.from, l.target]))("%s -> %s resolves", (from, target) => {
    const [path, anchor] = target.split("#") as [string, string | undefined];
    const file = path === "" ? join(ROOT, from) : join(dirname(join(ROOT, from)), decodeURI(path));
    expect(existsSync(file), `${target} from ${from}`).toBe(true);
    if (anchor !== undefined && statSync(file).isFile() && file.endsWith(".md")) {
      expect(anchorsOf(file), `#${anchor} in ${relative(ROOT, file)}`).toContain(anchor);
    }
  });
});

describe("docs/CLI.md", () => {
  const page = readFileSync(join(ROOT, "docs", "CLI.md"), "utf8");
  const flagsTable = page.slice(page.indexOf("## Flags"), page.indexOf("## Exit codes"));
  const documented = [...flagsTable.matchAll(/^\| `--([a-z-]+)`/gm)].map((m) => m[1]);

  it("names every flag the parser accepts, and none it does not", () => {
    expect([...documented].sort()).toEqual(Object.keys(OPTIONS).sort());
  });

  it("names each flag's short form where it has one", () => {
    for (const [name, option] of Object.entries(OPTIONS)) {
      if ("short" in option) expect(flagsTable).toContain(`\`--${name}\`, \`-${option.short}\``);
    }
  });
});

describe("the README", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  it.each(readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md") && f !== "README.md"))(
    "links docs/%s from its Documentation table",
    (file) => expect(readme).toContain(`](docs/${file})`),
  );
});
