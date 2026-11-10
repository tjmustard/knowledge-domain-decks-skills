#!/usr/bin/env node
/*
 * Build the print deck.
 *
 * 1. Generate one SVG per card from its graphicMetaphor data.
 * 2. Write build/cards.json for the Typst template.
 * 3. Run Typst to emit dist/ux-deck.pdf (one card per 3.00 x 5.00 in page).
 *
 * Typst is required. This script will not silently substitute another renderer.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, loadCards, withCitation } from "../../scripts/lib/deck.mjs";

const require = createRequire(import.meta.url);
const { renderSvg } = require("../../scripts/svg.js");

const here = join(ROOT, "packages", "prepress");
const buildDir = join(here, "build");
const svgDir = join(buildDir, "svg");
const distDir = join(here, "dist");

/*
 * Typst stamps the compile time into /ModDate and the XMP dates, and derives the
 * trailer /ID from them, so two builds of one commit differ in those fields even
 * when the file length is the same. Pinning SOURCE_DATE_EPOCH, the
 * reproducible-builds convention, removes that variable.
 *
 * The epoch is a fixed date rather than the commit time on purpose: an exported
 * tree or tarball has no git history, and a build there must produce the same
 * bytes as a build inside a checkout. An inherited SOURCE_DATE_EPOCH still wins,
 * so a distributor that repackages the deck can stamp their own.
 */
const DECK_EPOCH = 1794182400; // 2026-11-09T00:00:00Z, the deck's first release
let epoch = DECK_EPOCH;
let epochSource = "the deck's fixed release epoch";

const inherited = process.env.SOURCE_DATE_EPOCH;
if (inherited !== undefined && inherited !== "") {
  if (!/^\d+$/.test(inherited)) {
    console.error(
      `SOURCE_DATE_EPOCH must be whole seconds since 1970, got "${inherited}".`
    );
    process.exit(2);
  }
  epoch = Number(inherited);
  epochSource = "the environment";
}

const version = spawnSync("typst", ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error(
    "Typst is not installed (or not on PATH).\n" +
      "Install it, then rerun: npm run build:pdf\n" +
      "The template and this build script are ready; no other renderer is substituted."
  );
  process.exit(2);
}

const cards = await loadCards();
await mkdir(svgDir, { recursive: true });
await mkdir(distDir, { recursive: true });

const manifest = [];
for (const card of cards) {
  const svg = renderSvg(card.graphicMetaphor);
  const svgFile = join(svgDir, `${card.id}.svg`);
  await writeFile(svgFile, svg);
  manifest.push({
    ...withCitation(card),
    svgFile: `../build/svg/${card.id}.svg`
  });
}
await writeFile(
  join(buildDir, "cards.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

const result = spawnSync(
  "typst",
  ["compile", "--root", ".", "src/card.typ", "dist/ux-deck.pdf"],
  {
    cwd: here,
    encoding: "utf8",
    env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) }
  }
);
if (result.status !== 0) {
  console.error(result.stdout || "");
  console.error(result.stderr || "");
  console.error("Typst compile failed.");
  process.exit(result.status || 1);
}

console.log(
  `Typst ${version.stdout.trim()} built packages/prepress/dist/ux-deck.pdf ` +
  `(${cards.length * 2} pages: ${cards.length} cards, recto + verso).`
);
console.log(
  `SOURCE_DATE_EPOCH ${epoch} from ${epochSource}; ` +
  `rebuilds of this commit are byte-identical.`
);
