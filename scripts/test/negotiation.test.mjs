/*
 * The negotiation deck's own contract, beyond the generic engine checks.
 *
 * The forty-four moves are an extraction, not a retyping: the committed
 * inventory is the authority for every name, situation, script, origin and
 * defense, and no test may read the read-only research folder. The layout map
 * fixes every card's schematic family and the three numbers the figure draws,
 * so a drawing cannot disagree with its own caption, and the declared rendering
 * table in data/render.mjs is the only way the source's escaped LaTeX reaches a
 * record: the records are exactly its output, and no printed field keeps a
 * backslash, a brace or a macro.
 *
 * The script never leaves the card. The full origin and the full defense are
 * declared `card: false` blocks, so they reach the rules file and the stage
 * resource and not the back face; the short defense is a compression and is
 * held to its own source block: no new number, no missing stated bound.
 *
 * Attribution has two tiers and no third. Three cards print the source's own
 * name - card 12's pair and year, and the two surnames its titles carry - and
 * forty-one say the source names nobody. The two names the SPEC keeps out of
 * every artifact are assembled from fragments here so the guard does not carry
 * the names it forbids.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCards, loadDeck } from "../../packages/core/deck.mjs";
import { renderText } from "../../decks/negotiation/data/render.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const DATA = join(ROOT, "decks", "negotiation", "data");
const INVENTORY = join(DATA, "source-inventory.json");
const LAYOUT = join(DATA, "layout-map.json");
const SCHEMA = join(DATA, "law-schema.json");
const TOTAL = 44;

// The source splits into four stages of eleven, in section order.
const STAGE_COUNTS = [11, 11, 11, 11];
const KICKERS = ["Principled", "Empathy", "Anchoring", "De-escalation"];

// The checkpoint-two map's own distribution, by family.
const FAMILY_COUNTS = {
  label: 9,
  range: 6,
  split: 5,
  step: 4,
  exchange: 4,
  signal: 4,
  alternative: 3,
  stake: 3,
  layer: 2,
  choice: 2,
  expand: 2
};

const UNIT = {
  label: "part",
  range: "point",
  split: "half",
  step: "step",
  exchange: "item",
  signal: "cue",
  alternative: "option",
  stake: "stake",
  layer: "level",
  choice: "branch",
  expand: "frame"
};

const FAMILY_LABEL = {
  Label: "label",
  Range: "range",
  Split: "split",
  Step: "step",
  Exchange: "exchange",
  Signal: "signal",
  Alternative: "alternative",
  Stake: "stake",
  Layer: "layer",
  Choice: "choice",
  Expand: "expand"
};

const NO_ORIGIN = "The source names no originator.";
const NAMED = {
  "NEG-12": "Matthew D. Lieberman & Naomi I. Eisenberger (2007)",
  "NEG-28": "Ackerman",
  "NEG-32": "Farren"
};

// The front sizes follow measured length, at the bands the layout map declares.
const nameSizeFor = (length) => (length <= 50 ? 12 : length <= 58 ? 11.5 : 11);
const scenarioSizeFor = (length) => (length <= 115 ? 9 : length <= 136 ? 8.5 : length <= 166 ? 8 : 7.5);

const numbers = (value) => String(value).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];

// A markdown list marker is syntax, not text: the card prints one line per
// item without the asterisk.
const scriptLines = (script) =>
  String(script)
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s+/, "").trim())
    .filter((line) => line.length > 0);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

// One card's slice of a generated markdown file: from its own heading to the
// next heading at the same level, so a shared sentence cannot pass.
function section(text, heading, marker) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const next = text.indexOf(`\n${marker} `, start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
}

// The two names the SPEC keeps out of every artifact, assembled from fragments
// and matched case-insensitively because the source's references carry
// lowercase slugs.
const FORBIDDEN = [["Pip", "Decks"].join(" "), ["Negotiation", "Tactics"].join(" ")].map((name) =>
  name.toLowerCase()
);

const record = (id) => JSON.parse(readFileSync(join(DATA, "laws", `${id.toLowerCase()}.json`), "utf8"));

test("the deck is forty-four records in four stages of eleven", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.cards.length, TOTAL, "the inventory holds 44 cards");
  assert.equal(inventory.sourceBytes, 77024, "the source's measured size");
  assert.equal(
    inventory.sourceSha256,
    "53360017b12390c15a7a04fdd6359a0356c64f059111976ee0226f4d1ef79b22",
    "the inventory records the source this deck was built from"
  );

  const deck = await loadDeck("negotiation");
  assert.equal(deck.name, "Negotiation Architecture");
  assert.equal(deck.slug, "negotiation");
  assert.equal(deck.categories.length, 4, "four stages");

  const cards = await loadCards(deck);
  assert.equal(cards.length, TOTAL, "every card is committed");
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");

  const seen = {};
  for (const card of cards) seen[card.stage] = (seen[card.stage] || 0) + 1;
  assert.deepEqual(Object.values(seen), STAGE_COUNTS, "the source splits into 11/11/11/11");
  for (const category of Object.keys(seen)) {
    assert.ok(deck.categories.includes(category), `${category} is not a declared category`);
  }

  for (const card of cards) {
    assert.equal(card.id, `NEG-${String(card.sourceCardNo).padStart(2, "0")}`, `${card.id} id and source number`);
    assert.equal(Number(card.id.slice(4)), card.sourceCardNo, `${card.id} id number is the source's card number`);
  }
  assert.deepEqual([...new Set(cards.map((card) => card.kicker))], KICKERS, "the four kickers, in stage order");
});

test("every record is the committed inventory's text after the declared rendering", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const authored = JSON.parse(readFileSync(join(DATA, "short-defenses.json"), "utf8"));
  const cards = await loadCards(await loadDeck("negotiation"));
  const rows = new Map(inventory.cards.map((row) => [row.id, row]));
  assert.equal(cards.length, rows.size, "the record set and the inventory have the same size");

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.equal(card.sourceCardNo, row.sourceCardNo, `${card.id} source card number`);
    assert.equal(card.stage, row.stage, `${card.id} stage`);
    assert.equal(card.kicker, row.kicker, `${card.id} kicker`);
    for (const field of ["name", "scenario", "originFull", "defenseFull"]) {
      assert.equal(card[field], renderText(row[field]), `${card.id} ${field} is the source's text, rendered`);
    }
    assert.deepEqual(card.script, scriptLines(row.script).map(renderText), `${card.id} script is the source's lines, rendered`);
    assert.equal(card.defense, renderText(authored.defenses[card.id]), `${card.id} short defense is the authored compression`);
  }

  // Card 28's script is the source's four-round ladder, one printed line each.
  assert.equal(record("NEG-28").script.length, 4, "card 28 prints four rounds");
  for (const line of record("NEG-28").script) {
    assert.ok(!/^\s*\*/.test(line), "card 28 carries no markdown list marker");
  }
});

test("no printed field carries a macro or an escape after rendering", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  for (const card of cards) {
    const fields = [
      ["name", card.name],
      ["scenario", card.scenario],
      ["defense", card.defense],
      ["schematic", card.schematic],
      ["origin", card.origin.line || ""],
      ["originFull", card.originFull],
      ["defenseFull", card.defenseFull],
      ...card.script.map((line, index) => [`script[${index}]`, line])
    ];
    for (const [field, value] of fields) {
      const residue = String(value).match(/[\\{}]/);
      assert.equal(residue, null, `${card.id}.${field} keeps ${JSON.stringify(residue && residue[0])}`);
    }
  }
});

test("the escapes render through the declared table, and only it", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const byId = new Map(cards.map((card) => [card.id, card]));

  // The source's three classes, counted on the extracted text: 48 currency
  // escapes, 7 arrows (card 21 four, card 28 three), one escaped stop.
  const classes = {};
  for (const row of inventory.cards) {
    for (const field of ["originFull", "scenario", "script", "defenseFull"]) {
      for (const match of String(row[field]).matchAll(/\\+./g)) {
        classes[match[0]] = (classes[match[0]] || 0) + 1;
      }
    }
  }
  assert.deepEqual(classes, { "\\$": 48, "\\\\t": 7, "\\.": 1 }, "the source holds exactly three escape classes");

  // The rendered text prints what the classes meant: every currency escape in
  // the source's own blocks leaves one dollar sign and no backslash. The
  // authored short defenses may repeat an amount, so they are counted out.
  const printed = cards.flatMap((card) => [
    card.name,
    card.scenario,
    card.originFull,
    card.defenseFull,
    ...card.script
  ]);
  assert.equal((printed.join("\n").match(/\$/g) || []).length, 48, "forty-eight currency amounts print as $");
  assert.equal((printed.join("\n").match(/\\\$/g) || []).length, 0, "no escaped dollar survives");

  const arrow = (id) => byId.get(id).originFull;
  assert.ok(arrow("NEG-21").includes("Active Listening → Empathy → Rapport → Influence → Behavioral Change"), "card 21 prints the chain as arrows");
  assert.ok(arrow("NEG-28").includes("(65% → 85% → 95% → 100% of target)"), "card 28 prints the ladder as arrows");
  assert.equal((arrow("NEG-21").match(/→/g) || []).length, 4, "card 21's four arrows");
  assert.equal((arrow("NEG-28").match(/→/g) || []).length, 3, "card 28's three arrows");
  assert.ok(record("NEG-30").defenseFull.includes("Tier 3."), "the one escaped stop prints as a stop");

  // An undeclared sequence is left alone and the residue guard names it - the
  // guard is what makes the table a table rather than a scanner.
  assert.equal(renderText("see \\unknown command"), "see \\unknown command", "an undeclared sequence is not swallowed");
  assert.equal(renderText("see \\unknown command").match(/[\\{}]/)[0], "\\", "the residue guard sees it");
});

test("every schematic line agrees with its figure and its layout row", async () => {
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const cards = await loadCards(await loadDeck("negotiation"));
  const counts = {};
  for (const card of cards) {
    const row = layout.map[card.id];
    assert.ok(row, `${card.id} has no layout-map row`);
    const params = card.figure.parametricParams;
    assert.equal(card.figure.svgShape, "negotiation-figure", `${card.id} figure shape`);
    assert.equal(params.family, row.family, `${card.id} family follows the layout map`);
    assert.equal(params.divisions, row.divisions, `${card.id} divisions follow the layout map`);
    assert.equal(params.mark, row.mark, `${card.id} mark follows the layout map`);
    assert.ok(params.mark >= 1 && params.mark <= params.divisions, `${card.id} mark is one of its positions`);
    assert.equal(card.schematic, row.schematic, `${card.id} prints the layout map's own line`);
    assert.equal(card.defenseSize, row.defenseSize, `${card.id} back size follows the layout map`);
    assert.equal(card.defenseSize, ["NEG-03", "NEG-10", "NEG-28"].includes(card.id) ? 6.5 : 7, `${card.id} back size is its declared one`);

    // The line is regenerated from the figure's own numbers: family and unit
    // are a fixed pair, so "Gate at beat 2" cannot appear.
    const match = card.schematic.match(/^([A-Z][a-z]+) at ([a-z]+) (\d+) of (\d+)$/);
    assert.ok(match, `${card.id} schematic "${card.schematic}" is not '<Family> at <unit> <mark> of <divisions>'`);
    const [, family, unit, mark, divisions] = match;
    assert.equal(FAMILY_LABEL[family], params.family, `${card.id} schematic family names its figure`);
    assert.equal(unit, UNIT[params.family], `${card.id} schematic unit belongs to its figure`);
    assert.equal(Number(mark), params.mark, `${card.id} schematic mark is the drawing's mark`);
    assert.equal(Number(divisions), params.divisions, `${card.id} schematic divisions are the drawing's`);

    counts[params.family] = (counts[params.family] || 0) + 1;
  }
  assert.equal(Object.keys(layout.map).length, TOTAL, "the layout map has no row without a record");
  assert.deepEqual(counts, FAMILY_COUNTS, "the eleven figure families carry the counts the map declares");
});

test("every figure's numbers are anchored in the card's own text", async () => {
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const cards = await loadCards(await loadDeck("negotiation"));
  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const [id, row] of Object.entries(layout.map)) {
    const card = byId.get(id);
    assert.ok(row.basis && row.basis.field && row.basis.quote, `${id} layout row names its basis`);
    const field = { origin: "originFull", defense: "defenseFull" }[row.basis.field] || row.basis.field;
    const value = card[field];
    const text = Array.isArray(value) ? value.join("\n") : String(value);
    assert.ok(text.includes(row.basis.quote), `${id} figure basis "${row.basis.quote}" is not in its ${field}`);
  }
});

test("the map's numbering clauses are the ones the rows use", async () => {
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  // Four sentences the rows depend on: text order, the numeric span's
  // low-to-high order, the whole record's block order, and what an exchange
  // item is.
  for (const clause of ["in the order the text names them", "low to high", "block order", "offers or asks for"]) {
    assert.ok(layout.numbering.includes(clause), `the map declares ${JSON.stringify(clause)}`);
  }
  // The clause is not decorative: NEG-31's row is the case it names.
  const row = layout.map["NEG-31"];
  assert.equal(row.family, "range");
  assert.equal(row.divisions, 2);
  assert.equal(row.mark, 2);
  assert.ok(layout.numbering.includes("NEG-31"), "the map names the case that fixed the span order");
});

test("attribution has two tiers and no third", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  const named = cards.filter((card) => card.origin.line);
  const honest = cards.filter((card) => card.origin.note);
  assert.equal(named.length, 3, "three cards print the source's own name");
  assert.equal(honest.length, 41, "forty-one say the source names nobody");
  assert.equal(named.length + honest.length, TOTAL);
  assert.deepEqual(named.map((card) => card.id).sort(), Object.keys(NAMED).sort(), "exactly cards 12, 28 and 32 are named");
  for (const card of named) {
    assert.equal(card.origin.line, NAMED[card.id], `${card.id} prints the source's own line`);
    assert.deepEqual(Object.keys(card.origin), ["line"], `${card.id} carries the line and nothing else`);
  }
  for (const card of honest) assert.equal(card.origin.note, NO_ORIGIN, `${card.id} honest line`);

  // Card 12 is the only year, and it is the source's own exemplar.
  const year = JSON.stringify(cards.map((card) => card.origin)).match(/\b(19|20)\d{2}\b/g) || [];
  assert.deepEqual(year, ["2007"], "the single year in the records is card 12's 2007");

  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const origin = schema.properties.origin;
  assert.deepEqual(Object.keys(origin.properties).sort(), ["line", "note"], "the schema declares no author, year or title");
});

test("the short defense is a compression of its own source block", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  for (const card of cards) {
    assert.ok(card.defense.length <= 120, `${card.id} short defense is 120 characters or fewer`);
    assert.ok(card.defenseFull.length > card.defense.length, `${card.id} short form is shorter than its block`);
    const source = new Set(numbers(card.defenseFull));
    for (const number of numbers(card.defense)) {
      assert.ok(source.has(number), `${card.id} short defense states ${number}, which its source block does not`);
    }
  }
});

test("the script stays on the card and the full blocks stay off it", async () => {
  const deck = await loadDeck("negotiation");
  const blocks = deck.blocks || [];
  const script = blocks.find((block) => block.field === "script");
  assert.ok(script, "the script is a declared block");
  assert.equal(script.card, undefined, "the script prints on the card");
  assert.equal(script.style, "lines", "one printed line per script entry");
  assert.equal(script.sizeField, "defenseSize", "the script steps down with its card's back size");
  for (const field of ["originFull", "defenseFull"]) {
    const block = blocks.find((entry) => entry.field === field);
    assert.ok(block, `${field} is a declared block`);
    assert.equal(block.card, false, `${field} stays off the card`);
  }
});

test("the full source text reaches the rules file and the stage resources", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  const rules = readFileSync(join(ROOT, "rules", "negotiation-rules.md"), "utf8");
  const resources = {
    "Principled Negotiation & Structural Bargaining": join(ROOT, "skills", "negotiation", "resources", "principled-negotiation-structural-bargaining.md"),
    "Tactical Empathy & Behavioral Influence": join(ROOT, "skills", "negotiation", "resources", "tactical-empathy-behavioral-influence.md"),
    "Anchoring, Framing & Concession Dynamics": join(ROOT, "skills", "negotiation", "resources", "anchoring-framing-concession-dynamics.md"),
    "De-escalation, Resistance Defusal & Countering Bad Faith": join(ROOT, "skills", "negotiation", "resources", "de-escalation-resistance-defusal-countering-bad-faith.md")
  };
  const byStage = {};
  for (const card of cards) (byStage[card.stage] ||= []).push(card);

  for (const card of cards) {
    const slice = section(rules, `### ${card.id} — ${card.name}`, "###");
    assert.ok(slice.includes(card.originFull), `${card.id} origin is in the rules file, in its own section`);
    assert.ok(slice.includes(card.defenseFull), `${card.id} defense is in the rules file, in its own section`);
    assert.ok(slice.includes(card.script.join("\n")) || card.script.every((line) => slice.includes(line)), `${card.id} script is in the rules file`);
    assert.ok(slice.includes(card.defense), `${card.id} short defense is in the rules file`);
  }
  for (const [stage, cardsInStage] of Object.entries(byStage)) {
    const text = readFileSync(resources[stage], "utf8");
    for (const card of cardsInStage) {
      assert.ok(text.includes(card.originFull), `${card.id} origin is in its stage resource`);
      assert.ok(text.includes(card.defenseFull), `${card.id} defense is in its stage resource`);
      assert.ok(card.script.every((line) => text.includes(line)), `${card.id} script is in its stage resource`);
    }
  }
});

test("the front sizes follow the measured bands", async () => {
  const cards = await loadCards(await loadDeck("negotiation"));
  for (const card of cards) {
    assert.equal(card.nameSize, nameSizeFor(card.name.length), `${card.id} name size follows its length`);
    assert.equal(card.scenarioSize, scenarioSizeFor(card.scenario.length), `${card.id} scenario size follows its length`);
  }
  const names = cards.reduce((counts, card) => counts.set(card.nameSize, (counts.get(card.nameSize) || 0) + 1), new Map());
  assert.equal(names.get(12), 39, "thirty-nine names print at 12 pt");
  assert.equal(names.get(11.5), 3, "three at 11.5");
  assert.equal(names.get(11), 2, "two at 11");
});

test("no artifact names the commercial deck or the source folder", async () => {
  assert.ok(FORBIDDEN.every((name) => name === name.toLowerCase() && name.length > 4), "the guard's names are real");
  const probe = `[${FORBIDDEN[0].toUpperCase()}]`;
  assert.ok(FORBIDDEN.some((name) => probe.toLowerCase().includes(name)), "the guard sees an upper-case occurrence");

  const files = [
    ...walk(join(ROOT, "decks", "negotiation")),
    join(ROOT, "rules", "negotiation-rules.md"),
    ...walk(join(ROOT, "skills", "negotiation")),
    ...walk(join(ROOT, "packages", "web", "decks", "negotiation")),
    join(ROOT, "packages", "web", "index.html")
  ];
  assert.ok(files.length > TOTAL, `walked ${files.length} artifact files`);
  for (const file of files) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const name of FORBIDDEN) {
      const occurrences = text.split(name).length - 1;
      assert.equal(occurrences, 0, `${file.slice(ROOT.length + 1)} names the forbidden string ${occurrences} time(s)`);
    }
  }
});
