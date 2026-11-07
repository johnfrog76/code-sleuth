#!/usr/bin/env node
// Renders the SVG atoms to images with headless Chrome. A dev tool only: never part of `npm test`, nor any CI.
//
//   node scripts/render-atoms.mjs preview <folder>   every atom and pose, light and dark, and the mark at 16 px
//   node scripts/render-atoms.mjs assets             writes the images that ship: assets/*
//   node scripts/render-atoms.mjs site               writes the still sloths, the stamps and the tokens the project's page uses: site/*
//
// It compiles src/atoms to .atoms-build/ (gitignored), renders each atom with react-dom/server, and asks Chrome
// for a screenshot of a page holding them. It needs Google Chrome or Chromium; CHROME names another binary.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const BUILD = join(ROOT, ".atoms-build");

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    console.error("Error: Chrome isn't here, and this script renders the atoms with it.");
    console.error("Hint: install Google Chrome or Chromium, or set CHROME to its binary.");
    process.exit(2);
  }
  return found;
}

async function loadAtoms() {
  rmSync(BUILD, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [
      join(ROOT, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(ROOT, "src", "atoms"),
      "--outDir",
      BUILD,
      "--noEmit",
      "false",
      "--declaration",
      "false",
    ],
    { stdio: "inherit" },
  );
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const atoms = await import(pathToFileURL(join(BUILD, "src", "atoms", "atoms.js")).href);
  const svg = (element) => renderToStaticMarkup(element);
  return { h: React.createElement, svg, atoms };
}

function screenshot(chrome, html, out, width, height, scale = 1, transparent = false) {
  const page = mkdtempSync(join(tmpdir(), "code-sleuth-render-"));
  try {
    const file = join(page, "page.html");
    writeFileSync(file, html);
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--virtual-time-budget=5000",
        `--force-device-scale-factor=${scale}`,
        `--window-size=${width},${height}`,
        ...(transparent ? ["--default-background-color=00000000"] : []),
        `--screenshot=${out}`,
        pathToFileURL(file).href,
      ],
      { stdio: "ignore" },
    );
  } finally {
    rmSync(page, { recursive: true, force: true });
  }
}

const page = (body, bg = "#ffffff") =>
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}body{font:14px Helvetica,Arial,sans-serif}</style>${body}`;

const [mode, folder] = process.argv.slice(2);
const chrome = findChrome();
const { h, svg, atoms } = await loadAtoms();
const { SleuthAtom, StampAtom, LogoMark, LogoLockup, POSES, jungleCss, verdictCss } = atoms;

if (mode === "preview") {
  if (!folder) throw new Error("preview needs a folder to write into");
  mkdirSync(folder, { recursive: true });
  for (const [theme, bg, ink] of [
    ["light", "#ffffff", "#1f2328"],
    ["dark", "#0d1117", "#e6edf3"],
  ]) {
    const cell = (label, inner) =>
      `<figure style="margin:12px;display:inline-block;vertical-align:top;text-align:center;color:${ink}">${inner}<figcaption>${label}</figcaption></figure>`;
    const poses = POSES.map((pose) =>
      cell(pose, svg(h(SleuthAtom, { pose, title: `The sleuth, ${pose}`, width: 220, still: true }))),
    ).join("");
    const stamps = ["MET", "NEARLY MET", "NOT MET"]
      .map((word) => cell(word, svg(h(StampAtom, { word, title: word, width: 220, still: true, theme }))))
      .join("");
    const marks = [128, 64, 32, 16]
      .map((size) => cell(`${size} px`, svg(h(LogoMark, { title: "Code Sleuth", size }))))
      .join("");
    const lockup = cell(
      "lockup",
      svg(h(LogoLockup, { title: "Code Sleuth", name: "Code Sleuth", height: 72, theme })),
    );
    screenshot(
      chrome,
      page(`<div style="padding:12px">${poses}<br>${stamps}<br>${marks}${lockup}</div>`, bg),
      join(folder, `atoms-${theme}.png`),
      1500,
      1250,
      2,
    );
    // The 16 px mark, rendered at its real size and blown up 8 times pixel for pixel: what a tab shows, made visible.
    const tiny = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(h(LogoMark, { title: "Code Sleuth", size: 16 })))}`;
    screenshot(
      chrome,
      page(
        `<canvas id="c" width="16" height="17" style="width:128px;height:136px;image-rendering:pixelated;margin:16px"></canvas><script>const i=new Image();i.onload=()=>document.getElementById("c").getContext("2d").drawImage(i,0,0);i.src=${JSON.stringify(tiny)};</script>`,
        bg,
      ),
      join(folder, `mark-16px-x8-${theme}.png`),
      160,
      168,
      1,
    );
    // The mark at its real 16 px, with no scaling: what a browser tab shows.
    screenshot(
      chrome,
      page(svg(h(LogoMark, { title: "Code Sleuth", size: 16 })), bg),
      join(folder, `mark-16px-${theme}.png`),
      16,
      17,
      1,
    );
  }
  console.log(`Wrote the previews to ${folder}`);
} else if (mode === "assets") {
  const assets = join(ROOT, "assets");
  mkdirSync(assets, { recursive: true });
  const mark = (size) => svg(h(LogoMark, { title: "Code Sleuth", size }));
  writeFileSync(
    join(assets, "logo.svg"),
    svg(h(LogoLockup, { title: "Code Sleuth", name: "Code Sleuth", height: 96, theme: "light" })) + "\n",
  );
  writeFileSync(
    join(assets, "logo-dark.svg"),
    svg(h(LogoLockup, { title: "Code Sleuth", name: "Code Sleuth", height: 96, theme: "dark" })) + "\n",
  );
  writeFileSync(join(assets, "favicon.svg"), mark(32) + "\n");
  screenshot(
    chrome,
    page(
      `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px">${mark(30)}</div>`,
      "transparent",
    ),
    join(assets, "favicon.png"),
    32,
    32,
    1,
    true,
  );
  const social = `<div style="width:1280px;height:640px;display:flex;align-items:center;justify-content:center;gap:56px;background:#1c1712">${svg(h(SleuthAtom, { pose: "tipping-hat", title: "The sleuth", width: 300, still: true }))}${svg(h(LogoLockup, { title: "Code Sleuth", name: "Code Sleuth", height: 120, theme: "dark" }))}</div>`;
  screenshot(chrome, page(social, "#1c1712"), join(assets, "social-preview.png"), 1280, 640, 1);
  console.log(
    "Wrote assets/logo.svg, assets/logo-dark.svg, assets/favicon.svg, assets/favicon.png and assets/social-preview.png",
  );
} else if (mode === "site") {
  const site = join(ROOT, "site");
  for (const pose of ["tipping-hat", "reading", "holding-door", "pointing", "holding-page"]) {
    writeFileSync(
      join(site, `sloth-${pose}.svg`),
      svg(h(SleuthAtom, { pose, title: "The sloth private eye", width: 300, still: true })) + "\n",
    );
  }
  for (const word of ["MET", "NEARLY MET", "NOT MET"]) {
    const name = word.toLowerCase().replace(" ", "-");
    writeFileSync(
      join(site, `stamp-${name}.svg`),
      svg(h(StampAtom, { word, title: word, width: 200, still: true, theme: "auto" })) + "\n",
    );
  }
  writeFileSync(
    join(site, "tokens.css"),
    `/* Written by scripts/render-atoms.mjs from the verdict and jungle tokens in src/atoms/figures.tsx. */\n\n${verdictCss()}\n${jungleCss()}`,
  );
  console.log("Wrote the sloths, the stamps and tokens.css to site/");
} else {
  console.error("Error: say preview <folder>, assets or site.");
  console.error("Hint: node scripts/render-atoms.mjs preview <folder>");
  process.exit(2);
}
