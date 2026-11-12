import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { copy as caseCopy } from "../src/case/copy.js";
import { copy as cliCopy } from "../src/cli/copy.js";
import { needReasons, refusedReasons, tooLargeReasons } from "../src/engine/copy.js";

// scripts/check-decoy-case.mjs runs in the periodic audit without a build, so it carries Code Sleuth's words
// as text. This holds each one to the copy file it comes from: a change to the words fails here, not there.
const checker = readFileSync(new URL("../scripts/check-decoy-case.mjs", import.meta.url), "utf8");

describe("the decoy case's checker", () => {
  it("expects Code Sleuth's own words, as the copy files hold them", () => {
    const counts = { "smoking-gun": 4, "loose-end": 6, hunch: 3, clean: 8, "not-investigated": 3 };
    const words = [
      refusedReasons.leadsOutside("../outside.txt", 0),
      tooLargeReasons.text("big.txt", 0),
      tooLargeReasons.history,
      needReasons.network,
      needReasons.denyList,
      `${caseCopy.stamp["not-met"]}  ${caseCopy.verdictLine("public", "not-met", counts)}`,
      `Error: ${cliCopy.toolkit.offline}`,
      `Hint: ${cliCopy.toolkit.offlineHint}`,
      cliCopy.run.polish,
    ];
    for (const text of words) expect(checker, text).toContain(JSON.stringify(text));
  });

  it("knows how the words for a key that was found begin", () => {
    const keySet = /keySet: "([^"]+)"/.exec(checker)?.[1];
    expect(keySet).toBeDefined();
    expect(caseCopy.polish.keySet()).toMatch(new RegExp(`^${keySet}[: ]`));
    expect(caseCopy.polish.keySet("the environment")).toMatch(new RegExp(`^${keySet} `));
  });

  it("knows every verdict stamp", () => {
    for (const stamp of Object.values(caseCopy.stamp))
      expect(checker).toMatch(new RegExp(`[(|]${stamp}[|)]`));
  });
});
