---
name: create-checklist-and-analyze
description: Analyzes a Jira ticket's requirements, builds a verification checklist from them, then reviews the linked GitLab MR (full diff + related models/enums/conventions) to find mismatches, typos, namespace/convention deviations, ambiguity gaps, and test-coverage gaps. Outputs a prioritized findings report with a mandatory self-check (dedupe, code-evidence per finding, question-vs-assertion separation). Handles both feature tickets (requirements → code) and bug tickets (Steps/Expected/Actual → code). Use when the user asks to analyze requirements in a ticket, review an MR against its ticket, build a checklist from requirements, find mismatches/inconsistencies between spec and implementation, do a QA code review of a feature, or verify a bug fix in an MR.
---

# Create Checklist and Analyze

> **Response language: always respond in English.** The entire report, checklist, and finding descriptions — in English.

Two-phase QA workflow: **(1)** extract a verification checklist from the ticket's requirements, then **(2)** audit the implementation MR against that checklist and report prioritized findings.

## Goal

Produce a requirements-derived checklist plus a prioritized, code-evidenced list of:
- functional mismatches between spec and code
- requirement ambiguities / typos / contradictions
- convention and namespace deviations
- test-coverage gaps in the MR
- missing or underspecified requirements

## Phase 0 — Input validation (mandatory, before Phase 1)

Before any analysis, verify that at least one of the three valid input types is present in the user's request. **If none are present — STOP and ask.**

### Accepted inputs (any one is sufficient)

| # | Input type | Examples |
|---|-----------|----------|
| 1 | **Jira ticket** | Issue key (`CORE-1234`), full URL (`https://...atlassian.net/browse/CORE-1234`), or just a number if the project context is clear |
| 2 | **GitLab MR** | MR URL (`https://gitlab.com/.../merge_requests/123`), or `project_path` + `merge_request_iid` pair |
| 3 | **Free-form text** | A raw requirement description, bug report, spec, or any text the user wants analyzed — pasted directly into the message |

### Validation rules

1. Scan the user's message for any of the three input types.
2. **If at least one is found** → proceed to the appropriate path:
   - Jira ticket present → full Phase 1 (requirements from ticket) + Phase 2 if MR also present.
   - GitLab MR only (no Jira) → skip Phase 1, go directly to Phase 2 (code audit only). Mark report: `⚠️ No requirements source — code-only audit`.
   - Free-form text only → treat the text as the requirements source. Proceed to Phase 1 using the text instead of a Jira ticket. If no MR, skip Phase 2. Mark report: `⚠️ Free-form text used as requirements source`.
3. **If none are found** → **STOP**. Ask the user in a single message:
   > "I need at least one of the following for analysis: a Jira ticket key, a GitLab MR link, or a requirements/spec text. What can you share?"
   Do not attempt to discover, guess, or infer missing inputs.

## Data sources (mandatory)

- **Jira** — the ticket. Use the **Atlassian MCP** tools (`atlassian_getJiraIssue` with `fields: ["summary","description","status","issuetype","priority","labels","components","assignee","comment"]`). Cloud ID is discoverable via `atlassian_getAccessibleAtlassianResources`.
- **GitLab** — the MR. Use the **GitLab MCP** tools:
  - `gitlab_get_merge_request` (by `project_id` + `merge_request_iid`) — metadata, description, branch, status, approvals.
  - `gitlab_list_merge_request_changed_files` — the file-level scope.
  - `gitlab_get_merge_request_diffs` — full diff content for every changed file.
  - `gitlab_get_repository_tree` + `gitlab_get_file_contents` (with `ref: <source branch>`) — read **related but unchanged** files: domain models, enums, existing controllers/DTOs, sibling request/response records, validators. This is where namespace typos and convention deviations are caught.
- **Do not** rely on memory or previous runs for code facts; every finding must cite a file/line read in the current run.

## Error handling (MCP tools)

If an MCP tool call fails — tell me about the failure and propose a solution. **Never invent data to replace a failed request.**

### Failure response flow

| Situation | Action |
|-----------|--------|
| **Atlassian (Jira) failed, GitLab works** | Say: "Jira ticket is unavailable (error: `<details>`). Building the report from GitLab MR — code-only audit." → skip Phase 1, run Phase 2. |
| **GitLab failed, Atlassian (Jira) works** | Say: "GitLab MR is unavailable (error: `<details>`). Building the report from Jira ticket — requirements-only analysis." → run Phase 1, skip Phase 2. |
| **Both failed** | Say: "Neither Jira nor GitLab is available right now. Drop the requirements as text here — I'll analyze them." **STOP** — wait for text from me. |
| **Partial failure (mid-analysis crash)** | Emit a partial report marked `⚠️ PARTIAL`. List which sections are missing and why. |

## Bug-type tasks (issuetype = "Bug")

For bugs the workflow differs from features — you compare the bug's **Expected Result** against the actual MR implementation, not "requirements → code".

### Where the bug body lives

The standard `description` field on bugs in the CORE Jira project is often **empty/`null`**. The real body (Bug Description / Steps to reproduce / Expected Result / Actual Result / Attachments) lives in a **custom field** (e.g. `customfield_10674`). Therefore:

- For `issuetype = Bug`, request `atlassian_getJiraIssue` with `fields: ["*all"]` and `expand: "renderedFields"` (or `expand: "versionedRepresentations"`).
- Find the field containing the `Steps to reproduce` / `Expected Result` / `Actual Result` headings. In ADF these are `orderedList`/`bulletList` nodes inside the field content.
- A bug may contain **several sub-bugs** (Bug 1-1, Bug 1-2, …) — each with its own Steps / Expected / Actual. Split them and analyze each independently.

### What to extract from the bug

1. **Steps to reproduce** — the exact sequence (entities, flags, enum values, steps like "send finishRoundMessage", Kafka topic / DB checks).
2. **Expected Result** — the benchmark you compare the code against. Quote it verbatim.
3. **Actual Result** — what currently happens (the actual defect).
4. **Multiple sub-bugs** — list each one separately.

### Author clarifications — BEFORE generating

If anything is ambiguous, ask the author via the `question` tool **before** finalizing (not after). Always ask when:

- **MR scope per sub-bug** — which sub-bug must be in this MR (when part of it is untouched in the diff): "already fixed earlier" / "out of scope" / "must be here".
- **Branch-order conflict** — when a branch like `if (isAnyRefunds …)` sits before the needed one (`MagicChips`), making the expected status unreachable: which status is correct (the value from the bug or the current one).

Record the author's answers in the report and regenerate the checklist with those answers applied.

### How to audit a bug (on top of Phase 2)

- **Do not limit yourself to the changed files.** Read the handler that actually processes the message/step from Steps to reproduce (e.g. `finishRoundMessage` is handled by `FinishRoundV2`, not `SaveRoundInfo`). "Looking at the wrong handler" is the classic cause of false findings.
- **Compare Expected Result directly against each code branch**, not against the general logic.
- **Check branch order / precedence** — if the `refund` branch sits before `MagicChips`, the expected status may never be reached. This is a classic bug source.
- **Determine where the fix already landed**: compare the file's `content_sha256` between `develop` and the MR branch — if identical, this MR did not change it. Use `gitlab_get_file_blame` to learn when the logic entered the code (before/after this MR).
- **Flag "incomplete implementation"**: if the MR is described as `Closes <ticket>` but only contains some of the sub-bugs — that is a [High/Medium] "incomplete implementation" finding, not a closed ticket.

## Phase 1 — Requirements analysis (before touching the MR)

Read the ticket description and extract:

1. **Business goal** — one sentence: what is being built and why.
2. **Scope** — explicit deliverables (classes/interfaces/endpoints/contracts named in the ticket).
3. **Rules** — every explicit rule (applicability, merge, precedence, edge conditions). Quote them.
4. **Examples** — any request/response JSON or field-level examples in the ticket.
5. **Ambiguity markers** — literal `????`, `TODO`, `TBD`, or wording like "or", "probably", "needs decision". List each and flag as **to confirm with author**.
6. **Typos/contradictions in the ticket** — e.g. a rule that references the wrong field, copy-paste leftovers, inconsistent names between prose and example.

### Build the checklist (strictly from requirements)

Emit a checklist grouped by concern. Never add a checklist item that has no basis in the ticket; mark requirement-derived vs inference explicitly.

**Checklist item format — atomic.** Each item = one action + one specific expected result, separated by an arrow `→`. One enum value / one condition branch = one separate item. Never merge multiple scenarios or multiple values into a single item — verify each independently so every item yields an unambiguous pass/fail.

Example (do NOT merge into a single item!):
- `Create a campaign with Status = Draft → campaign is not returned (error or empty response)`
- `Create a campaign with Status = Active → campaign is returned (response contains all required fields)`
- `Create a campaign with Status = Aborted → campaign is not returned (error or empty response)`

- **Applicability** — which entities/records qualify (status filters, membership filters, type-specific branches).
- **Core rules** — each merge/precedence/selection rule, including per-field independence and tie-break behavior.
- **Result** — defined behavior for: qualifying inputs, non-qualifying inputs, empty inputs (null vs empty object vs empty collection).
- **Endpoint/contract** — route, HTTP verb, query params, request/response shape, validation rules, error behavior.
- **Non-functional** — migration correctness, dedupe of repeated keys, OpenAPI/contract sync, log/monitoring, performance (N+1 queries, memory), rollback strategy, backward compatibility (existing API consumers).

### Checklist self-check (mandatory before presenting)

Before moving to Phase 2, review the checklist you built and fix any issues found:

1. **Dedupe** — scan for duplicate or near-duplicate items; merge or drop them. Two items that check the same behavior with different wording = keep the clearest one.
2. **Errors** — verify every item references the correct field names, enum values, statuses, and endpoints from the ticket. A typo in a checklist item will lead to a false mismatch in Phase 2.
3. **Inconsistencies** — check that no two items contradict each other (e.g. one item expects `null`, another expects `[]` for the same scenario).
4. **Incorrect checks** — verify each expected result is correct per the ticket rules, not assumed. If the ticket says "return empty array", the item must say `[]`, not `null`.
5. **Hallucinations** — remove any item that has no basis in the ticket. If you can't point to the exact sentence in the ticket that justifies the item — drop it.
6. **Completeness** — cross-check: does the checklist cover every rule, every enum value, every edge case explicitly mentioned in the ticket? Flag any gaps as `[Info]` notes.

If problems found → fix them silently, then present the cleaned checklist. Do NOT present a checklist with known issues.

## Phase 2 — Implementation audit

For each checklist item, locate the implementing code and verify it. Then look **beyond** the checklist for latent issues.

### Steps

1. **Map changed files to requirements** — for each changed file, state which checklist item it implements. Flag changed files that implement *nothing* in the ticket (scope creep) and ticket scope items with *no* implementation (missing).
2. **Read the implementation** — controllers/handlers/services/repositories/validators in full; do not rely on the diff hunks alone.
3. **Read related unchanged files** — domain models (`BrandingCampaign`-style), enums (all values), existing controllers in the same folder, existing request/response records, the project's namespace convention. Use these to detect:
   - **Namespace typos** and deviations from sibling conventions.
   - **Enum values** present in code but never exercised by tests.
   - **DTO shape drift** vs the ticket's example.
   - **Path/folder vs namespace mismatches** (leftovers from renames).
4. **Read the MR's own unit tests** — list which behaviors are covered, then identify uncovered branches (especially the most ambiguous rule).
5. **Cross-check the ticket's example vs the actual response shape** — nested vs flat, missing fields, field name casing.

### Finding categories (report under these headers)

- **Functional mismatches** — code contradicts an explicit rule.
- **Ambiguities / underspecified** — ticket rule has `????` or is silent where the code had to make a choice; the chosen behavior may be a bug.
- **Conventions / maintainability** — namespace typos, folder/namespace mismatch, dead code, asymmetric validation, copy-paste comments.
- **Test gaps (in the MR)** — behaviors not covered by the MR's own tests (separate from functional findings).

## Priority scheme

| Priority | Meaning | ✅ Yes (assign this priority) | ❌ Not (reassign) |
|----------|---------|-------------------------------|-------------------|
| **High** | Contradicts an explicit rule / blocks merge | Ticket: "return Active". Code: filters Draft. | Ticket is silent, code chose DESC — not a contradiction, that's `[Medium]`. |
| **Medium** | Behavior deviation needing confirmation, or convention break visible to consumers | Ticket doesn't specify ASC/DESC, code chose DESC. Namespace typo in public API. | Cosmetic inside a private method — that's `[Low]`. |
| **Low** | Cosmetic, comment, naming, minor asymmetry | Comment `// TO DO`, unused using, variable naming. | Any deviation from a requirement — at least `[Medium]`. |
| **Info** | Open question / suggestion, not a defect | "Why `> 0` and not `>= 0`?" — a question without certainty of a bug. | Code clearly contradicts the ticket — that's `[High]`, not a question. |

Always tag findings `[High]` / `[Medium]` / `[Low]` / `[Info]` and state *why* (rule it violates or consumer it affects).

## Output format

```markdown
## 1. Requirement summary
- Business goal / Scope / Rules / Ambiguities (????) / Ticket typos

## 2. Checklist (from requirements)
### Applicability
- [ ] …
### Core rules
- [ ] …
### Result / Endpoint / Non-functional
- [ ] …

## 3. Findings (prioritized)
### Functional mismatches
- [Priority] finding — file evidence
### Ambiguities
- [Priority] …
### Conventions
- [Priority] …
### Test gaps (in MR)
- [Priority] …

## 4. Self-check
- Dedupe result / code-evidence confirmation / question-vs-assertion separation
```

## Few-shot examples

Every finding must include: category, priority `[High/Medium/Low/Info]`, a description of the issue, and a file/line reference from code or ticket.

### Functional mismatch
- `[High]` `CampaignService.GetActive()` on line 42 filters `Status == "Draft"`, but the ticket (rule 3) requires only `Status == "Active"`. Code contradicts an explicit rule — bug.

### Ambiguity / underspecified
- `[Medium]` The ticket says "sort by creation date" but doesn't specify ASC or DESC. Code in `CampaignRepository.cs:87` uses `OrderByDescending`. Needs confirmation from the author.

### Convention / namespace
- `[Medium]` `Dtos/Responses/GameDto.cs` is declared in namespace `Bang.Core.Dto.Response` — missing `s` in `Dtos` and `Responses`. All sibling DTOs use `Bang.Core.Dtos.Responses`. Deviation from project convention.

### Test gap
- `[Medium]` The MR has no test for empty input: the method returns `null`, but the ticket requires an empty array `[]`. The `campaigns.Count == 0` branch in `CampaignService.cs:55` is uncovered.

### Question / Info (not a defect)
- `[Info]` The logic `if (request.Amount > 0)` in `BetHandler.cs:120` — is this an intentional positive-value check or a guard against negatives? The ticket does not describe this behavior; ask the author.

## Guardrails / self-check (mandatory before finalizing)

Run this self-review and fix before responding:

1. **Dedupe** — merge duplicate findings; if two findings are the same root cause, keep the most complete and cross-reference the weaker one, or drop it. Separate "defect + test gap" pairs are **not** duplicates (defect = code, test gap = coverage).
2. **Code evidence** — every functional/convention finding must cite a file (and line where possible) read in the current run. If a claim is not backed by a read file, downgrade it to `[Info]` question or drop it.
3. **Question vs assertion** — anything you could not verify (external packages, behavior not visible in the diff) must be phrased as a question/verification item, never as a fact.
4. **No hallucination** — do not invent fields, enum values, or API behavior. If the ticket example conflicts with code, report the conflict; do not assume which is correct.
5. **Consistency** — priority must match severity/impact; no finding contradicts another.
6. **Traceability** — each checklist item and finding should trace back to a ticket rule or a read file.

## Tips

- **For bugs**: compare the bug's Expected Result against the code directly, not against the general logic. A sub-bug missing from the MR diff (while the MR says `Closes <ticket>`) = "incomplete implementation", not "already fixed".
- The ticket's "????" and copy-paste errors are almost always worth surfacing — they are where the author's intent and the code diverge.
- Namespace typos in a public contracts/ApiResources project are release-impacting (they become public API surface); raise their priority accordingly.
- Sorting by `CreatedAt` + tie-break by ObjectId `Id` is a common fragile heuristic — flag it as an ambiguity if the ticket doesn't specify "newest".
- When the ticket's example shows flat response but code returns a wrapper object, that is a contract mismatch to confirm, not to silently accept.
- Validate symmetric validation: if one param is validated as ObjectId, the sibling should be too (or be explicit about the asymmetry).

## Final self-check (mandatory before responding)

Before presenting the final report to the user, run this full sweep and fix any issues found:

### Checklist check
1. **Dedupe** — scan for duplicate or near-duplicate checklist items; merge or drop them.
2. **Errors** — verify every item references the correct field names, enum values, statuses, and endpoints from the ticket.
3. **Inconsistencies** — no two items should contradict each other.
4. **Incorrect checks** — each expected result must be correct per the ticket rules, not assumed.
5. **Hallucinations** — remove any item with no basis in the ticket. If you can't point to the exact sentence — drop it.
6. **Completeness** — does the checklist cover every rule, enum value, and edge case from the ticket?

### Findings check
7. **Dedupe findings** — merge duplicates; "defect + test gap" pairs are not duplicates.
8. **Code evidence** — every functional/convention finding must cite a file and line. No evidence → downgrade to `[Info]` or drop.
9. **Question vs assertion** — unverifiable claims must be questions, not facts.
10. **No hallucination** — never invent fields, enum values, or API behavior.
11. **Consistency** — priority must match severity/impact; no finding contradicts another.
12. **Traceability** — every checklist item and finding must trace back to a ticket rule or a read file.

Fix silently. Never present output with known issues.
