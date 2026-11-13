import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The first command a stranger types runs npm, and npm reads the .npmrc of the folder it starts in. So every
// way to run Code Sleuth with npx that a person reads starts in their home folder, pins a release, and says
// why: the README, the docs, the project's page and the changelog's unreleased notes.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const { version } = JSON.parse(read("package.json")) as { version: string };

const NPX = /npx github:johnfrog76\/code-sleuth(\S*)/g;
const REASON = "reads the .npmrc of the folder it starts in";

/** The changelog's unreleased section and the section for this package's version, which is the release npx runs. */
function currentChangelog(body: string): string {
  const unreleased = body.split(/^## \[Unreleased\]$/m)[1]!.split(/^## \[/m)[0]!;
  const current = body
    .split(new RegExp(`^## \\[${version.replaceAll(".", "\\.")}\\].*$`, "m"))[1]
    ?.split(/^## \[/m)[0];
  return unreleased + (current ?? "");
}

/** A page's text as a person reads it: no tags, no code ticks, entities as their characters. */
function text(path: string): string {
  let body = read(path);
  // The changelog as it reads for the release being run: what is unreleased, and the package's own version.
  if (path === "CHANGELOG.md") body = currentChangelog(body);
  // &amp; last, so an escaped entity such as &amp;lt; reads as the text it is, not as <.
  return withoutTags(body)
    .replaceAll("`", "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** Text with its tags taken out, again until none is left, so a tag split by another cannot come back. */
function withoutTags(html: string): string {
  let before: string;
  do {
    before = html;
    html = html.replace(/<[^>]*>/g, "");
  } while (html !== before);
  return html;
}

const pages = [
  "README.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "site/index.html",
  ...readdirSync(new URL("docs/", root))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `docs/${name}`),
];

describe("the first command", () => {
  it("pins the package's own release wherever npx runs it from GitHub", () => {
    const mentions = pages.flatMap((path) =>
      [...text(path).matchAll(NPX)].map((match) => ({ path, spec: match[1]! })),
    );
    expect(mentions.map(({ path }) => path)).toEqual(
      expect.arrayContaining(["docs/QUICKSTART.md", "site/index.html", "CHANGELOG.md"]),
    );
    expect(mentions.filter(({ spec }) => spec !== `#v${version}`)).toEqual([]);
  });

  it("starts in the home folder, with a path to the repository, and says why", () => {
    for (const path of pages) {
      const body = text(path);
      // A command, wherever it sits (a code block, a sentence): `cd ~ && ` comes right before it.
      const commands = [...body.matchAll(/npx github:johnfrog76\/code-sleuth(\S*) \S+ --goal/g)];
      for (const command of commands) {
        expect(body.slice(Math.max(0, command.index - 8), command.index), path).toBe("cd ~ && ");
        expect(command[1], path).toBe(`#v${version}`);
      }
      if (commands.length > 0) expect(body.replace(/\s+/g, " "), path).toContain(REASON);
    }
  });

  it("tells the Windows shells that read the line differently how to start in the home folder", () => {
    const note = text("docs/QUICKSTART.md").replace(/\s+/g, " ");
    // PowerShell 5.1 has no &&; cmd does not read ~.
    expect(note).toContain("in PowerShell 5.1, which has no &&, run cd ~ first, then the npx line");
    expect(note).toContain("in cmd, which does not read ~, run cd %USERPROFILE% first, then the npx line");
  });

  it("says outside what Code Sleuth can defend what npm does before it starts", () => {
    expect(text("SECURITY.md").replace(/\s+/g, " ")).toContain(
      "What happens before Code Sleuth starts is outside what it can defend.",
    );
  });
});
