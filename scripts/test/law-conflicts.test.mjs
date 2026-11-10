/*
 * The known-tensions register.
 *
 * Its whole value is that a row settles something. A register of "these two
 * cards disagree" would move the decision back to the reader, which is where
 * the audit started, so the check here is that every ruling names a card the
 * deck has and names the winner. The last test reads the generated index,
 * because a ruling that never reaches the skill has not settled anything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkConflicts } from "../../packages/core/law-conflicts.mjs";
import { loadCards, loadConflicts, loadDeck } from "../../packages/core/deck.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const deck = await loadDeck("ux-laws");

test("the shipped register names the winning card in every row", async () => {
  const cards = await loadCards(deck);
  const conflicts = await loadConflicts(deck);
  assert.ok(conflicts.length >= 2, "the register lost its seeded rows");
  const result = checkConflicts(conflicts, cards.map((card) => card.id));
  assert.deepEqual(result.problems, []);
});

test("a ruling that names no winner is rejected", () => {
  const result = checkConflicts(
    [{ cards: ["DEC-01", "MPA-01"], subject: "navigation size", ruling: "The two cards disagree." }],
    ["DEC-01", "MPA-01"]
  );
  assert.match(result.problems.join("\n"), /must start with the winning card id/);
});

test("a row naming a card the deck does not have is rejected", () => {
  const result = checkConflicts(
    [{ cards: ["DEC-01", "NOPE-99"], subject: "navigation size", ruling: "DEC-01 wins: the narrower card." }],
    ["DEC-01"]
  );
  assert.match(result.problems.join("\n"), /NOPE-99 is not a card/);
});

test("the generated skill carries every ruling", async () => {
  const conflicts = await loadConflicts(deck);
  const skill = await readFile(join(ROOT, deck.outputs.skill, "SKILL.md"), "utf8");
  assert.match(skill, /## Known tensions/);
  for (const row of conflicts) {
    assert.ok(skill.includes(row.ruling), `ruling missing from SKILL.md: ${row.ruling}`);
  }
});
