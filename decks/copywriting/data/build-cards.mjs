/*
 * Compile the copy deck's cards from the committed inventory and layout map.
 *
 * The forty-eight formulas are an extraction, so they are not retyped: this
 * builder is the one place the inventory, the figure vocabulary and the ratio
 * lines are joined, and the cards under data/laws/ are its output. Two rules
 * are enforced here rather than trusted to the schema:
 *
 *   - a blueprint's template prints verbatim. Only the blueprint prose goes
 *     through the declared LaTeX table, and every printed string is checked for
 *     surviving macro residue before it is written.
 *   - a taxonomy-only formula prints the deck's own sentence saying the source
 *     prints no template. Nothing is filled in for it: no proportions, no
 *     template, no example.
 *
 * Run from anywhere: node decks/copywriting/data/build-cards.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { latexResidue, renderFormula } from "./latex.mjs";

const DIR = import.meta.dirname;
const NO_TEMPLATE =
  "The source prints this formula as a taxonomy row only: no template, no " +
  "proportions, no worked example. Write the pattern yourself from its surface " +
  "and its mechanism. Nothing here has been filled in on its behalf.";

const NO_ORIGIN = { note: "The source names no originator." };

// Verification is recorded, never assumed. A card whose originator a checked
// public record names carries that work and the date the check was made; every
// other card says plainly that the source names none.
const ORIGINS = {
  "ST-04": {
    authors: ["Michel Fortin"],
    year: 2006,
    title: "The Death of the Salesletter",
    note:
      "Checked 2026-11-10 on Fortin's own page: he dates QUEST to his late-1990s teaching at Algonquin College and names the 2006 essay where it was set out."
  }
};

const main = async () => {
  const inventory = JSON.parse(await readFile(join(DIR, "source-inventory.json"), "utf8"));
  const layout = JSON.parse(await readFile(join(DIR, "layout-map.json"), "utf8"));
  const laws = join(DIR, "laws");
  await mkdir(laws, { recursive: true });

  for (const record of inventory.records) {
    const row = layout.map[record.id];
    if (!row) throw new Error(`${record.id} has no layout row`);
    const ratio = layout.ratios[record.id];

    const blueprintProse =
      record.blueprintProse === null ? null : renderFormula(record.blueprintProse);
    const template = record.blueprint ? record.template : NO_TEMPLATE;
    if (record.blueprint && typeof template !== "string") {
      throw new Error(`${record.formulaId} is a blueprint with no template`);
    }

    const card = {
      id: record.id,
      formulaId: record.formulaId,
      name: record.name,
      phase: record.phase,
      surface: record.surface,
      mechanism: record.mechanism,
      scope: record.scope,
      blueprint: record.blueprint,
      blueprintProse,
      ...(ratio ? { ratio: ratio.pairs } : {}),
      frontLine: ratio ? ratio.frontLine : record.scope,
      frontSize: row.frontSize,
      schematic: row.label,
      template,
      example: record.blueprint ? record.example : null,
      origin: ORIGINS[record.formulaId] || NO_ORIGIN,
      figure: {
        svgShape: "copywriting-figure",
        parametricParams: {
          family: row.family,
          divisions: row.divisions,
          mark: row.mark
        }
      }
    };

    // No printed string may carry LaTeX after rendering. The builder fails
    // here rather than letting a backslash reach a card.
    for (const [field, value] of Object.entries(card)) {
      if (typeof value !== "string") continue;
      const residue = latexResidue(value);
      if (residue) throw new Error(`${record.id}.${field} keeps LaTeX residue ${JSON.stringify(residue)}`);
    }

    await writeFile(join(laws, `${card.id.toLowerCase()}.json`), JSON.stringify(card, null, 2) + "\n");
  }

  console.log(`wrote ${inventory.records.length} cards to ${laws}`);
};

await main();
