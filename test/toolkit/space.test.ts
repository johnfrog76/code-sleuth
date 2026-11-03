import { describe, expect, it } from "vitest";
import { cleanRemote } from "../../src/case/repoInfo.js";
import { type SpaceAddress, spaceForOrigin } from "../../src/toolkit/space.js";

const spaces: SpaceAddress[] = [
  { slug: "widget", org: "https://github.com/owner/widget", repos: [] },
  { slug: "board", org: "https://dev.azure.com/acme", repos: ["Api", "web-app"] },
  { slug: "loose", org: null, repos: ["widget"] },
];
const own = (url: string | null, list = spaces) =>
  spaceForOrigin(url === null ? null : cleanRemote(url), list);

describe("the Space whose address is the repository's origin", () => {
  it.each([
    ["https://github.com/owner/widget.git", "widget"],
    ["git@github.com:owner/widget.git", "widget"],
    ["https://user:token@github.com/Owner/Widget", "widget"],
    ["https://acme@dev.azure.com/acme/Shop/_git/web-app", "board"],
    ["git@ssh.dev.azure.com:v3/acme/Shop/api", "board"],
  ])("%s is %s", (url, slug) => {
    expect(own(url)).toBe(slug);
  });

  it.each([
    ["no origin", null],
    ["another GitHub repository", "https://github.com/owner/gadget"],
    ["a fork of it", "https://github.com/someone/widget"],
    ["a repository the Azure DevOps Space does not list", "https://dev.azure.com/acme/Shop/_git/other"],
    ["another Azure DevOps organisation", "https://dev.azure.com/other/Shop/_git/web-app"],
  ])("is none for %s", (_, url) => {
    expect(own(url)).toBeUndefined();
  });

  it("is none when two Spaces name the same address", () => {
    const twice = [...spaces, { slug: "again", org: "https://github.com/owner/widget/", repos: [] }];
    expect(own("https://github.com/owner/widget", twice)).toBeUndefined();
  });
});
