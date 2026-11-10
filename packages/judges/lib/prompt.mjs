/*
 * Prompt assembly, and the check that catches silent truncation.
 *
 * The truncation check exists because of a measured failure: Ollama's default
 * context is 2048 tokens, so the first gemma run received about a twelfth of a
 * 27 KB artifact, scored every dimension 0, and returned a confident verdict
 * about text it had never seen. Nothing in the response said so. The only
 * signal was `prompt_eval_count: 2051` against a prompt of 26,906 characters.
 *
 * We cannot tokenize without a tokenizer, but we can bound from below: no
 * English text tokenizes at better than about six characters per token, so a
 * prompt of N characters must cost at least N/6 tokens. If the server reports
 * fewer, it did not read what we sent.
 */
const MIN_CHARS_PER_TOKEN = 6;

export function renderPrompt(template, { kind, job, artifact, path = "" }) {
  const values = { "{{KIND}}": kind, "{{JOB}}": job, "{{ARTIFACT}}": artifact, "{{PATH}}": path };
  let out = template;
  for (const [placeholder, value] of Object.entries(values)) {
    if (!out.includes(placeholder)) {
      throw new Error(`prompt template is missing ${placeholder}; refusing to send a prompt it cannot fill`);
    }
    out = out.split(placeholder).join(value);
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) {
    throw new Error(`prompt template has unfilled placeholders: ${[...new Set(leftover)].join(", ")}`);
  }
  return out;
}

// Lower bound on the prompt's token cost. Used to detect truncation, never to
// size a budget: a real tokenizer can differ by 30% either way.
export function minimumPromptTokens(promptText) {
  return Math.floor(promptText.length / MIN_CHARS_PER_TOKEN);
}

// A run is truncated when the server reports fewer prompt tokens than the
// prompt can possibly cost. Returns null when the measurement looks honest and
// a sentence explaining the gap when it does not.
export function truncation(promptText, promptTokens) {
  if (!Number.isInteger(promptTokens) || promptTokens <= 0) {
    return "the server did not report prompt_eval_count, so truncation cannot be ruled out";
  }
  const floor = minimumPromptTokens(promptText);
  if (promptTokens < floor) {
    return `server read ${promptTokens} prompt tokens; this prompt cannot cost fewer than ${floor}, so it was truncated before the model saw it`;
  }
  return null;
}
