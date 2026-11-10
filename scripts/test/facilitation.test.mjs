/*
 * The facilitation deck's own contract, beyond the generic engine checks.
 *
 * The forty-eight exercises are an extraction, not a retyping: the committed
 * inventory is the authority for the number, name, stage, room, clock and
 * deliverable of every card, and a test must not read the gitignored research
 * folder (DECISIONS 46). The inventory was extracted from the source by the
 * operator and is committed beside the records.
 *
 * The provenance line is part of the contract too: half the deck's steps come
 * from a written protocol in the source and half are authored from the
 * method's public definition, and the reader is told which half a card is in.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { loadCards, loadDeck, orderCards } from "../../packages/core/deck.mjs";

const require = createRequire(import.meta.url);
const { renderSvg } = require("../../packages/core/svg.js");

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "facilitation", "data", "source-inventory.json");

const SOURCE_PROTOCOL =
  "Source protocol: the steps follow the written script in the source.";
const AUTHORED =
  "Steps written for this deck from the method's public definition; the source has no protocol.";

const atAGlance = (row) =>
  `${row.groupSize} people · ${row.minutes} min · ${row.difficulty.toLowerCase()}`;

test("the forty-eight records match the committed inventory", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.exercises.length, 48, "the inventory holds 48 exercises");
  assert.equal(inventory.stages.length, 5);

  const deck = await loadDeck("facilitation");
  const cards = orderCards(deck, await loadCards(deck));
  assert.equal(cards.length, inventory.exercises.length, "record count differs from the inventory");

  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const row of inventory.exercises) {
    const id = `WS-${String(row.id).padStart(2, "0")}`;
    const card = byId.get(id);
    assert.ok(card, `${id} is missing from the deck`);
    assert.equal(card.name, row.name, `${id} name`);
    assert.equal(card.stage, row.stage, `${id} stage`);
    assert.equal(card.groupSize, row.groupSize, `${id} group size`);
    assert.equal(card.minutes, row.minutes, `${id} minutes`);
    assert.equal(card.difficulty, row.difficulty.toLowerCase(), `${id} difficulty`);
    assert.equal(card.deliverable, row.deliverable, `${id} deliverable`);
    assert.equal(card.atAGlance, atAGlance(row), `${id} at-a-glance line`);
    assert.equal(card.sourceProtocol, row.protocol, `${id} sourceProtocol`);
    assert.equal(
      card.provenance,
      row.protocol ? SOURCE_PROTOCOL : AUTHORED,
      `${id} says the wrong thing about where its steps come from`
    );
  }

  // Five stages, ten cards each except the last: the source's own distribution.
  const counts = {};
  for (const card of cards) counts[card.stage] = (counts[card.stage] || 0) + 1;
  assert.deepEqual(counts, {
    "Alignment & Framing": 10,
    "Divergent Ideation": 10,
    "Convergent Decision": 10,
    "Liberating Structures": 10,
    "Action Planning": 8
  });
});

test("no two cards draw the same picture", async () => {
  const deck = await loadDeck("facilitation");
  const cards = await loadCards(deck);
  const drawings = new Map();
  for (const card of cards) {
    assert.ok(card.figure && card.figure.svgShape, `${card.id} has no figure`);
    const svg = renderSvg(card.figure);
    assert.match(svg, /viewBox="0 0 400 400"/);
    assert.ok(!drawings.has(svg), `${card.id} draws the same picture as ${drawings.get(svg)}`);
    drawings.set(svg, card.id);
  }
  assert.equal(drawings.size, cards.length);
});
