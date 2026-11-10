/*
 * The declared rendering table for the one LaTeX formula in the source.
 *
 * CR-02's blueprint prose carries the Gunning Fog formula as LaTeX. The deck
 * prints the formula, so the markup is rendered through this table rather than
 * stripped: deck nine shipped a guard that fails on surviving macro tokens, and
 * the same rule applies here with braces added. Anything the table does not
 * name is left alone, so the guard fails loudly instead of the renderer
 * guessing.
 */
export const LATEX_TABLE = [
  { from: "\\text{x}", to: "x", note: "a text group prints its words" },
  { from: "\\frac{a}{b}", to: "a ÷ b", note: "a fraction prints as a division" },
  { from: "\\left[", to: "[", note: "a scaled bracket is a bracket" },
  { from: "\\right]", to: "]", note: "a scaled bracket is a bracket" },
  { from: "\\left(", to: "(", note: "a scaled bracket is a bracket" },
  { from: "\\right)", to: ")", note: "a scaled bracket is a bracket" },
  { from: "\\=", to: "=", note: "an escaped equals is an equals" }
];

// The innermost group a command takes, so a fraction of two text groups renders
// from the inside out.
const group = (text, open) => {
  if (text[open] !== "{") return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
};

const renderCommand = (text, command, arity, join) => {
  let out = text;
  let cursor = 0;
  for (;;) {
    const at = out.indexOf(command, cursor);
    if (at < 0) return out;
    const args = [];
    let end = at + command.length;
    let ok = true;
    for (let n = 0; n < arity; n += 1) {
      const found = group(out, end);
      if (!found) {
        ok = false;
        break;
      }
      args.push(found.body);
      end = found.end;
    }
    if (!ok) {
      cursor = at + command.length;
      continue;
    }
    out = out.slice(0, at) + join(...args) + out.slice(end);
    cursor = 0;
  }
};

export function renderFormula(text) {
  if (typeof text !== "string") return text;
  // Text groups first, so a fraction whose arguments are text groups renders.
  let out = renderCommand(text, "\\text", 1, (body) => body);
  out = renderCommand(out, "\\frac", 2, (top, bottom) => `${top.trim()} ÷ ${bottom.trim()}`);
  for (const rule of LATEX_TABLE) {
    if (rule.from === "\\text{x}" || rule.from === "\\frac{a}{b}") continue;
    out = out.split(rule.from).join(rule.to);
  }
  return out;
}

// A printed field may carry no surviving LaTeX: no backslash, no brace.
export const latexResidue = (text) => {
  if (typeof text !== "string") return null;
  const hit = text.match(/[\\{}]/);
  return hit ? hit[0] : null;
};
