import test from "node:test";
import assert from "node:assert/strict";
import { renderPrompt, truncation, minimumPromptTokens } from "../lib/prompt.mjs";

const template = "KIND {{KIND}}\nJOB {{JOB}}\nPATH {{PATH}}\n{{ARTIFACT}}";

test("fills every placeholder", () => {
  const out = renderPrompt(template, { kind: "a skill", job: "review code", artifact: "BODY", path: "SKILL.md" });
  assert.match(out, /KIND a skill/);
  assert.match(out, /BODY/);
});

test("refuses a template that does not offer a known placeholder", () => {
  assert.throws(
    () => renderPrompt("{{KIND}} and {{MISSING}}", { kind: "a skill", job: "", artifact: "", path: "" }),
    /missing \{\{JOB\}\}/
  );
});

test("refuses a template with an unknown placeholder left over", () => {
  const full = "{{KIND}} {{JOB}} {{PATH}} {{ARTIFACT}} {{EXTRA}}";
  assert.throws(
    () => renderPrompt(full, { kind: "a", job: "b", artifact: "c", path: "d" }),
    /unfilled placeholders: \{\{EXTRA\}\}/
  );
});

test("a 26,906 character prompt cannot cost 2,051 tokens", () => {
  const prompt = "x".repeat(26906);
  const reason = truncation(prompt, 2051);
  assert.ok(reason, "expected truncation to be detected");
  assert.match(reason, /truncated/);
});

test("an honest prompt count passes", () => {
  const prompt = "x".repeat(26906);
  assert.equal(truncation(prompt, 6484), null);
});

test("a missing count is reported rather than assumed safe", () => {
  assert.match(truncation("hello", null), /did not report/);
});

test("the floor is a floor, not an estimate", () => {
  assert.equal(minimumPromptTokens("x".repeat(6000)), 1000);
});
