#!/usr/bin/env node
/*
 * Measure every diagram label in every deck, in the face the print build uses.
 *
 * This exists because DECISIONS 30 quotes label bounds - 505 labels across 437
 * cards, the smallest clearance 14.09 units, captions at 46 and 47 characters -
 * and those numbers were, until now, a report of one run of a harness that was
 * never committed. They are load-bearing: after the font pin they are the only
 * guard on label width, because check-fit scans ink inside the safe columns and
 * cannot see a label overrunning a side edge.
 *
 * To reproduce §30's figures on a machine with Chrome installed, run exactly:
 *
 *   node scripts/measure-labels.mjs
 *
 * On a clean tree at this commit that prints "505 labels on 136 cards across
 * 4 deck(s)", a tightest clearance of 14.0938 units (4.5664 pt) on DEC-11's
 * "EARLY: CONSIDERED", the longest label at 47 characters and 253.8125 units
 * (TME-10), and EVEN SPLIT at 5.3333 units. It exits 0.
 *
 * One deck at a time, and the tightest few labels only:
 *
 *   node scripts/measure-labels.mjs --deck ux-laws --tight 20
 *
 * The script is OPT-IN and is not called by any gate, CI job or npm script run
 * by `npm test` or `npm run accept`. Chrome is not a build dependency; the
 * enforced guards stay check-fit (vertical ink) and check-pdf (the embedded
 * face). No measurement output is committed: a committed table would need a
 * gate to keep it fresh, and there is none.
 *
 * The measurement is Chrome's own getBBox on each <text> element with the
 * vendored TTF loaded through @font-face, so the numbers are the rendered
 * geometry, not an advance-width calculation. Chrome must be told to load the
 * face before anything is measured: document.fonts.ready resolves without
 * loading an unused face, which is how a harness silently measures the
 * fallback. The check below refuses to report numbers if the face did not load.
 *
 * Every label is also compared against the 400-unit viewBox. check-fit scans
 * ink inside the safe columns and cannot see a label overrunning a side edge,
 * so this script is where that is caught.
 *
 * Exit codes: 0 when every label was measured and lies inside the box; 1 when
 * a label overruns the box (each is named with its width and the edge it
 * crosses) or when Chrome ran but the harness failed; 2 when Chrome is missing
 * (unknown, not a pass - the same convention as the rest of the gate).
 *
 * The overrun exit is deliberate and documented because it is the acceptance
 * probe: lengthen a label past the box in a record and this same command exits
 * 1 naming the label. Nothing else in the repository runs the script, so the
 * only way to trigger it is to run it or break a label.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { deckArgs, deckShape, loadCards, loadDecks } from "../packages/core/deck.mjs";

const require = createRequire(import.meta.url);
const { renderSvg } = require("../packages/core/svg.js");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FONTS = join(ROOT, "packages", "prepress", "fonts");

const argv = process.argv.slice(2);
function option(name, fallback = null) {
  const at = argv.indexOf(name);
  if (at === -1) return fallback;
  const value = argv[at + 1];
  return value === undefined || value.startsWith("--") ? fallback : value;
}
const chromeFlag = option("--chrome") || process.env.CHROME_PATH;
const tightCount = Number(option("--tight", "0")) || 0;

// Chrome is looked for where it actually lives on the two platforms this
// repository is built on; --chrome or CHROME_PATH wins so a reader whose
// browser is elsewhere does not have to edit the script.
function findChrome() {
  if (chromeFlag) return existsSync(chromeFlag) ? chromeFlag : null;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium"
  ];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  // A Chrome installed outside those paths can still be on PATH.
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      execFileSync("which", [name], { stdio: "pipe" });
      return name;
    } catch {
      // not on PATH
    }
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error(
    "NOT RUN: Chrome was not found" +
      (chromeFlag ? ` at ${chromeFlag}` : "") +
      ", so no label can be measured - unknown, not a pass.\n" +
      "Install Chrome, or pass --chrome <path> (or set CHROME_PATH). " +
      "This script is opt-in: no gate, CI job or npm script calls it."
  );
  process.exit(2);
}

const decks = await loadDecks(deckArgs());
const cards = [];
for (const deck of decks) {
  const shape = deckShape(deck);
  for (const card of await loadCards(deck)) {
    const svg = renderSvg(shape.figure(card));
    if (!svg.includes("<text")) continue;
    cards.push({ deck: deck.slug, card: card.id, svg: svg.replace(/<\?xml[^>]*\?>/, "") });
  }
}

if (cards.length === 0) {
  console.log("No card in scope prints a diagram label, so there is nothing to measure.");
  process.exit(0);
}

// The vendored files are inlined rather than served, so the page has no
// dependencies and no path that differs between machines.
const faces = [
  ["JetBrainsMono-Regular.ttf", 400],
  ["JetBrainsMono-SemiBold.ttf", 600],
  ["JetBrainsMono-Bold.ttf", 700]
]
  .map(([file, weight]) => {
    const data = readFileSync(join(FONTS, file)).toString("base64");
    return (
      `@font-face{font-family:"JetBrains Mono";font-weight:${weight};` +
      `src:url(data:font/ttf;base64,${data}) format("truetype");}`
    );
  })
  .join("\n");

const html = `<!doctype html><meta charset="utf-8"><style>${faces}</style>
<body><pre id="result">PENDING</pre>
<div id="stage" style="position:absolute;left:-10000px;top:0"></div>
<script>
const DATA = ${JSON.stringify(cards)};
const stage = document.getElementById("stage");

// Distance from a label's ink box to the nearest drawn geometry. Bounding
// boxes are not enough: a curve's box spans the whole plot, so a label beneath
// the curve would report a zero gap against a line that is nowhere near it.
// Circles are measured to their edge, and every other outline is sampled.
const pointGap = (b, px, py) =>
  Math.hypot(
    Math.max(b.x - px, 0, px - (b.x + b.w)),
    Math.max(b.y - py, 0, py - (b.y + b.h))
  );
function shapeGap(b, el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "circle") {
    const cx = +el.getAttribute("cx");
    const cy = +el.getAttribute("cy");
    const r = +el.getAttribute("r");
    return Math.max(0, Math.hypot(
      Math.max(b.x - cx, 0, cx - (b.x + b.w)),
      Math.max(b.y - cy, 0, cy - (b.y + b.h))
    ) - r);
  }
  const box = el.getBBox();
  if (tag === "rect") {
    return Math.hypot(
      Math.max(box.x - (b.x + b.w), b.x - (box.x + box.width), 0),
      Math.max(box.y - (b.y + b.h), b.y - (box.y + box.height), 0)
    );
  }
  const total = el.getTotalLength();
  if (!total) return Infinity;
  const step = Math.max(0.5, total / 480);
  let best = Infinity;
  for (let at = 0; at <= total; at += step) {
    const p = el.getPointAtLength(at);
    const d = pointGap(b, p.x, p.y);
    if (d < best) best = d;
  }
  return best;
}
function nearestMark(b, svg) {
  let best = Infinity;
  for (const el of svg.querySelectorAll("rect,circle,line,path,polyline,polygon")) {
    const d = shapeGap(b, el);
    if (d < best) best = d;
  }
  return best;
}

(async () => {
  // document.fonts.ready alone resolves without loading a face that nothing
  // has used yet, which leaves the fallback to be measured. Load each weight.
  await document.fonts.load('400 9px "JetBrains Mono"');
  await document.fonts.load('600 9px "JetBrains Mono"');
  await document.fonts.load('700 9px "JetBrains Mono"');
  await document.fonts.ready;
  const faceLoaded = document.fonts.check('600 9px "JetBrains Mono"');
  const out = [];
  for (const card of DATA) {
    const host = document.createElement("div");
    host.innerHTML = card.svg;
    stage.appendChild(host);
    const svg = host.querySelector("svg");
    if (!svg) { out.push({ deck: card.deck, card: card.card, error: "no svg" }); continue; }
    const texts = [...svg.querySelectorAll("text")].map((el) => {
      const b = el.getBBox();
      // Nearest-mark distance takes the plain box, not the DOMRect: the box
      // uses w/h, and handing it a DOMRect left every gap NaN.
      const box = { x: b.x, y: b.y, w: b.width, h: b.height };
      return {
        text: el.textContent,
        size: el.getAttribute("font-size"),
        weight: el.getAttribute("font-weight") || "400",
        chars: el.textContent.length,
        w: +b.width.toFixed(4),
        left: +b.x.toFixed(4),
        right: +(400 - (b.x + b.width)).toFixed(4),
        top: +b.y.toFixed(4),
        bottom: +(400 - (b.y + b.height)).toFixed(4),
        gap: +nearestMark(box, svg).toFixed(4)
      };
    });
    out.push({ deck: card.deck, card: card.card, texts });
    stage.removeChild(host);
  }
  // The result is base64 so the dumped DOM cannot escape it into something
  // that no longer parses; it also keeps the marker word out of the script
  // source, where a regex over the whole DOM would match it.
  const b64 = (value) => btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  document.getElementById("result").textContent = "RESULT" + b64({ faceLoaded, out }) + "END";
})().catch((error) => {
  const b64 = (value) => btoa(unescape(encodeURIComponent(String(value))));
  document.getElementById("result").textContent = "ERROR" + b64(error && error.stack || error) + "END";
});
</script></body>`;

const dir = await mkdtemp(join(tmpdir(), "measure-labels-"));
try {
  const file = join(dir, "harness.html");
  await writeFile(file, html);
  let dom;
  try {
    dom = execFileSync(
      chrome,
      [
        "--headless=new", "--disable-gpu", "--no-sandbox",
        "--allow-file-access-from-files", "--virtual-time-budget=30000",
        "--dump-dom", pathToFileURL(file).href
      ],
      { encoding: "utf8", maxBuffer: 200 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    const said = String(error.stderr || "").trim();
    console.error(`Chrome exited ${error.status} without a result` + (said ? `:\n${said}` : "."));
    process.exit(1);
  }

  const marker = dom.match(/<pre id="result">([^<]*)<\/pre>/s);
  if (!marker) {
    console.error("the result element did not survive the DOM dump; the first 500 characters were:\n" + dom.slice(0, 500));
    process.exit(1);
  }
  const payload = marker[1];
  const errorMatch = payload.match(/^ERROR([A-Za-z0-9+/=]+)END$/);
  if (errorMatch) {
    console.error(`the measuring page failed:\n${Buffer.from(errorMatch[1], "base64").toString("utf8")}`);
    process.exit(1);
  }
  const match = payload.match(/^RESULT([A-Za-z0-9+/=]+)END$/);
  if (!match) {
    console.error(`unexpected result element: ${payload.slice(0, 200)}`);
    process.exit(1);
  }
  const { faceLoaded, out } = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  if (!faceLoaded) {
    console.error(
      "JetBrains Mono did not load from packages/prepress/fonts, so these boxes " +
        "would be the fallback's. Refusing to report them."
    );
    process.exit(1);
  }

  const rows = [];
  for (const card of out) {
    if (card.error) {
      console.error(`${card.deck} ${card.card}: ${card.error}`);
      continue;
    }
    for (const t of card.texts) {
      const edge = Math.min(t.left, t.right, t.top, t.bottom);
      rows.push({ deck: card.deck, card: card.card, ...t, edge });
    }
  }

  const decksSeen = [...new Set(rows.map((row) => row.deck))];
  console.log(
    `${faceLoaded ? "JetBrains Mono" : "fallback"} via @font-face; ` +
      `${rows.length} labels on ${out.length} cards across ${decksSeen.length} deck(s).`
  );
  console.log("");
  const byEdge = [...rows].sort((a, b) => a.edge - b.edge);
  for (const row of tightCount > 0 ? byEdge.slice(0, tightCount) : rows) {
    console.log(
      `${row.deck}\t${row.card}\t${String(row.chars).padStart(2)}\t` +
        `${row.w.toFixed(4).padStart(9)}\t${row.size}\t${row.weight}\t` +
        `${row.gap === null ? "  n/a" : row.gap.toFixed(4).padStart(9)}\t` +
        `${row.text.replace(/\s+/g, " ")}`
    );
  }
  console.log("");

  const tightest = byEdge[0];
  console.log(
    `tightest clearance: ${tightest.edge.toFixed(4)} units ` +
      `(${(tightest.edge * 0.324).toFixed(4)} pt) - ${tightest.deck} ${tightest.card} ` +
      `"${tightest.text}" at size ${tightest.size}`
  );
  const widest = [...rows].sort((a, b) => b.w - a.w)[0];
  console.log(
    `longest label: ${widest.chars} characters, ${widest.w.toFixed(4)} units ` +
      `- ${widest.deck} ${widest.card} "${widest.text}"`
  );
  const byGap = rows.filter((row) => row.gap !== null).sort((a, b) => a.gap - b.gap);
  const tightGap = byGap[0];
  if (tightGap) {
    console.log(
      `tightest gap to a drawn mark: ${tightGap.gap.toFixed(4)} units ` +
        `(${(tightGap.gap * 0.324).toFixed(4)} pt) - ${tightGap.deck} ${tightGap.card} ` +
        `"${tightGap.text}"`
    );
  }
  // The acceptance probe: lengthen a label past the box and this is the
  // failure. check-fit cannot see a side edge, so an overrun is named here or
  // not at all.
  const outside = rows.filter((row) => row.edge < 0);
  if (outside.length === 0) {
    console.log("OK: every label lies inside the 400-unit box.");
  } else {
    console.error(`${outside.length} label(s) overrun the 400-unit box:`);
    for (const row of outside) {
      const crossed = [
        ["left", row.left],
        ["right", row.right],
        ["top", row.top],
        ["bottom", row.bottom]
      ]
        .filter(([, clear]) => clear < 0)
        .map(([edge, clear]) => `${edge} by ${(-clear).toFixed(4)} units`)
        .join(" and ");
      console.error(
        `OVER ${row.deck} ${row.card} "${row.text}" width ${row.w.toFixed(4)} units, crosses the ${crossed}`
      );
    }
    process.exitCode = 1;
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
