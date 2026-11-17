---
name: review-autotest-cases
description: Reviews Allure TestOps test cases (Winfinity project id=1) for automation readiness. Fetches cases by ID or link via MCP allure-testops (aql `id = N`, expand "all") and checks them against the team checklist: automated flag, mandatory tags (api, core, service tag, feature tag), Jira Issue links (CORE-*/BOF-*) are MANDATORY, custom fields (Component/Feature/Environment/Scope), name format, precondition = setup only, scenario steps with actions + verifications, non-empty expectedResult with status code + contract, no hardcoded IDs, automation feasibility of DB/job steps. Outputs a per-case pass/warn/fail report with concrete fixes. Use when the user asks to review test cases for automation, check TestOps cases before writing autotests, or validate tags/issues on cases.
---

# Review TestOps test cases for automation readiness

## Goal

Review one or more test cases in Allure TestOps (`https://testops.wnf.rocks`, project **Winfinity**, id=1) and decide whether each case is **ready to be automated**. Output a per-case report: what is OK, what must be fixed before automation, what makes the case manual-only.

Input is usually TestOps links like `https://testops.wnf.rocks/project/1/test-cases/{id}?...` — extract the numeric `{id}` from the URL (ignore `treeId`/`filterId` params).

## Fetch the cases

Use MCP `allure-testops` (preferred; REST fallback with `ALRURE_API_TOKEN` only if MCP is unavailable):

```
testops_find_testcases({ projectId: 1, aql: "id = {id}", expand: ["all"] })
```

One call per case ID. Collect: `name`, `automated`, `tags`, `issues`, `customFields`, `precondition`, `expectedResult`, `description`, `scenario.steps`.

## What good and bad cases look like (patterns, verified on real cases)

**✅ Model automated case** — fields pattern:
- `automated: true`
- `tags`: `api`, `core`, service tag (e.g. `coreBackoffice`, `partners`), feature tag (endpoint/feature-specific)
- `issues`: one or more Jira keys (`CORE-XXXX`, `BOF-XXXX`) — multiple links are normal
- `customFields`: `Component = Core`; `Feature = "API | <Service> | <Section> [| <Subsection>]"`; `Environment` × several values (certification, core-qa, latest, preprod, release); `Scope` = critical and/or extended
- `scenario.steps`: request steps with `{{GW_API_URI}}/{service}/{version}/{endpoint}` and `{{placeholder}}` bodies; expected results on intermediate steps hold status codes and saved ids; **last GET/verification step has NO expected result**
- `expectedResult` (case-level): status code + asserted response contract (or exact error message for negative cases)
- Flow-style cases may alternate `action step` → `Verify status code: ...` steps — this is good style

**⚠️ Typical NOT-ready case** — fields pattern:
- `automated: false`, tag `RFA`
- `expectedResult` vague ("Verify that the entity is returned") — no status code, no field-level contract
- broken/duplicated numbering in `precondition`
- scenario steps testing a NEW endpoint/field contain **hardcoded entity IDs** and duplicated query params instead of `{{placeholders}}` (hardcoded example bodies in routine Kafka transaction steps like PayIn/PayOut/Refund are fine)

**❌ Manual-only case** — fields pattern (tag `only-manual` = the case is only for manual use and will never be automated; tag `RFA` = the case awaits automation):
- tag `only-manual` present
- `expectedResult` EMPTY
- scenario relies on direct DB edits (raw UPDATEs) and manual job triggering → flag automation feasibility

## Review checklist

Apply every item to every case. Verdicts: ✅ pass / ⚠️ warn (fixable before automation) / ❌ fail (blocks automation).

### 1. Automation flag & status
- Tag `only-manual` → the case is **manual-only and will never be automated** — ❌ stop the automation-readiness review for that case, report verdict manual-only.
- Tag `RFA` → the case is **awaiting automation** (candidate). `automated: false` + `RFA` is the normal state — not a fail by itself.
- `automated: true` is expected for cases that already have an autotest.
- Neither `RFA` nor `only-manual` and `automated: false` → ⚠️ unclear automation intent — ask the user whether the case awaits automation.

### 2. Tags (MANDATORY)
- Must contain: `api`, `core`, the **service tag** (`coreBackoffice`, `partners`, `coreBackofficeV5` style — match the endpoint family), and the **feature tag** (endpoint/feature-specific).
- `RFA` tag means the case awaits automation — fine for candidates, but note it. `only-manual` means the case is manual-only and will never be automated.
- Report any missing tag by name; suggest the exact tag names to add (take conventions from sibling cases of the same service).

### 3. Issue links (MANDATORY — hard requirement)
- `issues` must be non-empty and contain Jira keys (`CORE-XXXX`, `BOF-XXXX`). Multiple links are normal.
- ❌ **No issue link = automatic fail.** A case without an issue link must not be automated; tell the user which Jira issue to attach (ask if unknown).

### 4. Custom fields
- `Component` = `Core` (for CORE cases).
- `Feature` = tree path, e.g. `API | <Service> | <Section> [| <Subsection>]`, or RFA backlog `API | Core | Manual | Regres New features cases`.
- For **already automated** cases: `Environment` (certification, core-qa, latest, preprod, release) and `Scope` (critical and/or extended) should be set — mirror the environments where the autotest actually runs (cf. core-test rules).
- Missing Environment/Scope on an RFA candidate = ⚠️ (will be set when automated), missing on `automated: true` = ❌.

### 5. Name
- Format: `API | CORE | {service} | {what is verified}` for RFA/new cases; older automated cases may have short names (`<Action> <Entity> with/without <fields>`) — ⚠️, suggest the full format.
- Name must state the expected outcome for negative tests (`... must be forbidden`).

### 6. Precondition
- SETUP only: entities to create, state to reach, feature flags (`Flag <FlagName>=true`).
- ❌ API calls/verifications in precondition — they belong in the scenario.
- Broken numbering / duplicated items = ⚠️.

### 7. Scenario (steps)
- Steps are ACTIONS and VERIFICATIONS: send `{{GW_API_URI}}/{service}/{version}/{endpoint}` with request body (placeholders `{{...}}`, never hardcoded ObjectIds/UUIDs), verify status code, verify response/error body.
- Alternation style `action step` → `Verify status code: ...` is good.
- Intermediate steps keep expected results (`Status code: 201`, `save the returned id as {{...}}`); the **last GET/verification step has NO expected result** — final expectations live in the case-level `expectedResult`.
- **Kafka transaction steps (PayIn, PayOut, Refund, etc.)** — these are transactions sent to Kafka; they may go WITHOUT a message body, and hardcoded values inside an example body are acceptable. A full body is needed only when the test covers a NEW field added to the message (then the new field must be visible/asserted).
- **Entity-creation steps via endpoints** (`Create partner site`, `Create table`, etc.) — no detailed request description is required either, UNLESS the test covers a NEW field added to that request (then the new field must appear in the step).
- ❌ Hardcoded entity IDs are a problem only in steps that ARE the subject of the test (new endpoint, new field, new contract) — there `{{placeholders}}` saved from previous steps are required.
- Single-step scenario is OK only for pure negative validation cases.

### 8. expectedResult (case-level)
- MUST be non-empty — ❌ if empty.
- Must contain: expected status code + asserted contract (response body fields, exact error message for negatives, Kafka topic + asserted fields where applicable).
- Vague text ("verify that the entity is returned") = ❌ — demand concrete field-level assertions.

### 9. Automation feasibility
- Flag steps that are hard to automate in qa-tests-v2: direct DB edits, job triggering, waiting on schedulers, Kafka without a consumer in the framework. Mark ⚠️ with a note how the team handles it (e.g. job trigger endpoint exists → OK; raw DB UPDATE → check if a framework helper exists).
- `only-manual` cases: skip feasibility, verdict manual-only.

### 10. Duplicates (when reviewing 2+ cases or cases from one Jira issue)
- Compare reviewed cases against each other (and against siblings under the same Jira issue): same precondition + same scenario steps + same issue = ⚠️ **duplicate**, even if names differ slightly (e.g. only a suffix like "no errors" added).
- Verified example of a dup pair: two cases with identical precondition, identical single GET step (same hardcoded params), same issue CORE-XXXX, names differing only by a trailing "no errors" — confirmed by the user as a duplicate.
- Report duplicates in the summary: list the IDs, name the differences, and **ask the user which case to keep** — never delete or mute a case on your own. Apply fixes to the kept case only.

## Output format

Per case:

```
### {id} — {name}
https://testops.wnf.rocks/project/1/test-cases/{id}
Verdict: ✅ Ready for automation | ⚠️ Fix before automation | ❌ Blocked

| # | Check | Result | Comment |
|---|-------|--------|---------|
| 1 | Automated flag / only-manual | ✅/⚠️/❌ | ... |
| 2 | Tags (api, core, service, feature) | ... | missing: ... |
| 3 | Issue links (MANDATORY) | ... | CORE-XXXX ✓ / MISSING |
| 4 | Custom fields (Component/Feature/Env/Scope) | ... | ... |
| 5 | Name format | ... | ... |
| 6 | Precondition = setup only | ... | ... |
| 7 | Scenario steps | ... | ... |
| 8 | expectedResult concrete | ... | ... |
| 9 | Automation feasibility | ... | ... |
| 10 | Duplicates (same issue/steps) | ... | ... |

Fixes (in priority order):
1. ...
```

End with a **summary table** of all reviewed cases (id, verdict, blockers) and, if fixes are requested and the user confirms, apply them via `testops_update_testcase` (tags by name; issues via `issues: [{"name": "Jira", "value": "CORE-XXXX"}]`). **Never edit cases without explicit user confirmation** — the default deliverable is the report only.

## Status management

When a case passes review with no blockers and the user requests a status change (or asks to set Active), update via:

```
testops_update_testcase({ id: {id}, workflow: "Custom Manual", status: "Active" })
```

**Important:** always pass `workflow: "Custom Manual"` together with `status` — without `workflow` the status update is silently ignored by the API (verified: passing only `status: "Active"` returns the old status unchanged).

Available statuses in Winfinity project (workflow "Custom Manual"):
`Draft` → `Review` → `Active` → `Automation In Progress` → `Automated` → `Outdated`.

Default action after review:
- ✅ No blockers → change status to `Active` (if user requested).
- ⚠️/❌ Has blockers → report findings, do NOT change status.

## Notes

- Do not confuse `treeId`/`filterId` in URLs with case IDs — only the number after `/test-cases/`.
- Issue links are readable via MCP `find_testcases` with `expand: ["all"]` (verified).
- Token hygiene: `ALRURE_API_TOKEN` stays in the shell env, never written into files; MCP path needs no token.
