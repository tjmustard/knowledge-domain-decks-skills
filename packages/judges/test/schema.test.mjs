import test from "node:test";
import assert from "node:assert/strict";
import { validateJudgeOutput, extractJson, normaliseJudgeOutput } from "../lib/schema.mjs";

const good = {
  failures: [
    {
      severity: "High",
      quote: "Do not spend effort smoothing a middle",
      mechanism: "converts a memory effect into effort allocation",
      agent_does: "leaves a mid-flow defect unfixed"
    }
  ],
  ambiguities: [],
  coverage_gaps: [],
  scores: { functional_accuracy: 3, constraint_adherence: 4, edge_case_resilience: 2, token_efficiency: 4 },
  verdict: "conditional",
  verdict_reason: "one real defect"
};

test("accepts a well-formed verdict", () => {
  const result = validateJudgeOutput(good);
  assert.equal(result.ok, true, result.problems.join("\n"));
});

test("names every dropped field once rather than failing on the first", () => {
  const thin = {
    ...good,
    failures: [
      { quote: "a", mechanism: "b" },
      { quote: "c", mechanism: "d" }
    ]
  };
  const result = validateJudgeOutput(thin);
  assert.equal(result.ok, false);
  const missing = result.problems.find((p) => p.startsWith("findings missing"));
  assert.ok(missing.includes("severity"), missing);
  assert.ok(missing.includes("agent_does"), missing);
});

test("rejects a score outside 1-5 and a verdict outside the enum", () => {
  const bad = { ...good, verdict: "maybe", scores: { ...good.scores, functional_accuracy: 0 } };
  const result = validateJudgeOutput(bad);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("scores.functional_accuracy")));
  assert.ok(result.problems.some((p) => p.includes("verdict")));
});

test("normalises severity case rather than reporting it as a defect", () => {
  const lowered = {
    ...good,
    failures: [{ ...good.failures[0], severity: " high " }]
  };
  const result = validateJudgeOutput(normaliseJudgeOutput(lowered));
  assert.equal(result.ok, true, result.problems.join("\n"));
  assert.equal(lowered.failures[0].severity, "High");
});

test("extracts the LAST JSON object, because models restate the schema first", () => {
  const text = [
    "Here is the shape I will use:",
    '{"failures": [], "ambiguities": [], "coverage_gaps": [], "scores": {}, "verdict": "pass", "verdict_reason": "echo"}',
    "Now the real answer.",
    '{"failures": [{"severity": "Low", "quote": "q", "mechanism": "m", "agent_does": "a"}], "ambiguities": [], "coverage_gaps": [], "scores": {"functional_accuracy": 3, "constraint_adherence": 3, "edge_case_resilience": 3, "token_efficiency": 3}, "verdict": "conditional", "verdict_reason": "real"}'
  ].join("\n");
  const parsed = extractJson(text);
  assert.equal(parsed.verdict, "conditional");
  assert.equal(parsed.failures.length, 1);
});

test("does not trip over braces inside strings", () => {
  const text = 'prose {"failures": [], "ambiguities": [], "coverage_gaps": ["a } brace"], "scores": {"functional_accuracy": 3, "constraint_adherence": 3, "edge_case_resilience": 3, "token_efficiency": 3}, "verdict": "pass", "verdict_reason": "ok"}';
  const parsed = extractJson(text);
  assert.equal(parsed.coverage_gaps[0], "a } brace");
});

test("returns null when there is no object at all", () => {
  assert.equal(extractJson("no json here"), null);
});
