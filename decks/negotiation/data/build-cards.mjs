/*
 * Compile the negotiation deck's cards from the committed inventory, the
 * layout map and the authored short defenses.
 *
 * The forty-four cards are an extraction, so they are not retyped: this
 * builder is the one place the inventory, the layout map, the declared
 * rendering table and the authored compressions are joined, and the records
 * under data/laws/ are its output. The rules it enforces here rather than
 * trusting to the schema:
 *
 *   - the source's own text reaches the record through render.mjs, and no
 *     printed field may carry a surviving backslash, brace or macro after it.
 *   - the printed schematic line must agree with the figure's own three
 *     numbers, so no card can print a label its drawing contradicts.
 *   - the layout map's basis quote must be found in that card's own record,
 *     so the position is fixed by the card, not by a neighbouring one.
 *   - attribution has two tiers: the line the source's pedigree gives, or the
 *     honest line. A record carrying both, or neither, is a build failure.
 *   - a short defense may not introduce a number its source block does not
 *     state. The deck prints compressions, never new claims.
 *   - no record names the commercial deck or the source folder. The two
 *     strings are assembled here at run time; neither is written into a file
 *     the deck ships.
 *
 * Run from anywhere: node decks/negotiation/data/build-cards.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { latexResidue, renderText } from "./render.mjs";

const DIR = import.meta.dirname;

// The map's own unit words, one per family. The printed label is regenerated
// from these rather than trusted from the row, so a row and its drawing cannot
// drift apart.
const FAMILY_LABEL = {
  label: "Label",
  range: "Range",
  split: "Split",
  step: "Step",
  exchange: "Exchange",
  signal: "Signal",
  alternative: "Alternative",
  stake: "Stake",
  layer: "Layer",
  choice: "Choice",
  expand: "Expand"
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

// The size bands the layout map declares, in one place. A name is a label on a
// 3x5 card, so the five names over fifty characters step down; a scenario
// steps down at the same four measured thresholds deck twelve used.
const nameSizeFor = (length) => (length <= 50 ? 12 : length <= 58 ? 11.5 : 11);
const scenarioSizeFor = (length) => (length <= 115 ? 9 : length <= 136 ? 8.5 : length <= 166 ? 8 : 7.5);

const expectedLabel = (row) =>
  `${FAMILY_LABEL[row.family]} at ${UNIT[row.family]} ${row.mark} of ${row.divisions}`;

// The source's list markers are syntax, not text: a script written as a
// markdown list prints one line per item, and the marker itself does not
// reach the card.
const scriptLines = (script) =>
  String(script)
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s+/, "").trim())
    .filter((line) => line.length > 0);

// Two tiers and no third. The three lines are the source's own names; every
// other card says so rather than borrowing a citation the source did not make.
const ORIGIN_LINE = {
  "NEG-12": "Matthew D. Lieberman & Naomi I. Eisenberger (2007)",
  "NEG-28": "Ackerman",
  "NEG-32": "Farren"
};
const NO_ORIGIN = "The source names no originator.";

const FORBIDDEN = [["Pip", "Decks"].join(" "), ["Negotiation", "Tactics"].join(" ")].map((name) =>
  name.toLowerCase()
);

const main = async () => {
  const inventory = JSON.parse(await readFile(join(DIR, "source-inventory.json"), "utf8"));
  const layout = JSON.parse(await readFile(join(DIR, "layout-map.json"), "utf8"));
  const authored = JSON.parse(await readFile(join(DIR, "short-defenses.json"), "utf8"));
  const laws = join(DIR, "laws");
  await mkdir(laws, { recursive: true });

  const ids = inventory.cards.map((card) => card.id);
  if (ids.length !== 44) throw new Error(`expected 44 records, found ${ids.length}`);
  const missing = ids.filter((id) => !layout.map[id]);
  if (missing.length > 0) throw new Error(`no layout row for ${missing.join(", ")}`);
  const extra = Object.keys(layout.map).filter((id) => !ids.includes(id));
  if (extra.length > 0) throw new Error(`layout rows with no record: ${extra.join(", ")}`);
  const unlicensed = ids.filter((id) => !authored.defenses[id]);
  if (unlicensed.length > 0) throw new Error(`no authored short defense for ${unlicensed.join(", ")}`);

  const staged = { line: 0, note: 0 };

  for (const record of inventory.cards) {
    const row = layout.map[record.id];
    const label = expectedLabel(row);
    if (row.schematic !== label) {
      throw new Error(`${record.id} schematic ${JSON.stringify(row.schematic)} contradicts its figure; expected ${JSON.stringify(label)}`);
    }

    const name = renderText(record.name);
    const scenario = renderText(record.scenario);
    const script = scriptLines(record.script).map(renderText);
    const defense = renderText(authored.defenses[record.id]);
    const originFull = renderText(record.originFull);
    const defenseFull = renderText(record.defenseFull);

    const line = ORIGIN_LINE[record.id];
    if (line) staged.line += 1;
    else staged.note += 1;
    const origin = line ? { line: renderText(line) } : { note: NO_ORIGIN };

    const card = {
      id: record.id,
      sourceCardNo: record.sourceCardNo,
      name,
      stage: record.stage,
      kicker: record.kicker,
      scenario,
      scenarioSize: scenarioSizeFor(scenario.length),
      nameSize: nameSizeFor(name.length),
      schematic: label,
      script,
      defense,
      defenseSize: row.defenseSize,
      origin,
      figure: {
        svgShape: "negotiation-figure",
        parametricParams: {
          family: row.family,
          divisions: row.divisions,
          mark: row.mark
        }
      },
      originFull,
      defenseFull
    };

    // The basis quote names the phrase the marked position rides on. The map
    // uses the block names; the record uses its field names.
    const basisField = { origin: "originFull", defense: "defenseFull" }[row.basis.field] || row.basis.field;
    const basisValue = card[basisField];
    const basisText = Array.isArray(basisValue) ? basisValue.join("\n") : String(basisValue ?? "");
    if (!basisText.includes(row.basis.quote)) {
      throw new Error(`${record.id} basis quote ${JSON.stringify(row.basis.quote)} is not in its own ${basisField}`);
    }

    // A short defense is a compression, not a new claim: every number it
    // prints must appear in the block it was compressed from.
    const numbers = (text) => String(text).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
    const sourceNumbers = new Set(numbers(defenseFull));
    for (const number of numbers(defense)) {
      if (!sourceNumbers.has(number)) {
        throw new Error(`${record.id} short defense states ${number}, which its source block does not`);
      }
    }

    const strings = [
      ["name", card.name],
      ["scenario", card.scenario],
      ["defense", card.defense],
      ["schematic", card.schematic],
      ["origin", card.origin.line || ""],
      ["originFull", card.originFull],
      ["defenseFull", card.defenseFull],
      ...card.script.map((text, index) => [`script[${index}]`, text])
    ];
    for (const [field, value] of strings) {
      const residue = latexResidue(value);
      if (residue) throw new Error(`${record.id}.${field} keeps macro residue ${JSON.stringify(residue)}`);
      const lower = value.toLowerCase();
      for (const name of FORBIDDEN) {
        if (lower.includes(name)) throw new Error(`${record.id}.${field} names the forbidden string ${JSON.stringify(name)}`);
      }
    }

    await writeFile(join(laws, `${card.id.toLowerCase()}.json`), JSON.stringify(card, null, 2) + "\n");
  }

  if (staged.line !== 3 || staged.note !== 41) {
    throw new Error(`attribution has ${staged.line} named and ${staged.note} unnamed, expected 3 and 41`);
  }
  console.log(`wrote ${inventory.cards.length} cards to ${laws}; attribution ${staged.line} named, ${staged.note} honest`);
};

await main();
