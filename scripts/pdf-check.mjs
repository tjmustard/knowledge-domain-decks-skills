#!/usr/bin/env node
/*
 * Check built deck PDFs without external tools.
 *
 * Asserts, for each deck:
 *   - every page's MediaBox is 3.00 x 5.00 in (216 x 360 pt);
 *   - the page count is 2 x cards (recto + verso).
 *
 * PDF object streams may be compressed, so the scan falls back to inflating
 * each stream before giving up. This is a structural check only: a green run
 * does not prove marks are drawn, text is legible, or the SVG embedded. It
 * reads no text geometry either: neither the last line's glyph box nor its
 * rendered ink is measured here, so page fit cannot fail this check. The
 * vertical fit is a separate hand measurement, recorded in DECISIONS §37.
 *
 * Usage:
 *   node scripts/pdf-check.mjs                 # every deck
 *   node scripts/pdf-check.mjs --deck ux-laws
 *   node scripts/pdf-check.mjs path.pdf --deck ux-laws [--expect-pages N]
 */
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { deckArgs, loadCards, loadDecks, resolveFromRoot } from "../packages/core/deck.mjs";

const { only, dir: decksDir } = deckArgs();
// Arguments are parsed rather than searched: a value left behind by
// --decks-dir or --expect-pages would otherwise be mistaken for the PDF path.
let explicit = null;
let expectedOverride = null;
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--deck" || arg === "--decks-dir") {
      i += 1;
    } else if (arg.startsWith("--deck=") || arg.startsWith("--decks-dir=")) {
      continue;
    } else if (arg === "--expect-pages") {
      expectedOverride = Number(argv[(i += 1)]);
    } else if (!arg.startsWith("--")) {
      explicit = arg;
    }
  }
}

function collect(text) {
  const boxes = [];
  const boxRe = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g;
  let match;
  while ((match = boxRe.exec(text)) !== null) {
    boxes.push(match.slice(1).map(Number));
  }
  const pages = (text.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  return { boxes, pages };
}

function scan(bytes) {
  const raw = bytes.toString("latin1");
  let found = collect(raw);
  if (found.boxes.length > 0) return found;

  // Inflate every stream and rescan, for PDFs with compressed object streams.
  const inflated = [];
  let cursor = 0;
  while (cursor < raw.length) {
    const marker = raw.indexOf("stream", cursor);
    if (marker === -1) break;
    let start = marker + "stream".length;
    if (raw[start] === "\r") start += 1;
    if (raw[start] === "\n") start += 1;
    const end = raw.indexOf("endstream", start);
    if (end === -1) break;
    try {
      inflated.push(inflateSync(bytes.subarray(start, end)).toString("latin1"));
    } catch {
      /* not a zlib stream */
    }
    cursor = end + "endstream".length;
  }
  return collect(raw + "\n" + inflated.join("\n"));
}

const expectedW = 216;
const expectedH = 360;
const tolerance = 1;

async function checkDeck(deck, pdfPath, expectedPages) {
  let bytes;
  try {
    bytes = await readFile(pdfPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`No PDF at ${pdfPath}. Run npm run build:pdf first.`);
      return false;
    }
    throw error;
  }

  const { boxes, pages } = scan(bytes);
  if (boxes.length === 0) {
    console.error(
      `No MediaBox found in ${pdfPath}. The PDF may be encrypted or use a ` +
        "structure this scanner does not understand; inspect it before blaming the template."
    );
    return false;
  }

  let failed = false;
  boxes.forEach((box, index) => {
    const width = box[2] - box[0];
    const height = box[3] - box[1];
    if (Math.abs(width - expectedW) > tolerance || Math.abs(height - expectedH) > tolerance) {
      failed = true;
      console.error(
        `page ${index + 1}: MediaBox ${width.toFixed(2)} x ${height.toFixed(2)} pt ` +
          `(expected ${expectedW} x ${expectedH})`
      );
    }
  });

  if (pages !== expectedPages) {
    failed = true;
    console.error(
      `${deck.slug}: expected ${expectedPages} pages (${expectedPages / 2} cards recto + verso), got ${pages}`
    );
  }

  if (boxes.length !== pages) {
    failed = true;
    console.error(
      `${deck.slug}: found ${boxes.length} MediaBox value(s) but ${pages} page object(s); ` +
        "the page tree may be compressed or malformed."
    );
  }

  if (failed) return false;
  const first = boxes[0];
  console.log(
    `OK: ${deck.slug}: ${pages} pages, MediaBox ${(first[2] - first[0]).toFixed(2)} x ` +
      `${(first[3] - first[1]).toFixed(2)} pt (3.00 x 5.00 in) on every page.`
  );
  return true;
}

if (explicit) {
  // An explicit path still needs a deck for its schema and card count; say so
  // rather than guessing which deck's rules apply.
  const decks = await loadDecks({ only, dir: decksDir });
  if (decks.length !== 1) {
    console.error(`A path needs --deck when more than one deck exists (${decks.map((d) => d.slug).join(", ")}).`);
    process.exit(1);
  }
  const expected = expectedOverride ?? (await loadCards(decks[0])).length * 2;
  process.exit((await checkDeck(decks[0], explicit, expected)) ? 0 : 1);
}

const decks = await loadDecks({ only, dir: decksDir });
let ok = true;
for (const deck of decks) {
  const pdfPath = resolveFromRoot(deck.outputs?.pdf || `packages/prepress/dist/${deck.slug}.pdf`);
  const expected = expectedOverride ?? (await loadCards(deck)).length * 2;
  if (!(await checkDeck(deck, pdfPath, expected))) ok = false;
}
process.exit(ok ? 0 : 1);
