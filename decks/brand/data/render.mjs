/*
 * The declared rendering table for the brand deck.
 *
 * The source is markdown, and its authors escaped characters for that syntax:
 * `\-\>` and `\<-\>` protect arrows from being read as HTML, `\[` and `\]`
 * protect the placeholders in a fill-in template, `\*` protects a letter in a
 * book title, and card 21 carries real math notation written in the same
 * escape style (`\$S\_1\$`, `\\sim`). A backslash that reaches a card or a
 * rules line is a character the reader was never meant to see, so every entry
 * below is a declared substitution: nothing is rendered by an undeclared rule,
 * and anything that still contains `\`, `{` or `}` after rendering fails the
 * build.
 *
 * Two decisions here are typographic rather than mechanical, and both are
 * declared rather than left to the scanner:
 *
 *   - An escaped arrow prints as the arrow. The source writes `\-\>` to keep
 *     "->" out of HTML; the author meant an arrow, so the deck prints "→"
 *     (and "↔" for the doubled form).
 *   - Card 21's math delimiters drop. `\$` opens and closes math mode and `\_`
 *     marks a subscript, so `\$S\_1\$` prints "S1" and `\$\\sim S\_1\$` prints
 *     "~S1". The card therefore prints its four corners as "S1, S2, ~S1, ~S2",
 *     which is the recorded reading of the source's notation.
 */
const TABLE = [
  { from: "\\-\\>", to: "→", kind: "arrow", means: "the arrow the source escaped from markdown" },
  { from: "\\<-\\>", to: "↔", kind: "arrow", means: "the doubled arrow the source escaped" },
  { from: "\\\\sim", to: "~", kind: "notation", means: "the negation operator in card 21's square" },
  { from: "\\$", to: "", kind: "notation", means: "math-mode delimiter: dropped, the corners print plainly" },
  { from: "\\_", to: "", kind: "notation", means: "subscript marker: dropped, so S_1 prints S1" },
  { from: "\\[", to: "[", kind: "escape", means: "literal bracket" },
  { from: "\\]", to: "]", kind: "escape", means: "literal bracket" },
  { from: "\\(", to: "(", kind: "escape", means: "literal parenthesis" },
  { from: "\\)", to: ")", kind: "escape", means: "literal parenthesis" },
  { from: "\\*", to: "*", kind: "escape", means: "literal asterisk" },
  { from: "\\+", to: "+", kind: "escape", means: "literal plus" },
  { from: "\\-", to: "-", kind: "escape", means: "literal hyphen" },
  { from: "\\>", to: ">", kind: "escape", means: "literal greater-than" },
  { from: "\\<", to: "<", kind: "escape", means: "literal less-than" }
];

// Longest first, so `\-\>` is never read as a hyphen followed by a
// greater-than, and `\\sim` is never read as one backslash plus "sim".
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
