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
  "ST-01": {
    authors: ["E. St. Elmo Lewis"],
    year: 1908,
    title: "Financial Advertising",
    publication: "Levey Bros. & Company",
    note:
      "Checked 2026-11-10: the 1908 book states attention, interest and conviction; the four-step AIDA and the 1898 date are later textbook attribution."
  },
  "ST-04": {
    authors: ["Michel Fortin"],
    year: 2006,
    title: "The Death of the Salesletter",
    note:
      "Checked 2026-11-10 on Fortin's own page: he dates QUEST to his late-1990s teaching at Algonquin College and names the 2006 essay where it was set out."
  },
  "ST-08": {
    authors: ["Ray Edwards"],
    year: 2016,
    title: "How to Write Copy That Sells",
    publication: "Morgan James Publishing",
    note:
      "Checked 2026-11-10 against the publisher's release list and the library catalogue: Morgan James, New York, 2016."
  },
  "ST-09": {
    authors: ["Russell Brunson"],
    year: 2022,
    title: "DotCom Secrets",
    publication: "Hay House",
    note:
      "Checked 2026-11-10: the Hay House edition prints the Star Story Solution script at p. 279 and credits Vince James with the formula."
  },
  "ST-11": {
    authors: ["Danny Iny"],
    year: 2011,
    title: "Introducing The Fabulous 6 + 1 Model For Effective Copywriting (Better Than AIDA!)",
    publication: "Smashing Magazine",
    note: "Checked 2026-11-10: the magazine's own page carries the article and its date, 11 October 2011."
  },
  "CR-05": {
    authors: ["Gary Provost"],
    year: 1985,
    title: "100 Ways to Improve Your Writing",
    publication: "Signet",
    note:
      "Checked 2026-11-10: the rhythm passage is at pp. 60-61 of the 1985 Signet edition, as cited by university writing centres."
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
    const template = record.blueprint ? record.template : null;
    if (record.blueprint && typeof template !== "string") {
      throw new Error(`${record.formulaId} is a blueprint with no template`);
    }
    // The back prints one line per source line, and a taxonomy-only card prints
    // the deck's own sentence under the same heading instead of a template.
    // The joined string stays on the record so the artifacts and the schema
    // keep one canonical template.
    const templateLines = record.blueprint ? record.templateLines : null;
    if (record.blueprint && templateLines.join(" ") !== template) {
      throw new Error(`${record.formulaId}'s templateLines do not join to its template`);
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
      ...(templateLines ? { templateLines } : { noTemplate: NO_TEMPLATE }),
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
