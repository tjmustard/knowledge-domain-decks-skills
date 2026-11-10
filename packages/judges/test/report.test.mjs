import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, renderMarkdown, convergence } from "../lib/report.mjs";

const manifest = {
  id: "run-1",
  startedAt: "2026-11-10T08:00:00Z",
  artifact: { path: "SKILL.md", sha256: "abc123", bytes: 25084 },
  panel: { name: "deck-skill", authorFamily: "deepseek" },
  endpoint: "http://127.0.0.1:11434",
  promptChars: 26906
};

const judge = (model, findings, status = "ok") => ({
  model,
  family: "x",
  status,
  verdict: status === "ok" ? "conditional" : null,
  scores: status === "ok" ? { functional_accuracy: 3, constraint_adherence: 3, edge_case_resilience: 3, token_efficiency: 3 } : null,
  findings,
  ambiguities: [],
  gaps: [],
  problems: []
});

test("counts convergence only when two judges raise the same quote", () => {
  const quote = "  Do not spend effort smoothing a middle the ending will overwrite. ";
  const judges = [
    judge("a", [{ severity: "Medium", quote, mechanism: "m", agent_does: "x" }]),
    judge("b", [{ severity: "Medium", quote: quote.trim(), mechanism: "m2", agent_does: "y" }]),
    judge("c", [{ severity: "Low", quote: "something else", mechanism: "m", agent_does: "z" }])
  ];
  const found = convergence(judges);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].judges.sort(), ["a", "b"]);
});

test("a truncated judge is not counted as answering", () => {
  const report = buildReport({
    manifest,
    judges: [judge("a", []), judge("b", [], "truncated")]
  });
  assert.equal(report.summary.judges, 2);
  assert.equal(report.summary.answered, 1);
});

test("the markdown header says nothing is adjudicated", () => {
  const report = buildReport({ manifest, judges: [judge("a", [])] });
  const md = renderMarkdown(report);
  assert.match(md, /Nothing here is adjudicated/);
  assert.match(md, /not evidence, it is a candidate/);
  assert.match(md, /abc123/);
});

test("names the models the panel deliberately did not ask", () => {
  const withExcluded = {
    ...manifest,
    excluded: [
      { model: "qwen3.5:4b", family: "alibaba", reason: "4096-token context" },
      { model: "deepseek-v4.1-flash:cloud", family: "deepseek", reason: "authoring family" }
    ]
  };
  const md = renderMarkdown(buildReport({ manifest: withExcluded, judges: [judge("a", [])] }));
  assert.match(md, /## Not run/);
  assert.match(md, /`qwen3\.5:4b` \(alibaba\) — 4096-token context/);
  assert.match(md, /`deepseek-v4\.1-flash:cloud` \(deepseek\) — authoring family/);
});

test("says nothing about exclusions when the panel had none", () => {
  const md = renderMarkdown(buildReport({ manifest, judges: [judge("a", [])] }));
  assert.doesNotMatch(md, /## Not run/);
});

test("instrument notes carry the truncation warning", () => {
  const truncated = { ...judge("b", [], "truncated"), truncation: "server read 2051 prompt tokens" };
  const md = renderMarkdown(buildReport({ manifest, judges: [truncated] }));
  assert.match(md, /TRUNCATED: server read 2051 prompt tokens/);
});
