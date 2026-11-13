import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sleuth } from "../helpers/cli.js";
import { investigateAsync } from "../helpers/investigate.js";
import { withScratch } from "../helpers/scratch.js";

// The project's page says what the code does, so what it shows is held to the code: its sample to a real run on
// the fixture it came from, its try-it line to the quick start, its flags to the command's reference.
const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const page = read("site/index.html");

/** Text with its tags taken out, again until none is left, so a tag split by another cannot come back. */
function withoutTags(html: string): string {
  let before: string;
  do {
    before = html;
    html = html.replace(/<[^>]*>/g, "");
  } while (html !== before);
  return html;
}

/** The text of a sample on the page, by its data-sample name. */
function sample(name: string): string {
  const found = new RegExp(`data-sample="${name}">([^]*?)</code>`).exec(page);
  if (!found) throw new Error(`no ${name} sample on the page`);
  return withoutTags(found[1]!).replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

describe("the project's page", () => {
  it("shows only lines a real run prints, and a card it writes", async () => {
    await withScratch(async (out) => {
      const run = await investigateAsync("whole/messy", (repo) =>
        sleuth([repo, "--goal", "public", "--offline", "--out", out], {
          casesFolder: join(out, "default"),
          env: { NO_COLOR: "1" },
        }),
      );
      for (const line of sample("checklist").split("\n").filter(Boolean)) expect(run.stdout).toContain(line);

      const folder = (
        readdirSync(out, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[]
      ).find(
        (entry) =>
          entry.isFile() && entry.name.endsWith("add-a-ci-workflow-that-runs-on-push-and-pull-request.md"),
      );
      if (!folder) throw new Error("the run wrote no CI card");
      const card = readFileSync(join(folder.parentPath, folder.name), "utf8");
      expect(card.startsWith(sample("card"))).toBe(true);
    });
  });

  it("gives the way to try it that the quick start gives", () => {
    expect(read("docs/QUICKSTART.md")).toContain(sample("try"));
  });

  it("names only flags the command's reference knows", () => {
    const flags = [...page.matchAll(/<code>(--[a-z-]+)<\/code>/g)].map((match) => match[1]!);
    expect(flags).toEqual(expect.arrayContaining(["--polish", "--offline", "--toolkit"]));
    const reference = read("docs/CLI.md");
    for (const flag of flags) expect(reference).toContain(flag);
  });

  it("finds every local file it points at", () => {
    const local = [...page.matchAll(/(?:src|srcset|href)="([^"#]+)"/g)]
      .map((match) => match[1]!)
      .filter((path) => !/^https?:/.test(path));
    expect(local.length).toBeGreaterThan(5);
    const files = readdirSync(new URL("site/", root));
    expect(local.filter((path) => !files.includes(path))).toEqual([]);
  });

  it("loads no script, and nothing from another site", () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/<(?:link|img|source)[^>]+(?:href|src|srcset)="https?:/i);
    expect(read("site/site.css")).not.toMatch(/@import|url\(|@font-face/i);
  });

  // #103: the heading was an image of the name, and a machine without its font cut the last letter off.
  it("names itself in its heading as text, with the mark beside it as decoration", () => {
    const heading = /<h1 class="lp-title">([\s\S]*?)<\/h1>/.exec(page)?.[1];
    expect(heading).toBeDefined();
    const images = heading!.match(/<img\b[^>]*>/g) ?? [];
    for (const img of images) expect(img).toContain('alt=""');
    // Outside its images, the heading is the name and nothing else: no other element, no hidden word.
    expect(
      heading!
        .split(/<img\b[^>]*>/)
        .join("")
        .trim(),
    ).toBe("Code Sleuth");
    expect(heading).not.toContain("logo");
  });

  it("carries no label that hedges for it", () => {
    expect(page).not.toMatch(/disclaimer/i);
  });

  it("leads with the video, shown only once it has somewhere to go, and the README beside it", () => {
    const video = /<a\b[^>]*data-cta="video"[^>]*>/.exec(page)?.[0];
    expect(video).toBeDefined();
    // Until the video exists (#4) the button is hidden, with no link to be dead; once shown, it has one.
    if (/\shidden\b/.test(video!)) expect(video).not.toMatch(/href=/);
    else expect(video).toMatch(/href="https:\/\//);
    expect(page).toMatch(/data-cta="video"[^>]*>Watch the video</);
    const readme = /<a\b[^>]*data-cta="readme"[^>]*>([^<]*)</.exec(page);
    expect(readme?.[0]).toContain('href="https://github.com/johnfrog76/code-sleuth#readme"');
    expect(readme?.[1]!.trim()).toBe("Read the README");
  });
});
