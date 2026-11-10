#!/usr/bin/env node
/*
 * Measure every printed card face against the template's safe content area.
 *
 * The print page is 3 x 5 in with 0.125 in of bleed and a 0.1875 in safe inset
 * measured from the trim line, so content should end above row 468.75 at
 * 100 ppi. Typst does not clip content to the block it is given: a back face
 * with too many words runs on past that line and is cut at the page edge, which
 * is a real defect that page boxes cannot see. Until this check existed,
 * vertical fit was a hand measurement (DECISIONS 37) - rendered, looked at, and
 * hoped to be repeated. It is now one command over every deck.
 *
 * Two lines are reported, because they answer different questions. Past the
 * trim line (row 487.5) is a defect: the text can be cut or trimmed off. Past
 * the safe inset but inside the trim is a warning: the page prints, but the
 * template's own promise is not kept, and the cushion that absorbs registration
 * error is gone. The check fails on the first and prints the second, so a deck
 * that shipped with a half-line in the cushion is reported rather than turned
 * red retroactively.
 *
 * The measurement is ink, not a character count: line breaks decide fit, and
 * two records with the same length can differ by several lines. Rendering the
 * pages costs a few seconds per deck, which is the price of a number that is
 * true.
 *
 * Exit 0 when every face fits, 1 when one does not, 2 when Typst is missing
 * (unknown, not a pass, the same convention as the rest of the gate).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { deckArgs, loadCards, loadDecks, orderCards } from "../packages/core/deck.mjs";

const PAGE_IN = 5;
const SAFE_IN = 0.3125;
const TRIM_IN = 0.125;
const PPI = 100;
const SAFE = Math.round((PAGE_IN - SAFE_IN) * PPI * 100) / 100;
const TRIM = Math.round((PAGE_IN - TRIM_IN) * PPI * 100) / 100;

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      color = body[9];
      if (body[12] !== 0) throw new Error("interlaced PNG is not supported");
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (depth !== 8 || (color !== 6 && color !== 2)) {
    throw new Error(`unexpected PNG format: depth ${depth}, colour type ${color}`);
  }
  const bpp = color === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const rowAt = y * stride;
    const prevAt = rowAt - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[pos + x];
      const left = x >= bpp ? out[rowAt + x - bpp] : 0;
      const up = y > 0 ? out[prevAt + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prevAt + x - bpp] : 0;
      let filled;
      if (filter === 0) filled = value;
      else if (filter === 1) filled = value + left;
      else if (filter === 2) filled = value + up;
      else if (filter === 3) filled = value + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        filled = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        throw new Error(`unknown PNG filter ${filter}`);
      }
      out[rowAt + x] = filled & 0xff;
    }
    pos += stride;
  }
  return { width, height, bpp, data: out };
}

// The lowest row carrying text, scanning inside the safe columns so the trim
// marks and the frame drawn in the bleed band are not mistaken for content.
function lowestInk(png) {
  const { width, height, bpp, data } = png;
  const from = Math.ceil(SAFE_IN * PPI) + 2;
  const to = width - from;
  let lowest = -1;
  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    for (let x = from; x < to; x += 1) {
      const at = (y * width + x) * bpp;
      if (data[at] < 170 && data[at + 1] < 170 && data[at + 2] < 170) dark += 1;
    }
    if (dark > 2) lowest = y;
  }
  return lowest;
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const args = deckArgs();
const decks = await loadDecks(args);
const failures = [];
const warnings = [];
let typstMissing = false;

for (const deck of decks) {
  const cards = await loadCards(deck);
  let build;
  try {
    build = execFileSync("node", ["packages/prepress/build.mjs", "--deck", deck.slug], {
      cwd: ROOT,
      stdio: "pipe"
    });
  } catch (error) {
    if (error.status === 2) {
      typstMissing = true;
      break;
    }
    // Keep the build's own last words. Rethrowing the bare child-process error
    // prints a stack that names the command and says nothing about why Typst
    // refused the deck, which is the one sentence a reader needs.
    const said = String(error.stderr || "").trim() || String(error.stdout || "").trim();
    throw new Error(
      `could not build ${deck.slug} (exit ${error.status})` + (said ? `:\n${said}` : "")
    );
  }
  void build;

  const dir = mkdtempSync(join(tmpdir(), `fit-${deck.slug}-`));
  try {
    try {
      execFileSync(
        "typst",
        ["compile", "--root", "packages/prepress", "packages/prepress/src/card.typ",
          join(dir, "page-{p}.png"), "--format", "png", "--ppi", String(PPI)],
        { cwd: ROOT, stdio: "pipe" }
      );
    } catch (error) {
      const said = String(error.stderr || "").trim();
      throw new Error(
        `typst could not render ${deck.slug}` + (said ? `:\n${said}` : " and wrote no reason")
      );
    }
    // The printed order, which a deck may declare; the page number is a
    // position in that order, not in the ids.
    const ordered = orderCards(deck, cards);
    ordered.forEach((card, index) => {
      for (const [face, page] of [["recto", 2 * index + 1], ["verso", 2 * index + 2]]) {
        const file = join(dir, `page-${page}.png`);
        const lowest = lowestInk(decodePng(readFileSync(file)));
        if (lowest > TRIM) {
          const pt = ((lowest - SAFE) / PPI) * 72;
          failures.push(
            `${deck.slug} ${card.id} ${face}: last ink row ${lowest}, past the trim line at ${TRIM} ` +
              `(${pt.toFixed(1)} pt past the safe edge)`
          );
        } else if (lowest > SAFE) {
          const pt = ((lowest - SAFE) / PPI) * 72;
          warnings.push(
            `${deck.slug} ${card.id} ${face}: last ink row ${lowest}, ${pt.toFixed(1)} pt past the safe edge ` +
              `but inside the trim`
          );
        }
      }
    });
    console.log(`checked ${deck.slug}: ${ordered.length} cards, both faces, safe edge row ${SAFE}, trim row ${TRIM}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (typstMissing) {
  console.log("NOT RUN: Typst is not installed, so no page can be measured - unknown, not a pass.");
  process.exit(2);
}
for (const line of warnings) console.log(`TIGHT ${line}`);
if (failures.length > 0) {
  for (const line of failures) console.error(`OVER ${line}`);
  console.error(`${failures.length} face(s) run past the safe edge.`);
  process.exit(1);
}
const tightDecks = [...new Set(warnings.map((line) => line.split(" ")[0]))].join(", ");
console.log(
  `OK: every printed face ends inside the trim line` +
    (warnings.length
      ? `; ${warnings.length} face(s) in ${tightDecks} sit in the safe cushion, listed above.`
      : " and inside the safe inset.")
);
