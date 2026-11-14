// `npm run smoke:landing` -- the project's page and the deck page, in a browser, as Pages serves them.
//
// It builds web/ (unless --no-build), puts the two pages together by running the Pages workflow's own
// "Assemble the page" step (.github/workflows/pages.yml), serves the result on a local port, and holds:
//
//   1. The project's page shows "Watch the video", and it opens the deck page at deck/.
//   2. The deck page plays the registered deck: slide 1 on screen, "1 / N" in the bar.
//   3. Every baked clip is in the build and answers 200 as audio.
//   4. Escape leaves the deck for the project's page.
//   5. On a phone, 390 px wide: neither page scrolls sideways, and slide 1 is on screen.
//   6. Neither page logs an error.
//
// It needs no network and no server of its own: a browser is enough. It drives the machine's Chrome
// (CHROME_PATH names another Chromium-based browser).
//
// Options:
//   --no-build        use web/dist as it is
//   --shots <dir>     save screenshots there
//   --serve           after the checks, keep serving and print the address (stop with Ctrl+C)
//   --host <addr>     the address to listen on (default 127.0.0.1)
//   --port <n>        the port (default: any free one)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const VOICES = path.join(WEB_ROOT, "src", "deck", "voices");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".json": "application/json",
};

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const shots = option("--shots");
const host = option("--host") ?? "127.0.0.1";
const port = Number(option("--port") ?? 0);

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

// 1. Build, then assemble the pages with the workflow's own step, in a scratch folder.
if (!args.includes("--no-build")) {
  const built = spawnSync("npm", ["run", "build"], {
    cwd: WEB_ROOT,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (built.status !== 0) throw new Error("npm run build failed in web/");
}

const workflow = fs.readFileSync(path.join(REPO_ROOT, ".github", "workflows", "pages.yml"), "utf8");
const step = /- name: Assemble the page\n\s+run: \|\n((?:\s{10}.*\n)+)/.exec(workflow);
if (!step) throw new Error('pages.yml has no "Assemble the page" step to run');
const assemble = step[1]
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .join("\n");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "code-sleuth-pages-"));
fs.symlinkSync(path.join(REPO_ROOT, "site"), path.join(scratch, "site"), "dir");
fs.symlinkSync(WEB_ROOT, path.join(scratch, "web"), "dir");
const ran = spawnSync("bash", ["-e", "-c", assemble], { cwd: scratch, stdio: "inherit" });
if (ran.status !== 0) throw new Error("the Assemble the page step failed");
const SITE = path.join(scratch, "_pages");

// 2. Serve it, as Pages would: a folder answers with its index.html.
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let file = path.join(SITE, decodeURIComponent(url.pathname));
  if (!file.startsWith(SITE)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(port, host, done));
const address = server.address();
const BASE = `http://${host.includes(":") ? `[${host}]` : host}:${address.port}/`;

// The deck the page plays: the first in the registry, by id, and its slide 1 title.
const registry = fs.readFileSync(path.join(WEB_ROOT, "src", "deck", "decks", "index.ts"), "utf8");
const deckIds = fs.readdirSync(VOICES).filter((name) => fs.statSync(path.join(VOICES, name)).isDirectory());
check(
  deckIds.length > 0 && deckIds.every((id) => registry.includes(`./${id}`)),
  "a deck is registered, with its voices",
);

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
);
const errors = [];
const open = async (viewport) => {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return page;
};
const shot = async (page, name) => {
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
  }
};
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

try {
  // The project's page, on a desktop.
  const desk = await open({ width: 1280, height: 800 });
  await desk.goto(BASE);
  const video = desk.locator('[data-cta="video"]');
  check(await video.isVisible(), 'the project\'s page shows "Watch the video"');
  check((await video.getAttribute("href")) === "deck/", "it links the deck page, deck/");
  await shot(desk, "landing-desktop");

  // The deck page, opened from it.
  await video.click();
  await desk.waitForURL(`${BASE}deck/`);
  const counter = desk.getByText(/^\s*1\s*\/\s*\d+\s*$/).first();
  await counter.waitFor({ timeout: 15_000 }).catch(() => {});
  check(await counter.isVisible(), 'the deck page plays the deck: "1 / N" in its bar');
  const title = desk.locator("h1, h2").first();
  check(
    (await title.isVisible()) && (await title.innerText()).trim().length > 0,
    "slide 1's title is on screen",
  );
  await desk.waitForTimeout(1500);
  await shot(desk, "deck-slide-1-desktop");

  // Every baked clip is in the build and answers as audio.
  const baked = deckIds.flatMap((id) =>
    fs.readdirSync(path.join(VOICES, id)).filter((n) => n.endsWith(".mp3")),
  );
  const built = fs.readdirSync(path.join(SITE, "deck", "assets")).filter((name) => name.endsWith(".mp3"));
  check(
    built.length === baked.length,
    `every baked clip is in the build (${built.length} of ${baked.length})`,
  );
  let answered = 0;
  for (const name of built) {
    const response = await fetch(`${BASE}deck/assets/${name}`);
    if (response.ok && response.headers.get("content-type") === "audio/mpeg") answered += 1;
  }
  check(answered === built.length, "each clip answers 200 as audio");

  // Escape leaves the deck for the project's page.
  await desk.keyboard.press("Escape");
  await desk.waitForURL(BASE, { timeout: 5_000 }).catch(() => {});
  check(desk.url() === BASE, "Escape leaves the deck for the project's page");

  // A phone.
  const phone = await open({ width: 390, height: 844 });
  await phone.goto(BASE);
  check(!(await sideways(phone)), "on a phone, the project's page does not scroll sideways");
  await shot(phone, "landing-phone");
  await phone.goto(`${BASE}deck/`);
  const phoneCounter = phone.getByText(/^\s*1\s*\/\s*\d+\s*$/).first();
  await phoneCounter.waitFor({ timeout: 15_000 }).catch(() => {});
  check(await phoneCounter.isVisible(), "on a phone, the deck page plays slide 1");
  check(!(await sideways(phone)), "on a phone, the deck page does not scroll sideways");
  await phone.waitForTimeout(1500);
  await shot(phone, "deck-slide-1-phone");

  // A browser may refuse sound before a press; that is not an error of the page's.
  const real = errors.filter((text) => !/play\(\) failed|NotAllowedError|user didn't interact/i.test(text));
  check(real.length === 0, `neither page logs an error${real.length ? `: ${real.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}

console.log(failures.length === 0 ? "\nAll checks passed." : `\n${failures.length} check(s) failed.`);
if (args.includes("--serve")) {
  console.log(`Serving ${BASE} (the project's page) and ${BASE}deck/ (the deck page). Ctrl+C stops it.`);
} else {
  server.close();
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exitCode = failures.length === 0 ? 0 : 1;
}
