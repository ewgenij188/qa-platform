---
name: disable-tests
description: Disables (or lists/re-enables) Allure TestOps test cases in QA Portal (disabled-tests-data) for one or more environments (core-qa, latest, release, preprod). Always asks for the test cases (link or IDs), the Jira issue tracking the reason, and the environments (multi-select), then shows the full id/issue/environment plan and waits for explicit confirmation before writing anything. Use when the user asks to disable, turn off, or exclude tests from a run on specific environments.
---

# Disable TestOps tests in QA Portal

## Goal

Create `disabled-tests-data` entries in QA Portal for one or more test cases, on one or more environments, tied to a Jira issue — with an explicit confirmation step before anything is written.

## Flow (always in this order)

### 1. Ask for the test cases
Accept either:
- A TestOps link, e.g. `https://testops.wnf.rocks/project/1/test-cases/{id}?treeId=...&search=...`
  - The numeric id right after `/test-cases/` is always one of the cases.
  - If the link's `search` query param is present, it's base64-encoded JSON, e.g. `[{"id":"issue","type":"longArray","value":[27063]}]`. Decode it:
    ```js
    JSON.parse(Buffer.from(searchParam, "base64").toString())
    ```
    When it contains an `"id":"issue"` filter, the numeric value(s) are **internal TestOps issue ids**, not Jira keys. Resolve each to a Jira key with:
    `GET https://testops.wnf.rocks/api/issue/{internalId}` (header `Authorization: Api-Token {token}`, token from `opencode.json` → `mcp.allure-testops.headers.Authorization`, strip the `api-token ` prefix) → response `.name` is the Jira key (e.g. `CORE-4210`).
  - Then fetch every case tied to that Jira key in project 1 via MCP `allure-testops`:
    ```
    testops_find_testcases({ projectId: 1, aql: 'issue in ["CORE-4210"]', size: 100, expand: ["issues"] })
    ```
    This is the authoritative list — a single case link with an issue filter usually means "all cases for this issue", not just the one in the URL. Show the resolved list to the user before moving on if it has more than the single linked id.
- A plain list of IDs (comma/space separated) — use as-is, no resolution needed.

### 2. Ask for the Jira issue
The ticket key to record as the reason tracker (e.g. `CORE-4210`). If step 1 already resolved one via an issue filter, confirm it with the user instead of asking blind — the user may want a different tracking ticket than the one the cases are linked to.

### 3. Ask for environments
Offer a multi-select among exactly: `core-qa`, `latest`, `release`, `preprod`. (Other environments exist in the system — `develop`, `feature-*`, `certification`, `prod`, `prod-domain` — but only offer these four unless the user explicitly names another one.)

### 4. Ask for the reason text
The API's `reason` field is required server-side even though the OpenAPI schema marks it optional (empty/missing `reason` fails with a null-pointer error). Ask the user for a short free-text reason, or propose a sensible default (e.g. `"Until the task is deployed"`) and let them confirm or override.

### 5. Present the plan and wait for confirmation
Show a table before writing anything:

| Test case ID | Name | Jira issue | Environments |
|---|---|---|---|
| 107205 | Reject table activation ... | CORE-4210 | release, preprod |

List all case×environment combinations that will be created. Explicitly ask the user to confirm. **Never create entries without this confirmation.**

### 6. Check for existing entries, then disable
Optionally check first to avoid noisy duplicate errors:
```
qa_portal_list_disabled_tests({ allureId, environment })
```
Then disable each case/environment pair:
```
qa_portal_disable_test({ allureId, environment, jiraIssue, reason })
```
(MCP tool on the local `qa-portal` server, `~/.config/opencode/mcp/qa-portal.mjs`.) If a pair already exists, the tool/API reports `DUPLICATE_DISABLED_TEST` — treat that as informational, not a failure; report it as already-disabled in the summary.

If the `qa_portal_disable_test` MCP tool isn't available yet (server not reloaded), fall back to direct REST:
```
POST https://qa-quality-guard.int.wnf.rocks/disabled-tests-data/batch
Authorization: Bearer {QA_PORTAL_TOKEN from opencode.json mcp.qa-portal.environment}
Body: [{ "allureId": ..., "environment": ..., "jiraIssue": ..., "reason": ... }, ...]
```

### 7. Report results
Summarize per case/environment: created (with new `disabled-tests-data` id), or already existed (duplicate), or failed (with error).

## Notes
- Project is always Winfinity (`projectId: 1`) unless the user says otherwise.
- Never guess a Jira issue or environment — always ask, per step 2/3, even if step 1 resolution suggests an answer.
- Re-enabling: `qa_portal_enable_test({ id })` or `qa_portal_enable_test({ allureId, environment })` — only do this if the user explicitly asks to re-enable/turn back on a test, following the same confirm-before-write rule.
