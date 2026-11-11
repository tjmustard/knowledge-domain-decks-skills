/*
 * The declared rendering table for the productivity deck.
 *
 * The source is markdown, and its authors escaped characters for that syntax:
 * `\#important` inside a pseudo-query, `\[ \]` around an HTML comment, `\-\>`
 * for an arrow, and, in five tactics, real formula notation (`\text{}`,
 * `\frac{}{}`, `\le`). A backslash that reaches a card or a rules line is a
 * macro the reader was never meant to see, so every entry below is a declared
 * substitution: nothing is rendered by an undeclared rule, and anything that
 * still contains `\`, `{` or `}` after rendering fails the build.
 *
 * The table is deliberately split by origin. The formula group is typeset
 * notation; the escape group is markdown syntax that the source's own prose
 * used to protect a character. Both print as the character the author meant.
 * `\times` occurs only inside a `\frac` argument in the source, but it is a
 * declared entry because the scanner meets it as its own token.
 */
const FORMULA = [
  { from: "\\text{...}", to: "the argument, unchanged", kind: "formula" },
  { from: "\\frac{a}{b}", to: "a ÷ b", kind: "formula" },
  { from: "\\times", to: "×", kind: "formula" },
  { from: "\\le", to: "≤", kind: "formula" },
  { from: "\\pm", to: "±", kind: "formula" }
];

const ESCAPE = [
  { from: "\\[", to: "[" },
  { from: "\\]", to: "]" },
  { from: "\\(", to: "(" },
  { from: "\\)", to: ")" },
  { from: "\\<", to: "<" },
  { from: "\\>", to: ">" },
  { from: "\\#", to: "#" },
  { from: "\\_", to: "_" },
  { from: "\\*", to: "*" },
  { from: "\\+", to: "+" },
  { from: "\\=", to: "=" },
  { from: "\\.", to: "." },
  { from: "\\!", to: "!" },
  { from: "\\-", to: "-" },
  { from: "\\|", to: "|" },
  { from: "\\`", to: "`" }
];

// The source doubles the backslash on four of the five formula macros - it
// prints `\\text{...}`, `\\frac{...}`, `\\le`, `\\times` - while the markdown
// escapes in the same cards keep one. A doubled backslash in front of a
// formula token is the same macro, so the scanner reads past one of the two
// and renders the token it finds. Nothing else is collapsed.
const DOUBLED = /^(text\{|frac\{|times\b|le\b|ge\b|pm\b)/;

// Longest first, so `\le` is never read as a prefix of something longer. The
// group readers for `\text` / `\frac` run before this list; the one-token
// formula entries (`\times`, `\le`, `\pm`) are read from it beside the
// markdown escapes.
const SIMPLE = [
  ...ESCAPE,
  ...FORMULA.filter((entry) => !entry.from.includes("{"))
].sort((a, b) => b.from.length - a.from.length);

export const RENDER_TABLE = { formula: FORMULA, escape: ESCAPE };

// Read a balanced `{...}` group starting at `from`. Backslash-escaped braces
// are skipped rather than counted; the source has none inside a group, and a
// scanner that miscounts there would silently drop text.
function takeBraced(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(from + 1, i), end: i + 1 };
    }
  }
  return null;
}

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
    if (text[i + 1] === "\\" && DOUBLED.test(text.slice(i + 2))) {
      // Read past the first backslash; the token starts at the second.
      i += 1;
      continue;
    }
    if (text.startsWith("\\text{", i)) {
      const group = takeBraced(text, i + 5);
      if (group) {
        out += renderText(group.inner);
        i = group.end;
        continue;
      }
    }
    if (text.startsWith("\\frac{", i)) {
      const numerator = takeBraced(text, i + 5);
      const denominator = numerator ? takeBraced(text, numerator.end) : null;
      if (numerator && denominator) {
        out += `${renderText(numerator.inner)} ÷ ${renderText(denominator.inner)}`;
        i = denominator.end;
        continue;
      }
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
// character. `latexResidue` names the character, not a count, so the record
// and the field that carried it are the thing reported.
export function latexResidue(text) {
  const hit = String(text ?? "").match(/[\\{}]/);
  return hit ? hit[0] : null;
}
