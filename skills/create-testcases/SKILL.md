---
name: create-testcases
description: Analyzes requirements and creates manual test cases in Allure TestOps under API | CORE | Manual | Regres New features cases. When given requirements, first presents a checklist for review — NEVER creates test cases without explicit user selection. Always asks for Jira issue number and service name. Tags: core, RFA, service name.
---

# Create Test Cases in TestOps

## Goal

Create new manual test cases in Allure TestOps (Winfinity project, id=1) under the folder **API | CORE | Manual | Regres New features cases**. These are Ready-for-Automation (RFA) test cases that will later be automated.

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

## Required: Jira issue number

**Always ask the user** which Jira issue number to link before creating test cases. The issue will be added as an Issue link on each test case.

If the user doesn't provide one, ask again before proceeding.

## Test case specification

### Name format

```
API | CORE | {service} | {test case name}
```

Where:
- `{service}` — the Core service: Partners, PlayerStats, BackOffice, FreeCheeps, WagerCraft, Replays, PublicApi, etc.
- `{test case name}` — a short, clear description of what the test verifies

Example: `API | CORE | Partners | Replace domain after starting master session when FF is enabled`

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

Always add these tags: `core`, `RFA`, and the service name (lowercase).

## Creating a test case

### Minimal (name only)

```bash
ACCESS=$(cat /tmp/allure_token.txt) && BASE="https://testops.wnf.rocks"

curl -s -X POST "$BASE/api/rs/testcase" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "name": "API | CORE | Partners | My new test",
    "statusId": -1,
    "testLayerId": -3,
    "automated": false,
    "workflowId": 1
  }'
```

### With description and steps

When the user provides a checklist or test scenario, include description and steps:

```bash
curl -s -X POST "$BASE/api/rs/testcase" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": 1,
    "name": "API | CORE | Partners | Test name",
    "statusId": -1,
    "testLayerId": -3,
    "automated": false,
    "workflowId": 1,
    "description": "Step 1: Do X\nExpected: Y happens\n\nStep 2: Do Z\nExpected: W happens",
    "precondition": "Any preconditions here"
  }'
```

### Adding tags and issue link (update after creation)

Tags and links are added via PATCH after creating the test case:

```bash
# First create the test case, capture the returned ID
TC_ID=$(...)

# Add tags
curl -s -X PATCH "$BASE/api/rs/testcase/$TC_ID" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "tags": [
      {"name": "core"},
      {"name": "RFA"},
      {"name": "partners"}
    ]
  }'

# Add Jira issue link
curl -s -X POST "$BASE/api/rs/testcase/$TC_ID/issue" \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CORE-1234",
    "url": "https://wnf3.atlassian.net/browse/CORE-1234",
    "typeId": 1
  }'
```

## Workflow: from requirements to test cases

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
- **Selection** — which test cases to create. The user can:
  - List specific numbers (e.g. `1.1, 1.2, 3.1-3.5`)
  - Select entire categories (e.g. `Category 1, Category 4`)
  - Say "all" to create everything

**Never create test cases without explicit user confirmation of which ones to create.**

### Step 3 — Create only selected test cases

After the user confirms the selection, create only those test cases:

1. Create each test case via POST
2. Add tags (`core`, `RFA`, `{service}`) via PATCH
3. Add Jira issue link via POST `/issue`
4. Show summary with TestOps URLs

```bash
# Example: creating only selected test cases
for name in "Test one" "Test three"; do
  curl -s -X POST "$BASE/api/rs/testcase" \
    -H "Authorization: Bearer $ACCESS" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectId\": 1,
      \"name\": \"API | CORE | Partners | $name\",
      \"statusId\": -1,
      \"testLayerId\": -3,
      \"automated\": false,
      \"workflowId\": 1
    }"
done
```

## Output

After creation, show:
- Test case ID and name
- Link to view in TestOps: `https://testops.wnf.rocks/project/1/test-cases/{testCaseId}`
- Summary: total created, Jira issue linked

## Tips

- Always ask for Jira issue number first — never proceed without it.
- Service name in the `name` field must match one of: Partners, PlayerStats, BackOffice, FreeCheeps, WagerCraft, Replays, PublicApi, etc.
- Tags are lowercase: the service tag matches the folder name in the tree.
- If the API returns an error about tags on creation, create the test case first, then PATCH tags and links separately.
- Manual test cases don't need `fullName` or `hash` — those are for automated tests only.