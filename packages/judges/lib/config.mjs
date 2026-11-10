/*
 * Panel configuration.
 *
 * A panel is a list of models from distinct families, plus what the target is
 * and how to describe it. It is a file rather than flags because the same panel
 * should be re-runnable months later and produce a comparable report, and
 * because the numbers below (context size, token budget, whether the model
 * honours a schema) are measurements, not preferences.
 *
 * The one rule the loader enforces: a panel may not be staffed entirely by the
 * family that wrote the artifact. A single-authored model judging itself returns
 * its own taste as consensus.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const REQUIRED_JUDGE_FIELDS = ["model", "family", "numCtx", "numPredict"];

export async function loadPanel(path) {
  const text = await readFile(path, "utf8");
  let panel;
  try {
    panel = JSON.parse(text);
  } catch (error) {
    throw new Error(`panel ${path} is not valid JSON: ${error.message}`);
  }
  validatePanel(panel, path);
  const base = dirname(resolve(path));
  panel.promptPath = resolve(base, panel.prompt);
  panel.sourcePath = resolve(path);
  return panel;
}

export function validatePanel(panel, path = "(panel)") {
  const fail = (message) => {
    throw new Error(`${path}: ${message}`);
  };
  if (!panel || typeof panel !== "object") fail("panel must be an object");
  for (const key of ["name", "endpoint", "authorFamily", "target", "prompt", "judges"]) {
    if (!(key in panel)) fail(`missing ${key}`);
  }
  if (!panel.target || typeof panel.target.kind !== "string" || typeof panel.target.job !== "string") {
    fail("target needs string fields kind and job");
  }
  if (!Array.isArray(panel.judges) || panel.judges.length === 0) fail("judges must be a non-empty array");
  for (const [i, judge] of panel.judges.entries()) {
    for (const field of REQUIRED_JUDGE_FIELDS) {
      if (!(field in judge)) fail(`judges[${i}] missing ${field}`);
    }
    if (!Number.isInteger(judge.numCtx) || judge.numCtx < 2048) {
      fail(`judges[${i}].numCtx must be an integer of at least 2048`);
    }
    if (!Number.isInteger(judge.numPredict) || judge.numPredict < 256) {
      fail(`judges[${i}].numPredict must be an integer of at least 256`);
    }
    if (judge.schema && !["enforced", "ignored"].includes(judge.schema)) {
      fail(`judges[${i}].schema must be "enforced" or "ignored"`);
    }
  }
  const outside = panel.judges.filter((j) => j.family !== panel.authorFamily);
  if (outside.length === 0) {
    fail(`every judge is from the authoring family (${panel.authorFamily}); the panel cannot judge its own work`);
  }
  return panel;
}
