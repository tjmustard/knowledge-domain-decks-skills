/*
 * The shape every judge is asked to return, and the checks that say whether it
 * did.
 *
 * The schema is sent as Ollama's `format` field. Two of the three models in the
 * first panel honoured it; glm ignored it and wrote twenty thousand tokens of
 * prose before emitting the object. So validation here is deliberately tolerant:
 * a judge that drops a required field is recorded as a problem and its findings
 * are still kept, because the finding is evidence and the field is bookkeeping.
 */

export const FINDING_SCHEMA = {
  type: "object",
  properties: {
    failures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
          quote: { type: "string" },
          mechanism: { type: "string" },
          agent_does: { type: "string" }
        },
        required: ["severity", "quote", "mechanism", "agent_does"]
      }
    },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          reading_a: { type: "string" },
          reading_b: { type: "string" }
        },
        required: ["quote", "reading_a", "reading_b"]
      }
    },
    coverage_gaps: { type: "array", items: { type: "string" } },
    scores: {
      type: "object",
      properties: {
        functional_accuracy: { type: "integer" },
        constraint_adherence: { type: "integer" },
        edge_case_resilience: { type: "integer" },
        token_efficiency: { type: "integer" }
      },
      required: [
        "functional_accuracy",
        "constraint_adherence",
        "edge_case_resilience",
        "token_efficiency"
      ]
    },
    verdict: { type: "string", enum: ["pass", "conditional", "fail"] },
    verdict_reason: { type: "string" }
  },
  required: ["failures", "ambiguities", "coverage_gaps", "scores", "verdict", "verdict_reason"]
};

export const REQUIRED_TOP_LEVEL = FINDING_SCHEMA.required;
export const REQUIRED_FINDING_FIELDS = FINDING_SCHEMA.properties.failures.items.required;

/*
 * Case is bookkeeping, not a finding. glm returns "medium" and "low"; the
 * concept is right and the enum is capitalised. Normalise before validating so
 * the report's schema section only carries things an adjudicator must act on,
 * rather than a paragraph about one model's capitalisation habits.
 */
export function normaliseJudgeOutput(value) {
  if (!value || typeof value !== "object") return value;
  const canonical = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  const findings = Array.isArray(value.failures) ? value.failures : [];
  for (const finding of findings) {
    if (finding && typeof finding.severity === "string") {
      const key = finding.severity.trim().toLowerCase();
      if (canonical[key]) finding.severity = canonical[key];
    }
  }
  return value;
}

const isArray = Array.isArray;
const isObject = (v) => v !== null && typeof v === "object" && !isArray(v);

// Report every way the object falls short, rather than the first. A judge that
// dropped `severity` from all sixty findings should say so once, in full, where
// an adjudicator can see it.
export function validateJudgeOutput(value) {
  const problems = [];
  if (!isObject(value)) {
    return { ok: false, problems: ["output is not a JSON object"] };
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in value)) problems.push(`missing ${key}`);
  }
  for (const key of ["failures", "ambiguities", "coverage_gaps"]) {
    if (key in value && !isArray(value[key])) problems.push(`${key} is not an array`);
  }
  if (isArray(value.failures)) {
    const missing = new Set();
    value.failures.forEach((f, i) => {
      if (!isObject(f)) {
        problems.push(`failures[${i}] is not an object`);
        return;
      }
      for (const field of REQUIRED_FINDING_FIELDS) {
        if (!(field in f) || f[field] === "" || f[field] === null) missing.add(field);
      }
      if ("severity" in f && !["Critical", "High", "Medium", "Low"].includes(f.severity)) {
        problems.push(`failures[${i}].severity is ${JSON.stringify(f.severity)}`);
      }
    });
    if (missing.size > 0) {
      problems.push(`findings missing ${[...missing].join(", ")}`);
    }
  }
  if (isObject(value.scores)) {
    for (const key of Object.keys(FINDING_SCHEMA.properties.scores.properties)) {
      const score = value.scores[key];
      if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
        problems.push(`scores.${key} is ${JSON.stringify(score)}, expected an integer 1-5`);
      }
    }
  }
  if ("verdict" in value && !["pass", "conditional", "fail"].includes(value.verdict)) {
    problems.push(`verdict is ${JSON.stringify(value.verdict)}`);
  }
  return { ok: problems.length === 0, problems };
}

/*
 * Pull the last balanced JSON object containing `anchor` out of free text.
 *
 * This exists for models that ignore `format`. It takes the LAST candidate, not
 * the first, because glm opens its reply by restating the schema it was given —
 * a perfect, empty object — and only the closing one carries findings.
 */
export function extractJson(text, anchor = "verdict") {
  const starts = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") starts.push(i);
  }
  let found = null;
  for (const start of starts) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const blob = text.slice(start, i + 1);
          if (blob.includes(`"${anchor}"`)) {
            try {
              found = JSON.parse(blob);
            } catch {
              // Not valid JSON; a later candidate may be. Keep scanning.
            }
          }
          break;
        }
      }
    }
  }
  return found;
}
