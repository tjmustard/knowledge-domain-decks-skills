/*
 * Compile the brand deck's cards from the committed inventory and the layout
 * map.
 *
 * The forty-two frameworks are an extraction, so they are not retyped: this
 * builder is the one place the inventory, the layout map and the declared
 * rendering table are joined, and the cards under data/laws/ are its output.
 * The rules it enforces here rather than trusting to the schema:
 *
 *   - the source's own text reaches the record through render.mjs, and no
 *     printed field may carry a surviving backslash, brace or macro after it.
 *   - the printed schematic line must agree with the figure's own three
 *     numbers, so no card can print a label its drawing contradicts.
 *   - the layout map's basis quote must be found in that card's own record,
 *     so the position is fixed by the card, not by a neighbouring one.
 *   - attribution has two tiers: the line the source's pedigree gives, or the
 *     honest line. A record carrying both, or neither, is a build failure.
 *
 * Run from anywhere: node decks/brand/data/build-cards.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { latexResidue, renderText } from "./render.mjs";

const DIR = import.meta.dirname;

const FAMILY_LABEL = {
  ledger: "Ledger",
  matrix: "Matrix",
  axes: "Axes",
  score: "Score",
  arc: "Arc",
  tiers: "Tiers",
  manifest: "Manifest",
  facets: "Facets",
  rings: "Rings",
  statement: "Statement",
  network: "Network"
};

const UNIT = {
  ledger: "part",
  matrix: "cell",
  axes: "axis",
  score: "dimension",
  arc: "stage",
  tiers: "level",
  manifest: "key",
  facets: "facet",
  rings: "ring",
  statement: "clause",
  network: "node"
};

const expectedLabel = (row) => `${FAMILY_LABEL[row.family]} at ${UNIT[row.family]} ${row.mark} of ${row.divisions}`;

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

    const art = record.artifact.map(renderText);
    const fields = {
      pedigreeFull: renderText(record.pedigreeFull),
      artifactFull: renderText(record.artifactFull),
      trapFull: renderText(record.trapFull)
    };

    if (Boolean(record.origin.line) === Boolean(record.origin.note)) {
      throw new Error(`${record.id} origin must carry exactly one of line or note`);
    }

    const card = {
      id: record.id,
      sourceCardNo: record.n,
      name: renderText(record.name),
      pillar: record.pillar,
      kicker: record.kicker,
      diagnostic: renderText(record.diagnostic),
      diagnosticSize: row.diagnosticSize,
      schematic: row.label,
      artifact: art,
      trap: renderText(record.trap),
      origin: record.origin.line ? { line: renderText(record.origin.line) } : { note: record.origin.note },
      figure: {
        svgShape: "brand-figure",
        parametricParams: {
          family: row.family,
          divisions: row.divisions,
          mark: row.mark
        }
      },
      pedigreeFull: fields.pedigreeFull,
      artifactFull: fields.artifactFull,
      trapFull: fields.trapFull,
      ...(record.sourceNote ? { sourceNote: renderText(record.sourceNote) } : {})
    };

    const basisValue = card[row.basis.field];
    const basisText = Array.isArray(basisValue) ? basisValue.join("\n") : String(basisValue ?? "");
    if (!basisText.includes(row.basis.quote)) {
      throw new Error(`${record.id} basis quote ${JSON.stringify(row.basis.quote)} is not in its own ${row.basis.field}`);
    }

    const strings = [
      ["name", card.name],
      ["diagnostic", card.diagnostic],
      ["trap", card.trap],
      ["pedigreeFull", card.pedigreeFull],
      ["artifactFull", card.artifactFull],
      ["trapFull", card.trapFull],
      ["origin", card.origin.line || ""],
      ...(card.sourceNote ? [["sourceNote", card.sourceNote]] : []),
      ...card.artifact.map((line, index) => [`artifact[${index}]`, line])
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
