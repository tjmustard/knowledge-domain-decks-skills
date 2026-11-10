/*
 * Render a joined adjudication as the page a person reads.
 *
 * The report's own rule carries over: a claim that was not checked is shown
 * as a claim, not folded into a count. The summary line says how many claims
 * exist and how many have a verdict, and the incomplete ones are listed in
 * full underneath, because "17 unadjudicated" is not something anyone can act
 * on.
 */

const STATUS_LABEL = {
  verified: "verified",
  rejected: "rejected",
  duplicate: "already recorded",
  open: "OPEN — no verdict"
};

export function renderMarkdown(joined) {
  const lines = [];
  lines.push(`# Adjudication: ${joined.panel || "panel"} — ${short(joined.artifact.sha256)}`);
  lines.push("");
  lines.push(
    `${joined.judges} judge(s) raised ${joined.findings} finding(s) over ${joined.claims.length} distinct claim(s).`
  );
  lines.push(`${counted(joined.byStatus)}.`);
  lines.push("");
  lines.push(`- report: \`${joined.reportId}\``);
  lines.push(`- artifact: \`${joined.artifact.path}\` (\`${joined.artifact.sha256}\`)`);
  if (joined.adjudicationPath) lines.push(`- adjudications: \`${joined.adjudicationPath}\``);
  lines.push("");

  lines.push("| claim | raised by | status | evidence |");
  lines.push("|---|---|---|---|");
  for (const claim of joined.claims) {
    const record = claim.record;
    const status = record ? STATUS_LABEL[record.status] || record.status : "UNADJUDICATED";
    const evidence = record ? evidenceFor(record) : "—";
    lines.push(
      `| ${tableCell(claim.quote)} | ${claim.judges.join(", ")} | ${status} | ${tableCell(evidence)} |`
    );
  }
  lines.push("");

  if (joined.unadjudicated.length > 0) {
    lines.push(`## Unadjudicated (${joined.unadjudicated.length})`);
    lines.push("");
    for (const claim of joined.unadjudicated) {
      const placeholder = claim.record ? ` (template record \`${claim.record.id}\` left open)` : "";
      lines.push(`- **${oneLine(claim.quote)}** — ${claim.judges.join(", ")}${placeholder}`);
    }
    lines.push("");
  }

  if (joined.orphaned.length > 0) {
    lines.push(`## Adjudications that match no claim (${joined.orphaned.length})`);
    lines.push("");
    lines.push("These records name a quote the report does not contain. The quote");
    lines.push("changed, the report is from a different artifact, or the record is stale.");
    lines.push("");
    for (const record of joined.orphaned) {
      lines.push(`- \`${record.id}\` — ${oneLine(record.quote)} (${record.status})`);
    }
    lines.push("");
  }

  if (joined.unusedAliases.length > 0) {
    lines.push(`## Aliases that match no claim (${joined.unusedAliases.length})`);
    lines.push("");
    lines.push("The record still attaches by its primary quote; these extra quotes matched nothing.");
    lines.push("");
    for (const alias of joined.unusedAliases) {
      lines.push(`- \`${alias.id}\` — ${oneLine(alias.quote)}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    joined.complete
      ? "Every claim in this report has a recorded verdict and no record is orphaned."
      : "This adjudication is incomplete: the sections above are work still owed, not findings."
  );
  lines.push("");
  return lines.join("\n");
}

function counted(byStatus) {
  const parts = [
    `${byStatus.verified} verified at source`,
    `${byStatus.rejected} rejected with a reason`,
    `${byStatus.duplicate} already recorded`,
    `${byStatus.open} left open`
  ];
  return `Verdicts: ${parts.join(", ")}`;
}

function evidenceFor(record) {
  if (record.status === "verified") return record.evidence;
  if (record.status === "rejected") return record.reason;
  if (record.status === "duplicate") return record.record ? `duplicate of ${record.record}` : `see ${record.decision}`;
  return record.note || "—";
}

function tableCell(text) {
  return oneLine(text).replace(/\|/g, "\\|");
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function short(sha) {
  return String(sha || "").slice(0, 12);
}
