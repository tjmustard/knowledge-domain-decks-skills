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
import { ROOT, loadCards } from "../../scripts/lib/deck.mjs";

const require = createRequire(import.meta.url);
const { renderSvg } = require("../../scripts/svg.js");

const here = join(ROOT, "packages", "prepress");
const buildDir = join(here, "build");
const svgDir = join(buildDir, "svg");
const distDir = join(here, "dist");

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
    ...card,
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
  { cwd: here, encoding: "utf8" }
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
