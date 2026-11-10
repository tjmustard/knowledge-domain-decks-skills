#!/usr/bin/env node
/*
 * Join a judge report to a recorded adjudication and say what is still owed.
 *
 * Usage:
 *   node packages/triage/run.mjs --report <report.json> --adjudications <file>
 *   node packages/triage/run.mjs --report <report.json> --template
 *   node packages/triage/run.mjs --report <report.json> --adjudications <file> --json
 *
 * Exit codes:
 *   0  every claim adjudicated, no orphaned records, artifact hashes agree
 *   1  claims without a verdict, or records that match no claim
 *   2  usage or invalid adjudication
 *   3  the adjudication was written against a different artifact
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { joinReport, templateFromReport, validateAdjudication } from "./lib/adjudication.mjs";
import { renderMarkdown } from "./lib/render.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const reportPath = flag("--report");
if (!reportPath) {
  console.error("usage: node packages/triage/run.mjs --report <report.json> (--adjudications <file> | --template)");
  process.exit(2);
}

const report = JSON.parse(await readFile(resolve(reportPath), "utf8"));

if (args.includes("--template")) {
  console.log(JSON.stringify(templateFromReport(report), null, 2));
  process.exit(0);
}

const adjudicationPath = flag("--adjudications");
if (!adjudicationPath) {
  console.error("usage: node packages/triage/run.mjs --report <report.json> (--adjudications <file> | --template)");
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(await readFile(resolve(adjudicationPath), "utf8"));
} catch (error) {
  console.error(`cannot read the adjudication at ${adjudicationPath}: ${error.message}`);
  process.exit(2);
}

const validation = validateAdjudication(doc);
if (!validation.ok) {
  // A malformed adjudication is not an empty one: reporting "0 unadjudicated"
  // from a file the tool could not read would be the exact plausible-wrong
  // answer this harness exists to refuse.
  console.error(`the adjudication at ${adjudicationPath} is not usable:`);
  for (const problem of validation.problems) console.error(`  - ${problem}`);
  process.exit(2);
}

if (doc.artifact.sha256 !== report.run?.artifact?.sha256) {
  console.error(`the adjudication was written against a different artifact.`);
  console.error(`  fact: adjudication sha256 ${doc.artifact.sha256}`);
  console.error(`        report       sha256 ${report.run?.artifact?.sha256}`);
  console.error(`  Nothing was compared. Regenerate the template from this report and re-adjudicate.`);
  process.exit(3);
}

const joined = joinReport(report, doc);
joined.adjudicationPath = adjudicationPath;

if (args.includes("--json")) {
  console.log(JSON.stringify(joined, null, 2));
} else {
  console.log(renderMarkdown(joined));
}

process.exit(joined.complete ? 0 : 1);
