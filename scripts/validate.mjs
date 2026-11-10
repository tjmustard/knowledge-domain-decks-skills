#!/usr/bin/env node
/*
 * Validate every card against data/law-schema.json.
 *
 * Usage:
 *   node scripts/validate.mjs                 # validate data/laws/*.json
 *   node scripts/validate.mjs path/to/card.json ...
 *
 * Exits 0 when every record is valid; exits 1 with per-field errors otherwise.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { ROOT, loadCards, wordCount } from "./lib/deck.mjs";

const schemaPath = join(ROOT, "data", "law-schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const argFiles = process.argv.slice(2);
let cards;
let label;
if (argFiles.length > 0) {
  cards = [];
  for (const file of argFiles) {
    cards.push(JSON.parse(await readFile(file, "utf8")));
  }
  label = argFiles.join(", ");
} else {
  cards = await loadCards();
  label = "data/laws/*.json";
}

let failed = 0;
const seen = new Map();

for (const card of cards) {
  const errors = [];
  if (!validate(card)) {
    for (const err of validate.errors) {
      const where = err.instancePath || "(root)";
      errors.push(`${where} ${err.message}`);
    }
  }

  // The schema can only bound characters; the source prose also says
  // "15 words or fewer", so enforce that here too.
  if (typeof card.axiom === "string" && wordCount(card.axiom) > 15) {
    errors.push(`/axiom exceeds 15 words (${wordCount(card.axiom)})`);
  }

  if (card.id) {
    if (seen.has(card.id)) {
      errors.push(`/id duplicates ${seen.get(card.id)}`);
    } else {
      seen.set(card.id, card.name || card.id);
    }
  }

  if (errors.length > 0) {
    failed += 1;
    console.error(`FAIL ${card.id || "(no id)"} — ${card.name || "(unnamed)"}`);
    for (const error of errors) console.error(`  - ${error}`);
  } else {
    console.log(`ok   ${card.id} — ${card.name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cards.length} record(s) failed schema validation (${label}).`);
  process.exit(1);
}

console.log(`\nOK: ${cards.length} record(s) valid against ${schema.$id || schemaPath}.`);
