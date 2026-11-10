/*
 * The innovation deck's inventory contract, from the first commit.
 *
 * The forty-two tactics are an extraction, not a retyping: the committed
 * inventory is the authority for every record, and no test may read the
 * read-only research folder (DECISIONS 46). Deck seven's last defect was a
 * hand-written summary above tested records that went stale; here every
 * measured claim in the inventory - the count, the phase split, the field
 * ranges and the per-card total - is recomputed from the records it describes,
 * and the two recorded source defects are asserted to be carried rather than
 * repaired away.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "innovation", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "innovation", "data", "layout-map.json");
const TOTAL = 42;

const loadInventory = async () => JSON.parse(await readFile(INVENTORY, "utf8"));

// The lower median: the 21st of 42 sorted values, no interpolation. The
// inventory's note states this convention, and the test holds it.
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

const stats = (pick) => {
  const values = pick();
  return { min: Math.min(...values), median: median(values), max: Math.max(...values) };
};

test("the inventory holds forty-two tactics in four phases, in source order", async () => {
  const inventory = await loadInventory();
  assert.equal(inventory.records.length, TOTAL, "the inventory holds 42 tactics");
  assert.equal(inventory.recordCount, TOTAL, "the declared count matches the records");

  // Deck order is the source's own numbering: I01 is the first section, and
  // the document's "Tactic NN" label agrees with its position.
  inventory.records.forEach((record, index) => {
    assert.equal(record.number, index + 1, `record ${index + 1} is out of source order`);
  });

  const phases = {};
  for (const record of inventory.records) phases[record.phase] = (phases[record.phase] || 0) + 1;
  assert.deepEqual(phases, { 1: 10, 2: 10, 3: 11, 4: 11 }, "the phase split is 10/10/11/11");
  assert.deepEqual(inventory.phaseCounts, phases, "the declared phase split matches the records");
});

test("every measured claim in the inventory is derived from its records", async () => {
  const inventory = await loadInventory();
  const records = inventory.records;
  const measure = {
    hypothesis: () => records.map((record) => record.hypothesis.length),
    preparation: () => records.map((record) => record.plan.preparation.length),
    execution: () => records.map((record) => record.plan.execution.length),
    dataCollection: () => records.map((record) => record.plan.dataCollection.length),
    warning: () => records.map((record) => record.warning.text.length),
    total: () =>
      records.map(
        (record) =>
          record.hypothesis.length +
          record.plan.preparation.length +
          record.plan.execution.length +
          record.plan.dataCollection.length +
          record.warning.text.length
      )
  };
  assert.deepEqual(
    Object.keys(inventory.fieldLengths).sort(),
    Object.keys(measure).sort(),
    "the summary measures exactly the fields it claims"
  );
  for (const [field, pick] of Object.entries(measure)) {
    assert.deepEqual(inventory.fieldLengths[field], stats(pick), `${field} summary is stale`);
  }
});

test("the warning names are distinct, which is what makes the deck a taxonomy", async () => {
  const inventory = await loadInventory();
  const names = inventory.records.map((record) => record.warning.name);
  assert.equal(new Set(names).size, TOTAL, "all 42 named false positives are distinct");
  for (const name of names) {
    assert.ok(name && name.trim().length > 0, "a warning has no name");
  }
});

test("the two recorded source defects are carried, not repaired away", async () => {
  const inventory = await loadInventory();
  const byNumber = new Map(inventory.records.map((record) => [record.number, record]));

  // I24 prints its Execution stage as an escaped inline bullet at the end of
  // Preparation. The extraction restores it as its own stage, text unchanged;
  // it must not still be sitting inside Preparation.
  const wizard = byNumber.get(24);
  assert.ok(wizard, "I24 is missing");
  assert.ok(wizard.plan.execution.length > 40, "I24's Execution stage is missing");
  assert.ok(
    !wizard.plan.preparation.includes("Execution"),
    "I24's Execution stage is still glued to Preparation"
  );

  // I28's cost range is broken markup. The extraction records no cost and
  // keeps the source's literal; inventing a number is the one thing not
  // allowed.
  const crowdfunding = byNumber.get(28);
  assert.ok(crowdfunding, "I28 is missing");
  assert.equal(crowdfunding.method.financialCost, null, "I28's cost must stay null");
  assert.ok(
    typeof crowdfunding.method.financialCostRaw === "string" &&
      crowdfunding.method.financialCostRaw.length > 0,
    "I28's source literal must be kept"
  );
  assert.ok(crowdfunding.method.timeToResult.length > 0, "I28's time is recoverable");
  assert.ok(crowdfunding.method.confidence.length > 0, "I28's confidence is recoverable");
});

test("every figure follows the committed layout map and names what it draws", async () => {
  const inventory = await loadInventory();
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const map = layout.map;
  const families = layout.families;
  const rows = new Map(inventory.records.map((record) => ["I" + String(record.number).padStart(2, "0"), record]));

  assert.equal(Object.keys(map).length, TOTAL, "the layout map covers every tactic");
  for (const [cardId, record] of rows) {
    const row = map[cardId];
    assert.ok(row, `${cardId} has no layout-map row`);
    assert.ok(families[row.family], `${cardId} names an unknown family`);
    assert.equal(row.family, families[row.family] ? row.family : "", `${cardId} family`);
    assert.ok(Number.isInteger(row.divisions) && row.divisions >= 1, `${cardId} divisions`);
    assert.ok(Number.isInteger(row.mark) && row.mark >= 1, `${cardId} mark`);
    assert.ok(row.mark <= row.divisions, `${cardId} mark is outside the drawing`);
    assert.ok(row.hypothesisSize >= 6.5 && row.hypothesisSize <= 9, `${cardId} hypothesis size`);

    // The label names the drawing: it carries the marked number in the
    // drawing's own units and, except for the ladder, ends in the family's
    // noun. The ladder's label leads with what the rungs measure instead,
    // because twenty fronts should be legible without the method strip.
    if (row.family === "ladder") {
      const word = record.method.confidence.split(" (")[0].trim();
      assert.ok(row.label.startsWith(`${word} confidence`), `${cardId} label omits its datum`);
      assert.ok(row.label.includes(`rung ${row.mark} of ${row.divisions}`), `${cardId} label omits its rung`);
    } else if (row.family === "curve") {
      assert.ok(row.label.includes(`Week ${row.mark}`), `${cardId} label omits its horizon`);
    } else {
      assert.ok(row.label.includes(`stage ${row.mark}`) || row.label.includes(`step ${row.mark}`), `${cardId} label omits its mark`);
    }
    if (row.family !== "ladder") {
      assert.ok(
        row.label.endsWith(families[row.family].noun),
        `${cardId} label does not end in "${families[row.family].noun}": "${row.label}"`
      );
    }

    // The basis is a stated datum, quoted from the record it claims.
    const basis = row.basis;
    assert.ok(basis && basis.datum && basis.field && basis.quote, `${cardId} has no basis`);
    const value = basis.field.split(".").reduce((v, key) => (v == null ? v : v[key]), record);
    assert.ok(
      typeof value === "string" && value.includes(basis.quote),
      `${cardId} basis quote is not in ${basis.field}`
    );
  }
});

test("a long hypothesis is never left at the front's default size", async () => {
  // The probe exists because I37's hypothesis is three times a deck-seven
  // diagnostic. A card over 400 characters that still prints at 9 pt has not
  // been measured, it has been hoped at.
  const inventory = await loadInventory();
  const map = JSON.parse(await readFile(LAYOUT, "utf8")).map;
  for (const record of inventory.records) {
    const cardId = "I" + String(record.number).padStart(2, "0");
    if (record.hypothesis.length > 400) {
      assert.ok(
        map[cardId].hypothesisSize < 9,
        `${cardId} hypothesis is ${record.hypothesis.length} characters and still set at 9 pt`
      );
    }
  }
});

test("a printed card's size is the map's size", async () => {
  // The map is the authority for the layout; a record that disagrees with it
  // would print a size the map does not describe.
  const { loadCards, loadDeck } = await import("../../packages/core/deck.mjs");
  const deck = await loadDeck("innovation");
  const map = JSON.parse(await readFile(LAYOUT, "utf8")).map;
  for (const card of await loadCards(deck)) {
    assert.equal(card.hypothesisSize, map[card.id].hypothesisSize, `${card.id} size differs from the map`);
    assert.equal(card.schematic, map[card.id].label, `${card.id} printed schematic differs from the map`);
  }
});
