/*
 * The declared rendering table for the negotiation deck.
 *
 * The source is markdown written in an author's LaTeX habits, and those habits
 * left three escape classes in the card text: every currency amount is wrapped
 * in math-mode delimiters (`\$240,000`), one sentence stop is escaped
 * (`tier 3\.`), and two cards write their step chains with a doubled backslash
 * before "to" (`\\to`). A backslash that reaches a card or a rules line is a
 * character the reader was never meant to see, so every entry below is a
 * declared substitution: nothing is rendered by an undeclared rule, and
 * anything that still contains `\`, `{` or `}` after rendering fails the build.
 *
 * One decision here is typographic rather than mechanical, and it is declared
 * rather than left to the scanner:
 *
 *   - The escaped arrow prints as the arrow. Cards 21 and 28 write their
 *     chains as LaTeX arrows; the author meant "→", so the deck prints "→".
 *     Card 21 therefore reads "Active Listening → Empathy → Rapport →
 *     Influence → Behavioral Change" and card 28 "(65% → 85% → 95% → 100% of
 *     target)".
 */
const TABLE = [
  { from: "\\\\to", to: "→", kind: "arrow", means: "the LaTeX arrow in cards 21 and 28's chains" },
  { from: "\\$", to: "$", kind: "notation", means: "math-mode delimiter: dropped, the amount prints plainly" },
  { from: "\\.", to: ".", kind: "escape", means: "an escaped sentence stop" }
];

// Longest first, so `\\to` is never read as one backslash plus "to".
const SIMPLE = [...TABLE].sort((a, b) => b.from.length - a.from.length);

export const RENDER_TABLE = { entries: TABLE };

export function renderText(input) {
  const text = String(input ?? "");
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "\\") {
      out += ch;
      i += 1;
      continue;
    }
    const entry = SIMPLE.find((candidate) => text.startsWith(candidate.from, i));
    if (entry) {
      out += entry.to;
      i += entry.from.length;
      continue;
    }
    // An undeclared sequence is left untouched on purpose: the residue guard
    // is what turns it into a build failure, and the character that caused it
    // is reported rather than silently swallowed.
    out += ch;
    i += 1;
  }
  return out;
}

// The build fails on the first surviving backslash, brace or brace-like macro
// character. The function names the character, so the record and field that
// carried it are the thing reported.
export function latexResidue(text) {
  const hit = String(text ?? "").match(/[\\{}]/);
  return hit ? hit[0] : null;
}
