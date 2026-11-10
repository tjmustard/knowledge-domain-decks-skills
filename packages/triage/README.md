# triage — adjudication for judge findings

Turns a panel report into a checked record: for every claim a model made, what
a person found when they looked. The panel in `packages/judges/` produces
candidates; this package is where a candidate becomes a defect, a rejection, or
a note that says it is already recorded somewhere else.

## The problem it solves

A report lists findings. Nothing in it says which ones are true, and a file of
prose answers does not survive the next run: the same claims come back, the
same checks get redone, and a rejection written in a terminal scrolls away.

An adjudication is a JSON file keyed to the artifact's hash. It records the
verdict, the evidence, and the reason for a rejection. `triage` joins it to a
report and prints what has no verdict yet, what was checked and how, and which
records no longer attach to anything.

## Usage

```bash
# 1. Write a skeleton from a report: one open record per distinct claim
npm run triage -- --report .judges/<run>/report.json --template > audit/adjudication.json

# 2. Fill it in, then join
npm run triage -- --report .judges/<run>/report.json \
                 --adjudications audit/adjudication.json
```

`--json` prints the joined structure instead of the markdown page.

Exit codes:

- `0` every claim has a verdict, no record is orphaned, artifact hashes agree
- `1` claims without a verdict, orphaned records, or aliases that match nothing
- `2` usage error, or an adjudication file that fails validation
- `3` the adjudication was written against a different artifact

## The record

```json
{
  "artifact": {
    "path": "skills/ux-laws/SKILL.md",
    "sha256": "8b8956ae…"
  },
  "panel": "deck-skill",
  "records": [
    {
      "id": "A-01",
      "quote": "Update the interface at once on input, then reconcile with the server in the background.",
      "also": ["Optimistic updates without a rollback path"],
      "status": "verified",
      "evidence": "data/laws/dec-10.json:21 — no failure branch in the checklist",
      "decision": "§34"
    }
  ]
}
```

| field | rule |
|---|---|
| `id` | unique within the file |
| `quote` | the claim, matched exactly on the same normalised 80-character prefix the report uses for convergence |
| `also` | other wordings of the same claim, so two judges' phrasings attach to one verdict |
| `status` | `verified`, `rejected`, `duplicate`, or `open` |
| `evidence` | required for `verified`: a `file:line` or `§N` pointer |
| `reason` | required for `rejected` |
| `record` / `decision` | required for `duplicate`: the card id or decision section it duplicates |
| `note` | free text, shown for `open` records |

Unknown fields are refused. The point of the format is that a later reader can
tell what kind of answer each line is, so a field that does nothing is worse
than an error.

## What it refuses

- **An adjudication against another artifact.** If the hashes differ, nothing is
  compared and the run exits 3. Applying yesterday's verdicts to today's bytes
  is the plausible wrong answer this exists to prevent.
- **A verified record without a pointer.** "Checked it" is not evidence.
- **Two records for one quote**, including two `also` lists that collide.
- **A malformed file read as an empty one.** Validation problems exit 2; the
  tool never reports "0 unadjudicated" from a file it could not parse.

## Limits worth stating

- Matching is exact on an 80-character normalised prefix. Two judges describing
  one defect in materially different words are two claims until a person joins
  them with `also`.
- The tool does not check that the evidence is true. It checks that evidence was
  named. Adjudication is the part no instrument can do for you.
- A report is a snapshot. Re-running the panel against edited bytes produces
  different quotes and a different artifact hash, so verdicts do not carry
  forward automatically; that is deliberate.

## Tests

```bash
npm run test:triage
```
