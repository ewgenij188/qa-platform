---
name: "code-change-audit"
description: "Route GitLab code-change events (MR open, commits pushed, comments) through the audit pipeline: Step 1 = contract check (mr-contract-check), Step 2 = AI code review (ocr-mr-review), Step 3 = knowledge-map check (mr-documents-check). Extend by adding new steps (e.g. check-dependencies)."
---

# Code Change Audit

Entry point for auditing a code change (a GitLab merge request and its lifecycle
events). Runs a fixed, ordered pipeline of audit steps over the change. Add new
steps here as the pipeline grows.

## Pipeline

The pipeline is ordered and each step is a discrete, independently-loadable
skill. Steps run in order; later steps can dedupe against earlier findings.

### Step 1: Contract Check

Load and execute **[mr-contract-check](mr-contract-check)**.

Inspects the MR diff for HTTP API contract changes, compares against
`wnf3/bang/core/contracts`, and flags gaps as anchored diff discussions.

### Step 2: OCR MR Review

Load and execute **[ocr-mr-review](ocr-mr-review)**.

Runs AI code review on the MR diff, posts findings as line-anchored resolvable
diff discussions, and handles reply/approval/resolve on comment events (the
skill itself covers the `ocr` CLI install/configure — no separate
open-code-review skill). Deduplicate with Step 1 findings where they overlap.

### Step 3: Knowledge-map check

Load and execute **[mr-documents-check](mr-documents-check)**.

Compares the MR with current knowledge-map features and their linked Confluence
pages. Reports whether a new feature is needed, and suggests a doc change only
when Confluence does not already describe it. Does not edit the knowledge map.
Deduplicate with Step 1 and Step 2 findings where they overlap.

---

## Comment language

All MR comments from this pipeline — contract checks, AI-review findings,\nreplies, and acknowledgments — must be written in **English**, regardless of the\nauthor's language. Sub-skills enforce this individually; this is the standing\nrule across every step.\n\n---\n\n## Event routing"}]

Parse the incoming webhook/code-change to identify the event type, then route to
the pipeline steps:

### MR opened

Run the **full pipeline**: Step 1 → Step 2 → Step 3.
A new MR gets a fresh contract check, AI code review, and knowledge-map check.

### Commits pushed (source branch)

Run the **full pipeline**: Step 1 → Step 2 → Step 3.
New commits invalidate prior results — re-check contracts, re-review the diff, and re-check the knowledge map.

### New comment (diff discussion)

Route to **Step 2 only** — `ocr-mr-review` handles reply/approval/resolve logic.
Contract check and the knowledge-map check are not re-triggered for comments.

### My own MR (self-review from a different context)

**Always self-review my own MRs — from a *different* context.** MRs authored by
the Sebastian service account (e.g. contracts MRs I create on the author's
request) are still reviewed, the same as anyone else's, but the review must come
from a **fresh, isolated context** so it does not inherit the assumptions of the
session that wrote the change:

- **Fresh context:** spawn a clean sub-agent / isolated session to run the review
  (`mr-contract-check` for contracts MRs, `mr-documents-check` for a mapped
  service, `ocr-mr-review` for code MRs) — do not review in the same turn or
  session that authored the MR.
- **Review against the origin, not my memory:** a contracts MR is checked against
  the *origin implementation MR* (field name, type, nullability, required/optional,
  route, status codes), not against what I think I wrote.
- **Treat findings like any author's:** fix real findings, resolve/approve only
  per the normal gate. Self-review is a check on my own work, not a rubber stamp.

The point is to keep a second look while avoiding the blind spot of "I wrote it,
so it must be right."

---

## Adding a new step (future)

1. Create a new skill in `skills/<skill-name>/SKILL.md`.
2. Add a new step section above (e.g. `### Step 4: Check Dependencies`).
3. Update the routing table above if the step should gate on specific event types.
