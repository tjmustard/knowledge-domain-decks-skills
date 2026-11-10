/*
 * The known-tensions register: cards that pull in different directions, and the
 * ruling that says which one wins.
 *
 * A deck's cards are written independently, so two of them can prescribe
 * incompatible fixes. The cross-model audit that found this could only say the
 * generated skill had no conflict rule; a reader of the skill has the same
 * problem, with less context. Recording "these two disagree" does not help an
 * agent decide anything, so every row carries a ruling that names the winner
 * and says why. The register records the ruling; it does not replace it - the
 * records themselves are rewritten where the ruling changes their advice.
 *
 * A row holds one or two card ids (one means the tension is inside a single
 * card), the subject it is about, and the ruling. The check here is structural:
 * the ids must exist, the row must not be empty, and the ruling must name one
 * of the row's own cards as the winner. Whether the reasoning is good is a
 * review question, not something a regular expression can settle.
 */

export function checkConflicts(rows, cardIds) {
  if (!Array.isArray(rows)) {
    return { problems: ["the register must be an array of rows"], rows: 0 };
  }
  const problems = [];
  const known = new Set(cardIds);
  const seen = new Set();

  rows.forEach((row, index) => {
    const where = `row ${index + 1}`;
    const cards = row?.cards;
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > 2) {
      problems.push(`${where}: cards must list one or two card ids`);
      return;
    }
    if (new Set(cards).size !== cards.length) {
      problems.push(`${where}: cards repeats an id`);
    }
    for (const id of cards) {
      if (!known.has(id)) problems.push(`${where}: ${id} is not a card in this deck`);
    }
    const key = [...cards].sort().join("|");
    if (seen.has(key)) problems.push(`${where}: the same card set appears twice`);
    seen.add(key);

    if (typeof row.subject !== "string" || row.subject.trim() === "") {
      problems.push(`${where}: subject is empty`);
    }
    if (typeof row.ruling !== "string" || row.ruling.trim() === "") {
      problems.push(`${where}: ruling is empty`);
      return;
    }
    // A ruling that names neither card leaves the reader where the audit
    // started. The winner is the card the sentence begins with.
    const winner = cards.find((id) => new RegExp(`^${id}\\b`).test(row.ruling));
    if (!winner) {
      problems.push(`${where}: ruling must start with the winning card id (${cards.join(" or ")})`);
    } else if (!/\bwins\b/.test(row.ruling)) {
      problems.push(`${where}: ruling must say which card wins`);
    }
  });

  return { problems, rows: rows.length };
}

// One line for the skill's index, so the reader sees which card the ruling
// favours before reading the sentence.
export function conflictHeading(row) {
  const cards = row.cards;
  return cards.length === 1 ? `${cards[0]} (within the card)` : `${cards[0]} vs ${cards[1]}`;
}
