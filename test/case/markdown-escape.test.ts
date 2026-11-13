import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cardFile, codeSpan, inlineText } from "../../src/case/card.js";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The code review's medium finding 13: text from the repository went into case.md and the cards as markdown,
// so a file's name, a branch, a folder's name or an excerpt could add a heading, a ticked line or HTML.

/** case.md and every card a run wrote, by name. */
async function run(
  fixture: { name: string; files: Record<string, string> },
  prepare?: (root: string) => void,
) {
  return withScratch(async (scratch) =>
    investigateAsync(
      fixture,
      async (root) => {
        await sleuth([root, "--goal", "public", "--offline", "--all", "--out", join(scratch, "cases")], {
          casesFolder: join(scratch, "default"),
        });
        const cases = join(scratch, "cases");
        const written: Record<string, string> = {};
        for (const name of readdirSync(cases, { recursive: true }) as string[])
          if (name.endsWith(".md")) written[name] = readFileSync(join(cases, name), "utf8");
        return written;
      },
      { git: true, ...(prepare ? { prepare } : {}) },
    ),
  );
}

const caseMd = (written: Record<string, string>) =>
  Object.entries(written).find(([n]) => n.endsWith("case.md"))![1];

/** The markdown outside its code spans: inside one, markup is shown as text. */
const outsideCode = (md: string) => md.replace(/(`+)[\s\S]*?\1/g, "");

describe("text from the repository, in case.md and the cards", () => {
  it("cannot add a heading, a ticked line or HTML through a file's name in a reason", async () => {
    const name =
      ".github/workflows/x\n## Clean\n- [x] **Secrets in the tree** all clean <img src=x onerror=alert(1)>\n.yml";
    const md = caseMd(
      await run({ name: "widget", files: { "README.md": "# widget\n", [name]: "on: [push\n  bad: :\n" } }),
    );
    expect(md.match(/^## Clean$/gm)).toHaveLength(1);
    expect(md).not.toMatch(/^- \[x\] \*\*Secrets in the tree\*\* all clean/m);
    expect(outsideCode(md)).not.toMatch(/(?<!\\)<img/);
  });

  it("cannot break out of a code span with a lone carriage return in an excerpt", async () => {
    const written = await run({
      name: "widget",
      files: {
        "README.md": "# widget\n",
        "conf.txt": 'a = "/Users/alice/proj"\r\r# INJECTED HEADING\r<script>x</script>\n', // code-sleuth:example
      },
    });
    for (const [name, text] of Object.entries(written)) {
      expect(text, name).not.toMatch(/^# INJECTED HEADING/m);
      expect(text, name).not.toMatch(/^<script>/im);
    }
  });

  it("cannot add a heading or HTML through the repository's folder name or its branch", async () => {
    const md = caseMd(
      await run(
        { name: "my`repo\n# Injected heading\n- [x] all clean", files: { "README.md": "# widget\n" } },
        (root) => execFileSync("git", ["branch", "-m", "<img/src=x/onerror=alert(1)>"], { cwd: root }),
      ),
    );
    expect(md).not.toMatch(/^# Injected heading/m);
    expect(md).not.toMatch(/^- \[x\] all clean/m);
    expect(outsideCode(md)).not.toMatch(/(?<!\\)<img/);
    expect(md).toContain("\\<img/src=x/onerror=alert(1)\\>");
  });
});

describe("the markdown helpers", () => {
  it("keeps a code span on one line, a lone CR included", () => {
    expect(codeSpan("a\rb\r\nc\nd")).toBe("`a b c d`");
  });

  it("escapes what markdown or HTML would read as markup, on one line", () => {
    expect(inlineText("a <b> [c](d) *e* _f_ `g`\n# h")).toBe(
      "a \\<b\\> \\[c\\](d) \\*e\\* \\_f\\_ \\`g\\` \\# h",
    );
  });

  it("writes a card's title on one line, whatever it holds", () => {
    const file = cardFile({
      file: "01-x.md",
      type: "Bug",
      title: "A token\r- [x] Already fixed\r## Context",
      body: "body",
    });
    expect(file.split("\n")[0]).toBe("# Bug: A token - [x] Already fixed ## Context");
  });
});
