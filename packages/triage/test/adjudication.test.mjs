import test from "node:test";
import assert from "node:assert/strict";
import {
  claimsFromReport,
  joinReport,
  templateFromReport,
  validateAdjudication
} from "../lib/adjudication.mjs";
import { renderMarkdown } from "../lib/render.mjs";

const sha = "a".repeat(64);
const report = {
  run: {
    id: "run-1",
    artifact: { path: "SKILL.md", sha256: sha, bytes: 100 },
    panel: { name: "deck-skill" }
  },
  judges: [
    {
      model: "glm",
      findings: [
        { severity: "High", quote: "Update the interface at once on input", mechanism: "m", agent_does: "a" },
        { severity: "Low", quote: "Let Enter submit single-field forms", mechanism: "m", agent_does: "b" }
      ]
    },
    {
      model: "kimi",
      findings: [
        { severity: "Medium", quote: "  update the INTERFACE at once on input ", mechanism: "m", agent_does: "c" }
      ]
    }
  ]
};

const doc = (records) => ({ artifact: { path: "SKILL.md", sha256: sha }, records });
const verified = (quote, overrides = {}) => ({
  id: "A-01",
  quote,
  status: "verified",
  evidence: "skills/ux-laws/SKILL.md:234",
  ...overrides
});

test("one claim covers every judge that raised the same quote", () => {
  const claims = claimsFromReport(report);
  assert.equal(claims.length, 2);
  assert.deepEqual(claims[0].judges.sort(), ["glm", "kimi"]);
  assert.deepEqual(claims[0].severities.sort(), ["High", "Medium"]);
});

test("a claim with no record is unadjudicated, not silently dropped", () => {
  const joined = joinReport(report, doc([verified("Update the interface at once on input")]));
  assert.equal(joined.unadjudicated.length, 1);
  assert.equal(joined.unadjudicated[0].quote, "Let Enter submit single-field forms");
  assert.equal(joined.complete, false);
});

test("a record that matches no claim is orphaned, not counted as done", () => {
  const joined = joinReport(
    report,
    doc([
      verified("Update the interface at once on input"),
      verified("Let Enter submit single-field forms"),
      verified("a quote that the report never contained")
    ])
  );
  assert.equal(joined.orphaned.length, 1);
  assert.equal(joined.complete, false);
});

test("complete only when every claim has a verdict and nothing is orphaned", () => {
  const joined = joinReport(
    report,
    doc([verified("Update the interface at once on input"), verified("Let Enter submit single-field forms")])
  );
  assert.equal(joined.unadjudicated.length, 0);
  assert.equal(joined.orphaned.length, 0);
  assert.equal(joined.complete, true);
});

test("verified requires a source pointer, not just the word verified", () => {
  const result = validateAdjudication(doc([verified("Update the interface at once", { evidence: "checked it" })]));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("no source pointer")));
});

test("a rejection carries its reason", () => {
  const result = validateAdjudication(
    doc([{ id: "A-01", quote: "Update the interface at once", status: "rejected" }])
  );
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("no reason")));
});

test("a duplicate names the record or decision it duplicates", () => {
  const result = validateAdjudication(
    doc([{ id: "A-01", quote: "Update the interface at once", status: "duplicate" }])
  );
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("neither a record nor a decision")));
});

test("two records may not adjudicate the same quote", () => {
  const result = validateAdjudication(
    doc([verified("Update the interface at once"), verified("update the interface at once")])
  );
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("same quote")));
});

test("an unknown field is refused rather than ignored", () => {
  const result = validateAdjudication(doc([verified("Update the interface at once", { verdict: "looks bad" })]));
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes('unknown field "verdict"')));
});

test("also lets one record cover the same defect in another judge's wording", () => {
  const joined = joinReport(
    report,
    doc([
      { ...verified("Update the interface at once on input"), also: ["Let Enter submit single-field forms"] }
    ])
  );
  assert.equal(joined.unadjudicated.length, 0);
  assert.equal(joined.complete, true);
  const md = renderMarkdown(joined);
  assert.match(md, /\| Let Enter submit single-field forms \| glm \| verified \|/);
});

test("an alias that matches nothing is reported, not ignored", () => {
  const joined = joinReport(
    report,
    doc([
      { ...verified("Update the interface at once on input"), also: ["Let Enter submit single-field forms"] },
      { ...verified("no such quote in the report"), also: ["still not in the report"] }
    ])
  );
  assert.equal(joined.orphaned.length, 1);
  assert.equal(joined.unusedAliases.length, 1);
  assert.equal(joined.complete, false);
});

test("a template record left open is not a verdict", () => {
  const joined = joinReport(
    report,
    doc([
      { id: "A-01", quote: "Update the interface at once on input", status: "open", note: "" },
      { id: "A-02", quote: "Let Enter submit single-field forms", status: "open", note: "" }
    ])
  );
  assert.equal(joined.unadjudicated.length, 2);
  assert.equal(joined.complete, false);
  const md = renderMarkdown(joined);
  assert.match(md, /template record `A-01` left open/);
  assert.match(md, /incomplete/);
});

test("the template is one open record per claim, most-raised first", () => {
  const template = templateFromReport(report);
  assert.equal(template.records.length, 2);
  assert.equal(template.records[0].quote, "Update the interface at once on input");
  assert.equal(template.records[0].status, "open");
  assert.equal(template.artifact.sha256, sha);
  assert.equal(validateAdjudication(template).ok, true);
});

test("the rendered page states incompleteness rather than implying a pass", () => {
  const joined = joinReport(report, doc([verified("Update the interface at once on input")]));
  const md = renderMarkdown(joined);
  assert.match(md, /## Unadjudicated \(1\)/);
  assert.match(md, /incomplete/);
  assert.doesNotMatch(md, /Every claim in this report has a recorded verdict/);
});
