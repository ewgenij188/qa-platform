---
name: create-testcases
description: Analyzes requirements and creates manual test cases in Allure TestOps under API | CORE | Manual | Regres New features cases. When given requirements, first presents a checklist for review — NEVER creates test cases without explicit user selection. Always asks for Jira issue number and service name. Tags: core, RFA, service name. Workflow: clones an existing test case via `POST /api/rs/testcase/{id}/clone` (body `{"projectId":1}` is REQUIRED) and patches fields rather than creating from scratch. Tree placement is controlled by the Feature/Component custom fields, NOT the case name (verified: case 100263 has Component=Core, Feature=API | Core | Manual | Regres New features cases; to move a case to a directory PATCH custom fields, do NOT rename). Scenario is ALWAYS written directly with the test steps (precondition = setup only, scenario = actions/verifications) — never ask the user whether to use scenario. When writing autotests, create the TestOps case FIRST and put the returned real ID directly into @AllureId — no "0" placeholder round-trip.
---

# Create Test Cases in TestOps

## Goal

Create new manual test cases in Allure TestOps (Winfinity project, id=1) under the folder **API | CORE | Manual | Regres New features cases**. These are Ready-for-Automation (RFA) test cases that will later be automated.

> ℹ️ **Where a case lands in the tree.** The tree directory in TestOps is defined by the **custom fields** `Feature` and `Component`, **not** by the case name (verified: case 100263 has `Feature = "API | Core | Manual | Regres New features cases"`, `Component = "Core"`). The case name is only a title. To put the case in the right folder, PATCH `customFields` (Feature/Component) after cloning — do NOT rename the case.

**Workflow — PRIORITY ORDER:**
1. **Preferred: MCP `allure-testops` tools** (`testops_create_testcase` / `testops_update_testcase`) — no API token or clone source ID needed; see "Creating via MCP (default)".
2. **Fallback: clone-and-PATCH** via raw REST only when the MCP tools are unavailable — clone an existing test case (`POST /api/rs/testcase/{id}/clone`), then PATCH its fields (name, description, precondition, expectedResult, tags, **customFields**) to match the new test case content. **Never `POST /api/rs/testcase` from scratch** — always clone and modify. In this fallback, **ask the user for the clone source test case ID**.

## Project & Auth

| Field | Value |
|-------|-------|
| Project | **Winfinity** (id=1) |
| Base URL | `https://testops.wnf.rocks` |
| API token | `{env:ALRURE_API_TOKEN}` |

**Auth flow:**

```bash
ACCESS=$(curl -s -X POST "$BASE/api/uaa/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=apitoken&token=$ALRURE_API_TOKEN" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Then call any endpoint with `-H "Authorization: Bearer $ACCESS"`.

## Required: Jira issue number

**Always ask the user** which Jira issue number to link before creating test cases. The issue will be added as an Issue link on each test case.

If the user doesn't provide one, ask again before proceeding.

> ⚠️ **API limitation (verified on this TestOps version):** issue links can NOT be set or even read with a personal API token — `/api/rs/integration` returns 403, `/api/rs/issue` requires an `integrationId` we cannot discover, and `testcase.links` is empty even for cases that ARE linked in the UI. So the Jira link is added **manually by the user in the UI**; the agent still asks for the issue number and includes it in the report.

## Required: clone source (template test case) — ONLY for the REST fallback

**When the MCP tools are unavailable and you must use the raw clone endpoint, ask the user for the clone source test case ID.** Never use a hardcoded default — always ask/use the ID the user gives. **Do NOT ask for a clone source ID when MCP is available** — the MCP path does not need one.

The source's workflow/status may differ from the target — always explicitly set `workflowId: 1` and `statusId: -1` after cloning.

## Test case specification

### Name format

```
API | CORE | {service} | {test case name}
```

Where:
- `{service}` — the Core service: Partners, PlayerStats, BackOffice, FreeCheeps, WagerCraft, Replays, PublicApi, etc.
- `{test case name}` — a short, clear description of what the test verifies

The test case's **folder in the tree** is defined by the `Feature`/`Component` custom fields (cloned from the source or set explicitly via PATCH), NOT by the name. **Do NOT add `Manual | Regres New features cases |` to the name** — it belongs in the `Feature` custom field.

Example name: `API | CORE | BackOffice | Delete Campaign with status Draft`

### Tree placement (custom fields)

Verified on this instance (case 100263 is in `API | Core | Manual | Regres New features cases` folder):

| Custom field | Value (example) | Where |
|--------------|-----------------|-------|
| `Feature` | `API | Core | Manual | Regres New features cases` | leaf folder (section) in the tree |
| `Component` | `Core` | parent group in the tree |

- To place a test case into a given directory, PATCH `customFields` with the same values as the sibling case already in that folder: `{"customFields": [{"name": "Feature", "value": "API | Core | Manual | Regres New features cases"}, {"name": "Component", "value": "Core"}]}` (verified via MCP `update_testcase`; for raw API use the equivalent custom field patch).
- ❌ Renaming the case does NOT move it in the tree — it only changes the displayed title. If the user asks to "move the case to the directory of case X", read X's `Feature`/`Component` and PATCH them on the target case.

### Fields

| Field | Value |
|-------|-------|
| `projectId` | 1 |
| `name` | `API \| CORE \| {service} \| {test case name}` |
| `statusId` | -1 (Draft) |
| `testLayerId` | -3 (API Tests) |
| `automated` | false |
| `workflowId` | 1 (Manual) |

### Tags

Always add: `core`, `RFA`, and the service name (lowercase). For feature work also add the feature tag if one exists (e.g. `BrandingRework` for branding campaigns).

PATCH accepts tags **by id** (verified): `"tags": [{"id": 21}, ...]`. Known IDs on this instance:

| Tag | ID |
|-----|-----|
| `backoffice` | 21 |
| `core` | 24 |
| `RFA` | 2401 |
| `BrandingRework` | 24336 |

To discover more tag IDs: `GET /api/rs/testcase/{siblingId}` and read its `tags` array.

## Workflow: clone-and-modify

### Step 1 — Analyze requirements, present checklist

When the user provides requirements (text, ticket, or specification), analyze them and present a structured checklist with:

- Numbered categories and test cases
- Expected results for each test
- Summary table (total count per category)
- Risks and edge cases
- Automation recommendations

**Do NOT create test cases at this stage.**

### Step 2 — Wait for user selection

After presenting the checklist, explicitly ask the user which test cases to create. The user must provide:

- **Jira issue number** (required)
- **Service name** (required)
- **Clone source test case ID** (required **only in the REST fallback**, i.e. when MCP tools are unavailable) — an existing test case in the target folder to clone from. With MCP, no clone source ID is needed
- **Selection** — which test cases to create. The user can:
  - List specific numbers (e.g. `1.1, 1.2, 3.1-3.5`)
  - Select entire categories (e.g. `Category 1, Category 4`)
  - Say "all" to create everything

**Never create test cases without explicit user confirmation of which ones to create.**

### Step 3 — Clone and patch each test case (REST fallback only)

Use this step ONLY when the MCP `allure-testops` tools are unavailable. When MCP is available, use `testops_create_testcase` instead (see "Creating via MCP (DEFAULT path)").

For each selected test case, **always clone from the original source** (same sourceId). Never clone from a previously cloned test case.

1. **Clone**: `POST /api/rs/testcase/{sourceId}/clone` with body `{"projectId": 1}` — the body is **REQUIRED** (no body → 400 "Required request body is missing"); the clone inherits all fields from the source including the name (a `name` in the clone body is **ignored** by the API)
2. **Clear relations**: `POST /api/rs/testcase/{newId}/relation` with body `[]` — cloning auto-creates a "clones" relation to the source; **always clear it**
3. **Patch `name`**: `PATCH /api/rs/testcase/{newId}` with `{"name": "API | CORE | {service} | {test case name}"}` — **always** set the correct name after cloning. Name = title only, it does not affect tree placement
4. **Patch fields**: `PATCH /api/rs/testcase/{newId}` to customize: `precondition`, `expectedResult`, `tags`, `description`, `workflowId`, `statusId`
5. **Set tree placement (Feature/Component)**: `PATCH ... {"customFields": [{"name": "Feature", "value": "API | Core | Manual | Regres New features cases"}, {"name": "Component", "value": "Core"}]}` — copy the values from a sibling case already in the target folder (see "Tree placement"). Cloning from a source already in that folder inherits them; set them explicitly when the target folder differs from the source or when creating via MCP `create_testcase` (which starts without custom fields)
6. **Set status and workflow**: Always `"statusId": -1` (Draft) and `"workflowId": 1` (Custom Manual) — the user changes status manually
7. **Always set the scenario with the test steps** — write actions/verifications directly into `scenario` via `POST /api/rs/testcase/{newId}/scenario` (see "Scenario (steps)" below); leave `precondition` for SETUP only
8. Report the new test case ID and link

### Clone-and-patch example (Python)

```python
import json, subprocess

BASE = "https://testops.wnf.rocks"
TOKEN = "your-token-here"

def get_access():
    r = subprocess.run(["curl","-s","-X","POST",f"{BASE}/api/uaa/oauth/token",
        "-H","Content-Type: application/x-www-form-urlencoded",
        "-d",f"grant_type=apitoken&token={TOKEN}"], capture_output=True, text=True)
    return json.loads(r.stdout)["access_token"]

def api(method, path, access, data=None):
    cmd = ["curl","-s","-X",method,f"{BASE}{path}",
           "-H",f"Authorization: Bearer {access}",
           "-H","Content-Type: application/json"]
    if data is not None:
        cmd += ["-d", json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(r.stdout)

access = get_access()
SOURCE_ID = 101782  # template test case to clone from

# 1. CLONE — body with projectId is REQUIRED (else 400); "name" in body is ignored
tc1 = api("POST", f"/api/rs/testcase/{SOURCE_ID}/clone", access, {
    "projectId": 1
})
id1 = tc1["id"]

# 2. CLEAR RELATIONS — cloning auto-creates a "clones" relation to the source
api("POST", f"/api/rs/testcase/{id1}/relation", access, [])

# 3. PATCH the correct name + fields + status + tree placement (Feature/Component)
#    precondition = SETUP only; scenario = ACTIONS/VERIFICATIONS (always written)
api("PATCH", f"/api/rs/testcase/{id1}", access, {
    "name": "API | CORE | BackOffice | My new test case",
    "precondition": "1. Create Campaign with status Draft",
    "expectedResult": "202 OK",
    "description": "Send {{GW_API_URI}}/backoffice/endpoint",
    "tags": [{"name": "core"}, {"name": "RFA"}, {"name": "backoffice"}],
    "customFields": [
        {"name": "Feature", "value": "API | Core | Manual | Regres New features cases"},
        {"name": "Component", "value": "Core"}
    ],
    "statusId": -1,  # Draft
})

# 4. ALWAYS set the scenario with the test steps (actions/verifications)
api("POST", f"/api/rs/testcase/{id1}/scenario", access, {
    "steps": [
        {"name": "Send POST {{GW_API_URI}}/backoffice/endpoint with body:\n{\n  \"name\": \"Test\",\n  \"type\": \"Generic\"\n}",
         "expectedResult": "202 OK", "steps": []}
    ]
})

# 5. Repeat for next test case — CLONE FROM THE SAME SOURCE_ID
tc2 = api("POST", f"/api/rs/testcase/{SOURCE_ID}/clone", access, {
    "projectId": 1
})
id2 = tc2["id"]
api("POST", f"/api/rs/testcase/{id2}/relation", access, [])
api("PATCH", f"/api/rs/testcase/{id2}", access, {
    "name": "API | CORE | BackOffice | My second test case",
    "precondition": "1. Create valid site",
    "expectedResult": "400 Bad Request",
    "tags": [{"name": "core"}, {"name": "RFA"}, {"name": "backoffice"}],
    "statusId": -1,  # Draft
})
api("POST", f"/api/rs/testcase/{id2}/scenario", access, {
    "steps": [
        {"name": "Send request with invalid data", "expectedResult": "400 Bad Request", "steps": []}
    ]
})

print(f"https://testops.wnf.rocks/project/1/test-cases/{id1}")
print(f"https://testops.wnf.rocks/project/1/test-cases/{id2}")
```

### Important clone rules

- **Always clone from the same source** — never chain clones (clone → clone → clone). Exception: chaining is acceptable when the intermediate clone is already fully patched and is the semantically closest template (e.g. a same-family case created minutes ago) — still always clear relations afterwards.
- Clone endpoint: `POST /api/rs/testcase/{sourceId}/clone` body = `{"projectId": 1}` — the body is **REQUIRED** (no body → 400); the `name` in body is **ignored**, the clone inherits the source's name
- **After cloning, always clear relations**: `POST /api/rs/testcase/{newId}/relation` with body `[]`
- **After cloning, always `PATCH` the name** — this is mandatory since the clone endpoint ignores the `name` field
- **After cloning, always set status to Draft**: `PATCH ... {"statusId": -1}` — the user changes status manually
- **Always set the scenario with the test steps** — write actions/verifications directly into `scenario` (see "Scenario (steps)"); `precondition` holds SETUP only. Never leave the scenario empty.
- The `name` field should be format `API | CORE | {service} | {test name}` — it is the title only; the tree folder (`Manual | Regres New features cases`) comes from the `Feature`/`Component` custom fields, which are inherited from the clone source
- Cloning preserves: projectId, workflowId, statusId, testLayerId, tags, preconditions, expectedResult, description, scenario, **customFields** (Feature/Component — tree placement)
- After cloning, PATCH only the fields that differ from the source

## API Reference

### Key endpoints

| Action | Endpoint | Method |
|--------|----------|--------|
| Get test case | `/api/rs/testcase/{id}` | GET |
| **Clone test case** | `/api/rs/testcase/{id}/clone` | **POST** |
| Update test case | `/api/rs/testcase/{id}` | PATCH |
| Get relations | `/api/rs/testcase/{id}/relation` | GET |
| **Clear relations** | `/api/rs/testcase/{id}/relation` | **POST** (body `[]`) |
| Delete test case | `/api/rs/testcase/{id}` | DELETE |

**Clone endpoint details:**
- `POST /api/rs/testcase/{sourceId}/clone`
- Request body is **REQUIRED**: `{"projectId": 1}` — calling without a body returns 400 "Required request body is missing"
- The `name` field in the clone body is **ignored** by the API; the clone inherits the source's name
- Returns the full new test case (including the new `id`)
- Inherits ALL fields from source: projectId, workflowId, statusId, testLayerId, tags, preconditions, expectedResult, description, scenario, **name**
- **After cloning, always `PATCH` the name** to set the correct test case name

**Relations clearing:**
- Cloning auto-creates a `"clones"` relation from the new test case to the source
- Clear it with `POST /api/rs/testcase/{newId}/relation` and body `[]` (empty array)
- There is **no DELETE endpoint** for relations — use POST with `[]`

**Scenario (steps)** — ALWAYS set on every new test case (not opt-in):
- `POST /api/rs/testcase/{id}/scenario` with body `{"steps": [{"name": "...", "expectedResult": "...", "steps": []}]}` (verified on this instance)
- `expectedResult` may be empty for pure action steps; nested substeps go into `steps`
- **Split convention** (established on case 102920): `precondition` holds the SETUP only (entities to create, state to reach — ends with the state the test starts from); the scenario holds ACTIONS and VERIFICATIONS (listen/do/verify). Keep the case-level `expectedResult` as a short summary pointing to the steps for details
- **Last scenario step has NO expected result** (template rule, verified on cases 103227/103228): do NOT attach `expectedResultSteps` to the final GET/verification step — it is a pure action ("request and find the entity"). All verification expectations live in the case-level `expectedResult` field ONLY (status code + asserted contract). Intermediate steps (create/activate) keep their own expectedResultSteps (e.g. "200 OK; save the returned id as {{...}}", "campaign status = Active")
- Note: legacy team cases have an empty scenario (everything historically lived in `precondition`); for NEW cases always write the steps into the scenario directly — do not ask the user whether to use scenario

**Status:**
- Always set status to Draft after cloning: `PATCH ... {"statusId": -1}`
- The user changes the status manually — never leave the inherited status

### Tree structure

**The tree in TestOps is NOT built from name prefixes.** The case directory is defined by custom fields (verified):

- `Feature` — folder/section in the tree, e.g. `API | Core | Manual | Regres New features cases`
- `Component` — parent group, e.g. `Core`

The case name (`API | CORE | {service} | ...`) is only a title in the list; it has **no effect** on the tree position. Renaming a case does not move it between folders.

**How to set the directory:**
1. Find a sibling case already in the target folder (e.g. 100263).
2. Read its custom fields: `GET /api/rs/testcase/{siblingId}` → `customFields` (or MCP `find_testcases` with `expand: ["custom_fields"]`).
3. PATCH the same `Feature`/`Component` on the new case (see "Tree placement" above).

Target folders on this instance:
- RFA backlog: `Feature = "API | Core | Manual | Regres New features cases"`, `Component = "Core"`
- Feature's own tree branch when one already exists (e.g. branding campaigns live directly under a BackOffice branch) — copy `Feature`/`Component` from an existing sibling case like 101421+

### Step 4 — Self-review

After creating all test cases, fetch each one via `GET /api/rs/testcase/{id}` and verify:

1. ✅ **Name** — matches the checklist and format `API | CORE | {service} | {test name}` (no `Manual | Regres...` prefix — it is NOT part of the name)
2. ✅ **precondition** — contains the SETUP only (entities to create, state to reach); the API request itself lives in the scenario, not in the precondition
3. ✅ **expectedResult** — matches the checklist (status code + expected message)
4. ✅ **tags** — contains `core`, `RFA`, `{service}` (lowercase)
5. ✅ **status = Draft** — `statusId` should be `-1` (Draft); the user changes status manually
6. ✅ **relations cleared** — `GET /api/rs/testcase/{id}/relation` should return `[]`
7. ✅ **scenario** — steps are ALWAYS written into the scenario (actions/verifications); verify steps content matches the checklist
8. ✅ **tree placement** — `customFields` contain the same `Feature`/`Component` values as the sibling case in the target directory (verified via expanded `custom_fields`)
9. ✅ **No duplicates** — search for the same test case names before/after creation; report any duplicates to the user

If any issues found, fix them immediately with `PATCH /api/rs/testcase/{id}`.

**Duplicate check** (run after every batch):

> ⚠️ On this TestOps version the list endpoint **ignores all filter params** — `search`, `rql`, `tag`, `filter.*` are silently dropped and the response always returns the full project (16k+ cases, `totalElements` unchanged). List items contain only `id`, `name`, `status`, `automated` (no tags/description). Filter **client-side** while paging:

```python
import json, subprocess

def iter_cases(access, keyword, min_id=0, max_pages=60, size=100):
    """Page newest-first, yield cases whose name contains keyword (case-insensitive)."""
    for page in range(max_pages):
        out = subprocess.run(["curl","-s",
            f"{BASE}/api/rs/testcase?projectId=1&size={size}&page={page}",
            "-H",f"Authorization: Bearer {access}"], capture_output=True, text=True).stdout
        content = json.loads(out).get("content", [])
        if not content:
            return
        for c in content:
            if keyword.lower() in (c.get("name") or "").lower():
                yield c
        if min(c["id"] for c in content) < min_id:
            return
```

Group the matches by `name`, flag any name appearing more than once. If duplicates found — **report to the user** (list names + IDs + links), do not silently delete.

## Case-first: creating cases while writing autotests

When the task is "write an autotest for X" and no TestOps case exists yet, create the case **before** writing the test and put the returned real ID straight into `@AllureId` — this avoids the `@AllureId("0")` placeholder round-trip and keeps test↔case traceability exact.

Workflow (verified on branding campaigns CORE-4104, cases 102911–102919):

1. **Clone from the nearest sibling case of the same feature/endpoint** (keeps naming style, tags, workflow). If several cases in one batch share the shape, patch the first clone fully, then cloning the rest from that patched clone is acceptable (still clear relations on every clone).
2. **PATCH content to mirror the future test exactly**:
   - `name`: `API | CORE | {service} | {action} {entity} ... {what is verified}` — match the test's `@DisplayName` semantics
   - `precondition`: the SETUP only (entities to create, state to reach). `scenario`: the full flow as steps (actions/verifications), including exact request bodies with `{{placeholder}}` values
   - `expectedResult`: status code + the verified contract. For Kafka checks: topic name + every asserted field with expected values (e.g. `TableName = {{brandedTableName}}`, `BrandingAssets = {...}`, explicit `null` where the type has none)
3. **Tags**: `core`, `RFA`, service (lowercase), plus the feature tag (e.g. `BrandingRework`, id 24336).
4. **Use the returned ID in `@AllureId` immediately**, then write the test to implement the case 1:1.
5. Jira link is added manually by the user in the UI (see API limitation note above).

## Creating via MCP (DEFAULT path)

**MCP `allure-testops` is the PRIMARY and default way to create test cases.** Use it whenever the MCP tools are available (normally they always are). No API token and no clone source ID are needed. Verified on case 103218 (CORE-4117, SearchTables IncludeBrandingsInfo=true). Only if the MCP tools are unavailable, fall back to the raw clone-and-PATCH flow and ask the user for the clone source test case ID (see "Workflow — PRIORITY ORDER" and "Required: clone source").

**MCP create differs from clone:**
- `testops_create_testcase` creates a case **from scratch** (no clone, no source ID, no relations to clear) — it is the MCP equivalent of `POST /api/rs/testcase`.
- **Tree placement MUST be set via `customFields`** — a case created via MCP starts with NO custom fields, so without `Feature`/`Component` it would NOT appear in the target folder. Pass them in the same call or patch via `testops_update_testcase`.
- Scenario steps are supported natively in the create/update payload (`scenario.steps[]` with `type: "body"` + `expectedResultSteps[]` with `type: "expected_body"`) — unlike the curl `POST .../scenario` extension.
- Tags are passed **by name** (strings), not by id.
- Issue link **IS settable via MCP** (`issues: [{"name": "Jira", "value": "CORE-4117"}]`) — unlike the personal API token, which cannot set issue links (see limitation note above). Verify in UI afterwards.

**MCP workflow:**

1. `testops_get_project` (expand `workflow`, `test_layers`, `integrations`) → confirm `Custom Manual` workflow, `Draft` status, `API Tests` layer, `Jira` integration.
2. Find target directory values: `testops_find_testcases` with `aql: "id = {siblingId}"`, `expand: ["custom_fields"]` → copy `Feature`/`Component` (e.g. `Feature = "API | Core | Manual | Regres New features cases"`, `Component = "Core"`).
3. `testops_create_testcase` with: `projectId: 1`, `name: "API | CORE | {service} | {test name}"`, `precondition` (SETUP only), `expectedResult`, optional `description`, **`scenario` (ALWAYS — the test steps)**, `workflow: "Custom Manual"`, `status: "Draft"`, `testLayer: "API Tests"`, `tags: ["core", "RFA", "{service}", ...]`, `customFields: [{"name": "Feature", ...}, {"name": "Component", ...}]`, `issues: [{"name": "Jira", "value": "{KEY}"}]`. Scenario steps: intermediate steps keep `expectedResultSteps`, the **last (verification) step has NO `expectedResultSteps`** — expectations go only into the case-level `expectedResult` (see "Scenario (steps)").
4. `testops_find_testcases` with `expand: ["custom_fields", "tags", "scenario"]` → self-review: name, precondition, expectedResult, tags, status=Draft, customFields Feature/Component, duplicates.

> If the user asks to **move** an existing case to another directory, use `testops_update_testcase` and PATCH only `customFields` (Feature/Component) — do NOT rename the case (name does not affect the tree; verified 103218).

## Output

After creating the test case, show:
- Test case ID and name
- Link to view in TestOps: `https://testops.wnf.rocks/project/1/test-cases/{testCaseId}`
- Summary: total created, Jira issue linked (or "link manually in UI")

## Tips

- **Prefer MCP `allure-testops` first (default path)** — no API token, no clone source ID required. Ask the user for the clone source test case ID ONLY if the MCP tools are unavailable (REST fallback).
- **Never use `POST /api/rs/testcase` to create from scratch** — in the REST fallback always `POST /api/rs/testcase/{sourceId}/clone` then PATCH (the MCP `create_testcase` is the allowed exception — it is the sanctioned from-scratch creation path).
- Always ask for Jira issue number first — never proceed without it.
- Always ask for clone source test case ID **only in the REST fallback** — the template to clone from. Do not ask when MCP is available.
- **Clone each test case from the same original source** — do not chain clones (see the narrow exception in the rules above).
- Clone body is required: `{"projectId": 1}` — all other fields are inherited.
- **Clone endpoint ignores `name`** — always PATCH the name after cloning.
- **Clear relations after cloning** — `POST /api/rs/testcase/{id}/relation` with `[]`.
- **Scenario is ALWAYS written directly with the test steps** — never leave the scenario empty and never ask the user whether to use scenario; `precondition` holds SETUP only (see "Scenario (steps)").
- **Last scenario step = no expected result inside** — the final GET/verification step is a pure action (no `expectedResultSteps`); all verification expectations go into the case-level `expectedResult` field only (see "Scenario (steps)").
- **Always set status to Draft (-1)** — the user changes status manually.
- **Tree placement ≠ name.** The case directory is defined by the `Feature`/`Component` custom fields, not by the name. Renaming does NOT move a case in the tree — to "move a case to folder X", PATCH `customFields` with values from a sibling case already in folder X.
- Service name in the `name` field must match one of: Partners, PlayerStats, BackOffice, FreeCheeps, WagerCraft, Replays, PublicApi, etc.
- Tags are lowercase: the service tag matches the service name (e.g. `backoffice`), NOT the tree folder — the tree folder comes from the `Feature` custom field.
- Always add tags: `core`, `RFA`, and the service name (lowercase).
- Manual test cases don't need `fullName` or `hash` — those are for automated tests only.
- **Scenario steps must include the API request** — add a step with `Send POST {{GW_API_URI}}/backoffice/{endpoint}` and the request body with placeholder values.
- **Add a final GET step** — since createBrandingCampaign doesn't return the campaign in the response, add `Send GET {{GW_API_URI}}/backoffice/v5/getBrandingCampaign?id={{brandingCampaignId}}` as the last scenario step.
- TestOps REST API is sensitive to rate limiting — if you get 403, wait and retry.
- **Token hygiene** — `ALRURE_API_TOKEN` lives only in the shell environment; never write token values into skill files, scripts, or the repo. In the default MCP path the token is not needed at all; the token is only used by the REST fallback. If the env var is empty and MCP is unavailable, ask the user to provide/export it for the session.
- The list endpoint ignores `search`/`rql`/`tag`/`filter.*` params — always filter client-side (see Duplicate check).

Base directory for this skill: /Users/yauhenizhuk/.config/opencode/skills/create-testcases
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.