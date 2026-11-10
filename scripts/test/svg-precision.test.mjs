/*
 * No drawn coordinate carries more than six decimals.
 *
 * `wrap()` rounds every number inside a geometry attribute, which is what made
 * the committed bundles reproducible on a second platform: `Math.sin`/`Math.cos`
 * agree across Apple's libm and glibc to every visible digit and differ in the
 * last bit of the double, and a raw double prints that difference into a
 * published artifact (`DECISIONS.md` §54). Until this test, the rule was a
 * convention held by one function; here it is an invariant over every card the
 * repository draws, checked on the engine's output and again on the committed
 * bundles, so a shape that bypasses `wrap()` or a bundle regenerated before the
 * fix cannot pass unnoticed.
 *
 * The attribute list is deliberately the same one `wrap()` uses. A future shape
 * that writes geometry into a new attribute name is outside the rule until the
 * name is added in both places, and that is the moment to decide whether the
 * number belongs to the drawing or to the design.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { deckShape, loadCards, loadDecks } from "../../packages/core/deck.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const require = createRequire(join(ROOT, "packages", "core", "svg.js"));
const { renderSvg } = require("./svg.js");

const GEOMETRY = /\b(x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d)="([^"]*)"/g;
const NUMBER = /-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g;

// Every number inside a geometry attribute of one drawing, with the attribute
// that carried it. Exponent form is a failure too: `1e-7` has no decimal point
// to count, and it is the one spelling that would slip past the rounding.
function geometryNumbers(svg) {
  const found = [];
  for (const [, name, value] of svg.matchAll(GEOMETRY)) {
    for (const [token] of value.matchAll(NUMBER)) {
      found.push({ name, token });
    }
  }
  return found;
}

function overRounded(numbers) {
  return numbers.filter(({ token }) => {
    if (/[eE]/.test(token)) return true;
    const [, fraction = ""] = token.split(".");
    return fraction.length > 6;
  });
}

test("every card's drawing prints geometry to at most six decimals", async () => {
  const decks = await loadDecks();
  assert.ok(decks.length > 0, "no deck was found, so nothing was drawn");

  let checked = 0;
  const problems = [];
  for (const deck of decks) {
    const cards = await loadCards(deck);
    assert.ok(cards.length > 0, `${deck.slug} has no cards, so its drawings were not checked`);
    const shape = deckShape(deck);
    for (const card of cards) {
      const svg = renderSvg(shape.figure(card));
      const numbers = geometryNumbers(svg);
      checked += numbers.length;
      for (const { name, token } of overRounded(numbers)) {
        problems.push(`${deck.slug} ${card.id}: ${name}="${token}"`);
      }
    }
  }

  // A regex that stopped matching would make this test pass on nothing.
  assert.ok(checked > 0, "no geometry number was found in any drawing");
  assert.deepEqual(problems, [], `geometry printed past six decimals:\n${problems.join("\n")}`);
});

test("the committed viewer bundles carry the same rule", async () => {
  const decks = await loadDecks();
  let checked = 0;
  const problems = [];
  for (const deck of decks) {
    const file = join(ROOT, "packages", "web", "decks", deck.slug, "deck-data.js");
    const source = await readFile(file, "utf8");
    const body = source.match(/window\.\w+ = ([\s\S]*);\n$/);
    assert.ok(body, `${deck.slug}: the bundle is not the shape the generator writes`);
    const bundle = JSON.parse(body[1]);
    assert.ok(bundle.cards.length > 0, `${deck.slug}: the bundle holds no cards`);
    for (const card of bundle.cards) {
      const numbers = geometryNumbers(card.svg);
      checked += numbers.length;
      for (const { name, token } of overRounded(numbers)) {
        problems.push(`${deck.slug} ${card.id}: ${name}="${token}"`);
      }
    }
  }

  assert.ok(checked > 0, "no geometry number was found in any committed bundle");
  assert.deepEqual(problems, [], `committed geometry past six decimals:\n${problems.join("\n")}`);
});
