#!/usr/bin/env node
/*
 * Check a built deck PDF without external tools.
 *
 * Asserts:
 *   - every page's MediaBox is 3.00 x 5.00 in (216 x 360 pt);
 *   - the page count is 2 x cards (recto + verso), 12 for six cards.
 *
 * PDF object streams may be compressed, so the scan falls back to inflating
 * each stream before giving up. This is a structural check only: a green run
 * does not prove marks are drawn, text is legible, or the SVG embedded.
 *
 * Usage:
 *   node scripts/pdf-check.mjs [path.pdf] [--expect-pages N]
 */
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { ROOT, loadCards } from "./lib/deck.mjs";

const args = process.argv.slice(2);
const pdfPath = args.find((arg) => !arg.startsWith("--")) ||
  join(ROOT, "packages", "prepress", "dist", "ux-deck.pdf");
const expectIndex = args.indexOf("--expect-pages");
const cards = await loadCards();
const expectedPages = expectIndex >= 0
  ? Number(args[expectIndex + 1])
  : cards.length * 2;

let bytes;
try {
  bytes = await readFile(pdfPath);
} catch (error) {
  if (error.code === "ENOENT") {
    console.error(`No PDF at ${pdfPath}. Run npm run build:pdf first.`);
    process.exit(2);
  }
  throw error;
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

const raw = bytes.toString("latin1");
let { boxes, pages } = collect(raw);

if (boxes.length === 0) {
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
  const combined = raw + "\n" + inflated.join("\n");
  ({ boxes, pages } = collect(combined));
}

if (boxes.length === 0) {
  console.error(
    `No MediaBox found in ${pdfPath}. The PDF may be encrypted or use a ` +
    "structure this scanner does not understand; inspect it before blaming the template."
  );
  process.exit(1);
}

const expectedW = 216;
const expectedH = 360;
const tolerance = 1;
let failed = false;

boxes.forEach((box, index) => {
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  if (Math.abs(width - expectedW) > tolerance ||
      Math.abs(height - expectedH) > tolerance) {
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
    `expected ${expectedPages} pages (${cards.length} cards recto + verso), got ${pages}`
  );
}

if (boxes.length !== pages) {
  failed = true;
  console.error(
    `found ${boxes.length} MediaBox value(s) but ${pages} page object(s); ` +
    "the page tree may be compressed or malformed."
  );
}

if (failed) process.exit(1);

const first = boxes[0];
console.log(
  `OK: ${pages} pages, MediaBox ${(first[2] - first[0]).toFixed(2)} x ` +
  `${(first[3] - first[1]).toFixed(2)} pt (3.00 x 5.00 in) on every page.`
);
