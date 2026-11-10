/*
 * The ideation deck's inventory contract, from the first commit.
 *
 * The fifty tactics are an extraction, not a retyping: the committed inventory
 * is the authority for every record, and no test may read the read-only
 * research folder (DECISIONS 46). Deck seven's last defect was a hand-written
 * summary above tested records that went stale; here every measured claim in
 * the inventory - the count, the phase split, the field ranges and the
 * per-card total - is recomputed from the records it describes, and the four
 * recorded source defects are asserted to be carried rather than repaired
 * away.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "ideation", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "ideation", "data", "layout-map.json");
const TOTAL = 50;

const loadInventory = async () => JSON.parse(await readFile(INVENTORY, "utf8"));

// The lower median: the 25th of 50 sorted values, no interpolation. The
// inventory's note states this convention, and the test holds it.
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
};

const stats = (pick) => {
  const values = pick();
  return { min: Math.min(...values), median: median(values), max: Math.max(...values) };
};

// The card-visible fields. The notes may quote source markup to explain a
// defect; a record may not carry one.
const cardText = (record) => ({
  name: record.name,
  sprint: record.sprint,
  mechanism: record.mechanism,
  "questions[0]": record.questions[0],
  "questions[1]": record.questions[1],
  "questions[2]": record.questions[2],
  "example.domain": record.example.domain,
  "example.text": record.example.text
});

test("the inventory holds fifty tactics in four phases, in source order", async () => {
  const inventory = await loadInventory();
  assert.equal(inventory.records.length, TOTAL, "the inventory holds 50 tactics");
  assert.equal(inventory.count, TOTAL, "the declared count matches the records");

  // Deck order is the source's own section order: IDE-01 is the first
  // section, and the record's position agrees with its id.
  inventory.records.forEach((record, index) => {
    assert.equal(record.n, index + 1, `record ${index + 1} is out of source order`);
    assert.equal(record.id, `IDE-${String(index + 1).padStart(2, "0")}`, "the id is the position");
  });

  const phases = {};
  for (const record of inventory.records) phases[record.phase] = (phases[record.phase] || 0) + 1;
  assert.deepEqual(
    phases,
    {
      "Systematic Lateral Thinking & Perceptual Restructuring": 16,
      "Algorithmic & Systematic Innovation (TRIZ & Morphological Analysis)": 16,
      "Constraints & Oblique Sparks": 10,
      "Combinatorial & Associative Prompts": 8
    },
    "the phase split is 16/16/10/8"
  );
  assert.deepEqual(inventory.phaseCounts, phases, "the declared phase split matches the records");
});

test("the source's 48 is recorded, not made true by dropping two cards", async () => {
  // The document's overview claims 48 core heuristics; its sections count to
  // 50. The headings are the authority, and the discrepancy is a fact about
  // the source that the inventory states rather than resolves.
  const inventory = await loadInventory();
  assert.equal(inventory.records.length, TOTAL, "the headings count to 50");
  assert.match(inventory.note, /48/, "the note records the source's claim of 48");
  assert.match(inventory.note, /50/, "the note records the headings' count of 50");
});

test("every measured claim in the inventory is derived from its records", async () => {
  const inventory = await loadInventory();
  const records = inventory.records;
  const questionsLength = (record) =>
    record.questions.reduce((sum, question) => sum + question.length, 0);
  const measure = {
    mechanism: () => records.map((record) => record.mechanism.length),
    sprint: () => records.map((record) => record.sprint.length),
    questions: () => records.map(questionsLength),
    example: () => records.map((record) => record.example.text.length),
    total: () =>
      records.map(
        (record) =>
          record.sprint.length +
          record.mechanism.length +
          questionsLength(record) +
          record.example.text.length
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

test("every tactic carries exactly three seed questions, and none repeats", async () => {
  // The source's own schema requires three (minItems 3, maxItems 3); the
  // questions are what turn a tactic into an action on the reader's problem.
  const inventory = await loadInventory();
  const seen = new Map();
  for (const record of inventory.records) {
    assert.equal(record.questions.length, 3, `${record.id} does not carry exactly three questions`);
    for (const question of record.questions) {
      assert.ok(question.trim().length > 0, `${record.id} has an empty question`);
      assert.ok(!seen.has(question), `${record.id} repeats a question from ${seen.get(question)}`);
      seen.set(question, record.id);
    }
  }
  assert.equal(seen.size, TOTAL * 3, "all fifty tactics carry their own three questions");
});

test("the four recorded source defects are carried, not repaired away", async () => {
  // All four are one markup family: an escaped label or an escaped bullet that
  // glued two fields together. The extraction normalised for parsing and kept
  // the record text intact; the defects stay listed in the inventory.
  const inventory = await loadInventory();
  const defects = inventory.sourceDefects;
  assert.deepEqual(
    defects.map((defect) => defect.id),
    ["IDE-07", "IDE-15", "IDE-26", "IDE-35"],
    "the four defects are recorded"
  );
  const byId = new Map(inventory.records.map((record) => [record.id, record]));
  for (const defect of defects) {
    const record = byId.get(defect.id);
    assert.ok(record, `${defect.id} has no record`);
    assert.ok(
      ["sprint", "questions"].includes(defect.field),
      `${defect.id}'s defect field is not one the record keeps`
    );
    const value = record[defect.field];
    const text = Array.isArray(value) ? value.join(" ") : value;
    assert.ok(text && text.trim().length > 100, `${defect.id}'s ${defect.field} text is not intact`);
  }
});

test("no card text carries a surviving macro token or backslash", async () => {
  // The source carries \to nine times and \epsilon once; the extractor renders
  // them to the arrow and the Greek letter before any backslash stripping. Six
  // innovation cards shipped raw LaTeX residue because this step was missing,
  // so the guard runs over the card-visible fields, not the notes.
  const inventory = await loadInventory();
  const commands = ["\\to", "\\epsilon", "\\frac", "\\text", "\\lim"];
  const offenders = [];
  for (const record of inventory.records) {
    for (const [field, value] of Object.entries(cardText(record))) {
      const command = commands.find((token) => value.includes(token));
      if (command) offenders.push(`${record.id} ${field}: ${command}`);
      else if (value.includes("\\")) offenders.push(`${record.id} ${field}: backslash`);
    }
  }
  assert.deepEqual(offenders, [], "macro residue in card text:\n  " + offenders.join("\n  "));

  // Rendering the macros is not the same as deleting them: the rendered forms
  // must survive where the source used them.
  const has = (character) =>
    inventory.records.some((record) =>
      Object.values(cardText(record)).some((value) => value.includes(character))
    );
  assert.ok(has("→"), "the rendered arrow is present");
  assert.ok(has("ε"), "the rendered epsilon is present");
});

test("every figure follows the committed layout map and names what it draws", async () => {
  // Deck six shipped ten cards whose figures contradicted their labels. The
  // map is the authority here, and the label under a figure must name the
  // family and the position the drawing marks.
  const inventory = await loadInventory();
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const map = layout.map;
  const families = layout.families;
  const rows = new Map(inventory.records.map((record) => [record.id, record]));

  assert.equal(Object.keys(map).length, TOTAL, "the layout map covers every tactic");
  for (const [cardId, record] of rows) {
    const row = map[cardId];
    assert.ok(row, `${cardId} has no layout-map row`);
    assert.ok(families[row.family], `${cardId} names an unknown family: ${row.family}`);
    assert.ok(Number.isInteger(row.divisions) && row.divisions >= 1, `${cardId} divisions`);
    assert.ok(Number.isInteger(row.mark) && row.mark >= 1, `${cardId} mark`);
    assert.ok(row.mark <= row.divisions, `${cardId} mark is outside the drawing`);
    assert.ok(row.sprintSize >= 6.5 && row.sprintSize <= 9, `${cardId} sprint size`);

    // The label names the drawing: the family's noun and the marked position
    // in the phase the drawing counts out.
    const noun = families[row.family].noun;
    assert.ok(
      row.label.toLowerCase().startsWith(noun),
      `${cardId} label does not name its family "${noun}": "${row.label}"`
    );
    assert.ok(
      row.label.includes(`position ${row.mark} of ${row.divisions}`),
      `${cardId} label omits its marked position: "${row.label}"`
    );

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
