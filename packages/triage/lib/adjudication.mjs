/*
 * Join a judge report to a record of what a person found when they checked.
 *
 * The judge panel produces claims. This module is where a claim gets a
 * verdict: checked at the source, rejected with a reason, already recorded
 * somewhere else, or still open. The join is exact on the same normalised
 * quote key the report uses for convergence, so a claim that two judges
 * raised is one claim here, and an adjudication written against a different
 * artifact hash is refused rather than quietly applied.
 */
import { quoteKey } from "../../judges/lib/report.mjs";

export const STATUSES = ["verified", "rejected", "duplicate", "open"];
const FIELDS = ["id", "quote", "also", "status", "evidence", "reason", "record", "decision", "note"];
const EVIDENCE = /(^|[\s(])([A-Za-z0-9_./-]+):\d+|§\s?\d+/;

export function validateAdjudication(doc) {
  const problems = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, problems: ["the adjudication is not a JSON object"] };
  }
  const sha = doc.artifact?.sha256;
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) {
    problems.push("artifact.sha256 must be the 64-character hash of the artifact judged");
  }
  if (!Array.isArray(doc.records)) {
    problems.push("records must be an array");
    return { ok: false, problems };
  }

  const ids = new Set();
  const keys = new Map();
  for (const [index, record] of doc.records.entries()) {
    const where = record?.id || `records[${index}]`;
    if (!record || typeof record !== "object") {
      problems.push(`${where} is not an object`);
      continue;
    }
    for (const field of Object.keys(record)) {
      if (!FIELDS.includes(field)) problems.push(`${where} has unknown field "${field}"`);
    }
    if (typeof record.id !== "string" || record.id.trim() === "") {
      problems.push(`${where} has no id`);
    } else if (ids.has(record.id)) {
      problems.push(`${where} repeats the id "${record.id}"`);
    } else {
      ids.add(record.id);
    }
    if (record.also !== undefined && (!Array.isArray(record.also) || record.also.some((q) => typeof q !== "string"))) {
      problems.push(`${where} also must be an array of quotes`);
    }
    const quotes = [record.quote, ...(Array.isArray(record.also) ? record.also : [])];
    for (const quote of quotes) {
      const key = quoteKey(quote);
      if (key.length < 8) {
        problems.push(`${where} has a quote too short to match against: "${String(quote).slice(0, 40)}"`);
      } else if (keys.has(key)) {
        problems.push(`${where} and ${keys.get(key)} adjudicate the same quote`);
      } else {
        keys.set(key, where);
      }
    }
    if (!STATUSES.includes(record.status)) {
      problems.push(`${where} status must be one of ${STATUSES.join(", ")}`);
    }
    if (record.status === "verified" && !EVIDENCE.test(String(record.evidence || ""))) {
      problems.push(`${where} is verified with no source pointer in evidence (file:line or §N)`);
    }
    if (record.status === "rejected" && String(record.reason || "").trim() === "") {
      problems.push(`${where} is rejected with no reason`);
    }
    if (
      record.status === "duplicate" &&
      String(record.record || "").trim() === "" &&
      String(record.decision || "").trim() === ""
    ) {
      problems.push(`${where} is a duplicate that names neither a record nor a decision`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// Group the report's findings by claim. One adjudication covers every judge
// that raised the same quote, which is the whole point of recording it once.
export function claimsFromReport(report) {
  const claims = new Map();
  for (const judge of report.judges || []) {
    for (const finding of judge.findings || []) {
      const key = quoteKey(finding.quote);
      if (!key) continue;
      if (!claims.has(key)) {
        claims.set(key, { key, quote: finding.quote, judges: [], severities: [] });
      }
      const claim = claims.get(key);
      if (!claim.judges.includes(judge.model)) claim.judges.push(judge.model);
      if (finding.severity && !claim.severities.includes(finding.severity)) {
        claim.severities.push(finding.severity);
      }
    }
  }
  return [...claims.values()].sort(
    (a, b) => b.judges.length - a.judges.length || a.quote.localeCompare(b.quote)
  );
}

export function recordKeys(record) {
  return [record.quote, ...(Array.isArray(record.also) ? record.also : [])].map(quoteKey);
}

export function joinReport(report, doc) {
  const claims = claimsFromReport(report);
  const byKey = new Map();
  for (const record of doc.records || []) {
    for (const key of recordKeys(record)) byKey.set(key, record);
  }
  const claimKeys = new Set(claims.map((claim) => claim.key));

  const joined = claims.map((claim) => ({ ...claim, record: byKey.get(claim.key) || null }));
  // An `open` record is a placeholder, not a verdict: the template writes one
  // per claim, and treating it as adjudicated would let a freshly generated
  // skeleton report complete.
  const unadjudicated = joined.filter((claim) => !claim.record || claim.record.status === "open");

  // A record counts as orphaned only when none of its quotes is in the report.
  // An alias that matches nothing is reported separately: the primary quote
  // still attaches, but the alias has gone stale.
  const orphaned = (doc.records || []).filter((record) => recordKeys(record).every((key) => !claimKeys.has(key)));
  const unusedAliases = [];
  for (const record of doc.records || []) {
    for (const alias of Array.isArray(record.also) ? record.also : []) {
      if (!claimKeys.has(quoteKey(alias))) unusedAliases.push({ id: record.id, quote: alias });
    }
  }

  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const record of doc.records || []) {
    if (record.status in byStatus) byStatus[record.status] += 1;
  }

  return {
    artifact: { path: report.run?.artifact?.path, sha256: report.run?.artifact?.sha256 },
    reportId: report.run?.id,
    panel: report.run?.panel?.name,
    judges: (report.judges || []).length,
    findings: (report.judges || []).reduce((n, judge) => n + (judge.findings || []).length, 0),
    claims: joined,
    unadjudicated,
    orphaned,
    unusedAliases,
    byStatus,
    complete: unadjudicated.length === 0 && orphaned.length === 0 && unusedAliases.length === 0
  };
}

// A skeleton a person fills in. Ordered by how many judges raised the claim,
// because that is the order worth working through.
export function templateFromReport(report) {
  const claims = claimsFromReport(report);
  const width = Math.max(2, String(claims.length).length);
  return {
    artifact: {
      path: report.run?.artifact?.path,
      sha256: report.run?.artifact?.sha256
    },
    panel: report.run?.panel?.name,
    records: claims.map((claim, index) => ({
      id: `A-${String(index + 1).padStart(width, "0")}`,
      quote: claim.quote,
      status: "open",
      note: ""
    }))
  };
}
