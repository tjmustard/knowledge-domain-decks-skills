/*
 * Compile the productivity deck's cards from the committed inventory and the
 * layout map.
 *
 * The forty-four tactics are an extraction, so they are not retyped: this
 * builder is the one place the inventory, the layout map and the declared
 * rendering table are joined, and the cards under data/laws/ are its output.
 * The rules it enforces here rather than trusting to the schema:
 *
 *   - the source's own text reaches the record through render.mjs, and no
 *     printed field may carry a surviving backslash, brace or macro after it.
 *   - the printed schematic line must agree with the figure's own two numbers,
 *     so no card can print a label its drawing contradicts.
 *   - the short procedure must number exactly the source's steps, plus the one
 *     recorded correction (TAC-14's glued fifth step).
 *   - attribution has two tiers: the name the tactic title carries, or the
 *     honest line. There is no checked-record tier here, on purpose.
 *
 * Run from anywhere: node decks/productivity/data/build-cards.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { latexResidue, renderText } from "./render.mjs";

const DIR = import.meta.dirname;
const NO_ORIGIN = { note: "The source names no originator." };

// The eleven tactics whose titles name a person. The card prints the name the
// title carries and nothing else: the source gives no work, year or
// publication, and a citation this deck invented could not be checked later.
const NAMED = {
  "TAC-12": "Eisenhower",
  "TAC-13": "Warren Buffett",
  "TAC-14": "Ivy Lee",
  "TAC-21": "Derek Sivers",
  "TAC-23": "Newport",
  "TAC-25": "Paul Graham",
  "TAC-34": "Gollwitzer",
  "TAC-35": "Clear",
  "TAC-36": "Clear",
  "TAC-37": "Clear",
  "TAC-38": "Clear"
};

const UNIT = {
  pipeline: "stage",
  gate: "route",
  matrix: "cell",
  gauge: "level",
  rhythm: "beat",
  loop: "step",
  ladder: "rung",
  threshold: "point"
};

const FAMILY_LABEL = {
  pipeline: "Pipeline",
  gate: "Gate",
  matrix: "Matrix",
  gauge: "Gauge",
  rhythm: "Rhythm",
  loop: "Loop",
  ladder: "Ladder",
  threshold: "Threshold"
};

function expectedLabel(row) {
  return `${FAMILY_LABEL[row.family]} at ${UNIT[row.family]} ${row.mark} of ${row.divisions}`;
}

const main = async () => {
  const inventory = JSON.parse(await readFile(join(DIR, "source-inventory.json"), "utf8"));
  const layout = JSON.parse(await readFile(join(DIR, "layout-map.json"), "utf8"));
  const laws = join(DIR, "laws");
  await mkdir(laws, { recursive: true });

  const ids = inventory.cards.map((card) => card.id);
  const missing = ids.filter((id) => !layout.map[id]);
  if (missing.length > 0) throw new Error(`no layout row for ${missing.join(", ")}`);
  const extra = Object.keys(layout.map).filter((id) => !ids.includes(id));
  if (extra.length > 0) throw new Error(`layout rows with no record: ${extra.join(", ")}`);

  for (const record of inventory.cards) {
    const row = layout.map[record.id];
    const label = expectedLabel(row);
    if (row.label !== label) {
      throw new Error(`${record.id} label ${JSON.stringify(row.label)} contradicts its figure; expected ${JSON.stringify(label)}`);
    }
    if (row.mark < 1 || row.mark > row.divisions) {
      throw new Error(`${record.id} mark ${row.mark} is outside 1..${row.divisions}`);
    }

    const card = {
      id: record.id,
      sourceTacticNo: record.n,
      name: renderText(record.name),
      domain: record.domain,
      diagnostic: renderText(record.diagnostic),
      diagnosticSize: row.diagnosticSize,
      schematic: row.label,
      procedure: record.procedure.map((step) => ({ text: renderText(step) })),
      trap: renderText(record.trap),
      origin: NAMED[record.id] ? { authors: [NAMED[record.id]] } : NO_ORIGIN,
      figure: {
        svgShape: "productivity-figure",
        parametricParams: {
          family: row.family,
          divisions: row.divisions,
          mark: row.mark
        }
      },
      procedureFull: renderText(record.procedureFull),
      setupFull: renderText(record.setupFull),
      trapFull: renderText(record.trapFull),
      ...(record.sourceNote ? { sourceNote: renderText(record.sourceNote) } : {})
    };

    const corrected = record.procedure.length - record.stepsDeclared;
    if (corrected !== 0 && corrected !== 1) {
      throw new Error(`${record.id} prints ${record.procedure.length} short steps against ${record.stepsDeclared} declared`);
    }
    if (corrected === 1 && !record.sourceNote) {
      throw new Error(`${record.id} adds a step without the note that explains it`);
    }

    // No printed string may carry a macro after rendering. The builder fails
    // here rather than letting a backslash reach a card or a rules line.
    const strings = [
      ["name", card.name],
      ["diagnostic", card.diagnostic],
      ["trap", card.trap],
      ["procedureFull", card.procedureFull],
      ["setupFull", card.setupFull],
      ["trapFull", card.trapFull],
      ...(card.sourceNote ? [["sourceNote", card.sourceNote]] : []),
      ...card.procedure.map((step, index) => [`procedure[${index}]`, step.text])
    ];
    for (const [field, value] of strings) {
      const residue = latexResidue(value);
      if (residue) throw new Error(`${record.id}.${field} keeps macro residue ${JSON.stringify(residue)}`);
    }

    await writeFile(join(laws, `${card.id.toLowerCase()}.json`), JSON.stringify(card, null, 2) + "\n");
  }

  console.log(`wrote ${inventory.cards.length} cards to ${laws}`);
};

await main();
