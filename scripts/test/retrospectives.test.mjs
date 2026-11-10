/*
 * The retrospective deck's own contract, beyond the generic engine checks.
 *
 * The forty-five rituals are an extraction, not a retyping: the committed
 * inventory is the authority for the number, name, category, trigger, canvas
 * and timebox of every card, and no test may read the gitignored research
 * folder (DECISIONS 46).
 *
 * Two things on a card cannot be checked by looking at it. The first is where
 * its phases come from: eleven sections give a timed sequence and the rest name
 * the canvas and leave the phases to the facilitator. The second is the
 * arithmetic of those phases: five minutes headings written by hand have to add
 * up inside the card's own timebox, and a reader looking at a 1.8 inch card
 * cannot add them. Both are pinned here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCards, loadDeck } from "../../packages/core/deck.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "retrospectives", "data", "source-inventory.json");

const SOURCE_PROTOCOL =
  "Source protocol: the phases and minutes follow the written sequence in the source.";
const AUTHORED =
  "Source names the canvas and the intent and leaves the phases' wording and minutes to the facilitator.";

// "45–60 min" and "60 min" both occur. The inventory uses an en dash; a parser
// that only accepts a hyphen would silently find no range and let the card
// through, so both are accepted and an unparseable string fails loudly.
export function timeboxRange(text) {
  const match = /^(\d+)(?:\s*[–-]\s*(\d+))?\s*min$/.exec(String(text).trim());
  assert.ok(match, `unparseable timebox: ${JSON.stringify(text)}`);
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  assert.ok(low <= high, `timebox runs backwards: ${JSON.stringify(text)}`);
  return [low, high];
}

const stepMinutes = (text) => {
  const matches = [...text.matchAll(/\((\d+)m\)/g)];
  assert.equal(matches.length, 1, `a phase states its minutes exactly once: ${text}`);
  return Number(matches[0][1]);
};

test("a source-silent origin says the same sentence on every card", async () => {
  const deck = await loadDeck("retrospectives");
  const cards = await loadCards(deck);
  const silent = [];
  for (const card of cards) {
    const { origin } = card;
    const citesWork = Boolean(origin.authors || origin.title || origin.works);
    if (citesWork) continue;
    silent.push(card.id);
    assert.equal(
      origin.note,
      "The source names no originator.",
      `${card.id} must use the one source-silent sentence`
    );
  }
  assert.ok(silent.length > 0, "at least one card names no originator");
});

test("every record matches the committed inventory", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.rituals.length, 45, "the inventory holds 45 rituals");
  assert.equal(inventory.categories.length, 5);

  const deck = await loadDeck("retrospectives");
  const cards = await loadCards(deck);
  const rows = new Map(inventory.rituals.map((row) => [row.id, row]));

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.ok(
      row.scenarioTag && row.scenarioTrigger,
      `${row.id} inventory carries both the table tag and the section scenario`
    );
    assert.equal(card.name, row.name, `${card.id} name`);
    assert.equal(card.category, row.category, `${card.id} category`);
    assert.equal(card.trigger, row.scenarioTrigger, `${card.id} scenario trigger`);
    assert.equal(card.canvas, row.canvas, `${card.id} canvas`);
    assert.equal(card.timebox, row.timebox, `${card.id} timebox`);
    assert.equal(card.canvasLine, `${card.canvas} · ${card.timebox}`, `${card.id} canvas line`);
  }
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");

  // A category is committed whole or not at all, so a half-authored category
  // cannot pass as a finished one while the deck is being built.
  const expected = {};
  for (const row of inventory.rituals) expected[row.category] = (expected[row.category] || 0) + 1;
  const seen = {};
  for (const card of cards) seen[card.category] = (seen[card.category] || 0) + 1;
  for (const [category, count] of Object.entries(seen)) {
    assert.ok(expected[category], `${category} is not an inventory category`);
    assert.equal(count, expected[category], `${category} is incomplete (${count} of ${expected[category]})`);
  }
});

test("each card says truthfully where its phases come from", async () => {
  const deck = await loadDeck("retrospectives");
  const cards = await loadCards(deck);
  for (const card of cards) {
    assert.equal(
      card.provenance,
      card.sourceProtocol ? SOURCE_PROTOCOL : AUTHORED,
      `${card.id} says the wrong thing about where its phases come from`
    );
  }
});

test("every card's five phase minutes add up inside its own timebox", async () => {
  const deck = await loadDeck("retrospectives");
  const cards = await loadCards(deck);
  for (const card of cards) {
    assert.equal(card.steps.length, 5, `${card.id} carries five phases, not ${card.steps.length}`);
    const [low, high] = timeboxRange(card.timebox);
    const total = card.steps.reduce((sum, step) => sum + stepMinutes(step.text), 0);
    assert.ok(
      total >= low && total <= high,
      `${card.id}: phases sum to ${total} min, outside its ${low}–${high} min timebox`
    );
  }
});
