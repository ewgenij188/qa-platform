---
name: winfinity-testops
description: |
  Work with Allure TestOps Winfinity project (id=1) — 15k+ test cases.
  Use when the user needs to write test cases, analyze failed tests, search
  test cases, create test cases for manual or automated testing, or explore
  the test case tree. Covers API (CORE, BackOffice, Partners, PlayerStats,
  WagerCraft), UI, UI Mobile, Table management.
---

# Winfinity TestOps Skill

## Project & Auth

| Field | Value |
|-------|-------|
| Project | **Winfinity** (id=1) |
| Base URL | `https://testops.wnf.rocks` |
| API token | `{env:ALRURE_API_TOKEN}` |

**Auth flow**: Exchange API token for JWT access token:

```bash
ACCESS=$(curl -s -X POST "$BASE/api/uaa/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=apitoken&token=$ALRURE_API_TOKEN" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Then call any endpoint with `-H "Authorization: Bearer $ACCESS"`.

**Token lifespan**: 16 hours. If 401, re-exchange.

## Test case tree structure

Test case names use ` | ` as a path separator (folder hierarchy). There are
**no actual group/folder endpoints** — the tree is derived from name prefixes.

### Top-level folders (first segment before ` | `)

| Root folder | Count (approx) | Purpose |
|-------------|--------|---------|
| `API` | 200+ | API integration/contract tests |
| `UI` | 350+ | E2E UI tests (desktop) |
| `UI Mobile` | 100+ | E2E UI tests (mobile) |
| `UI Desktop` | 5+ | Desktop-specific UI |
| `Table management` | 34 | Table activation/deactivation, folder/site tables |
| `General` | 22 | Campaigns/vouchers E2E |
| `Create campaign` | 4 | Campaign creation UI |
| `Currency` | 3 | Currency settings |
| `Cancel game toaster` | 1 | Cancel game toaster UI |
| Others | Varies | Single-purpose test groups |

### API sub-tree (second level)

| Sub-folder | Count | Focus |
|------------|-------|-------|
| `CORE` | 90+ | CORE service: FreeCheeps, BackOffice, Partners, PlayerStats, Replays, WagerCraft, TopWins, Kafka |
| `BackOffice Admin` | 70+ | BO Admin: Table management, Transaction reports, GSD, Sessions, Players, GSD PROJECT_FIELDS |
| `Backoffice Tables` | 7 | BO Tables: Max expo templates |
| `IBO` | 8 | IBO: Signaling, Game management |
| `Operation portal` | 11 | OP: User management, dealer auth, 2FA |
| `Core` | 1 | Kafka |

### API CORE sub-folders (third level)

| Sub-folder | Tests | Description |
|------------|-------|-------------|
| `FreeCheeps` | 26 | Public API: create, cancel, validation |
| `BackOffice` | 22 | Table settings, new game types, dealerName, table activation |
| `Partners` | 13 | Domain replacement, master sessions |
| `Replays` | 9 | Replay short links, share types |
| `PlayerStats` | 9 | History/gameDetails with replays/sweepstake flags |
| `WagerCraft` | 8 | Token checks, Jackpot/tournament status |
| `TopWins` | 1 | Top wins |
| `Kafka` | 1 | Kafka events |

### Manual test case paths (reference)

- `API | CORE | Manual | Regres` — manual regression test cases
- `API | CORE | Manual | Regres New features cases` — new test cases for automation
- `UI | * | Manual | *` — UI manual tests (e.g., `UI | Blackjack | UI menu | Manual | [Help]`)

## Test layers

| ID | Layer name | Typical prefix |
|----|-----------|----------------|
| -3 | API Tests | `API \| ...` |
| -2 | UI Tests | `UI \| ...`, `UI Mobile \| ...` |
| -1 | Unit Tests | Various |
| 3 | Mobile Tests (Moon Emulator) | `UI Mobile \| ...` |
| 34 | Mobile Tests (BrowserStack) | `UI Mobile \| ...` |

## Test statuses

| ID | Status | Color |
|----|--------|-------|
| -1 | Draft | `#abb8c3` |
| -2 | Review | `#6f42c1` |
| -3 | Active | (default) |

## Key API endpoints

### Test cases

| Action | Endpoint | Method |
|--------|----------|--------|
| List/search | `/api/rs/testcase?projectId=1&size=N&page=M` | GET |
| Search by name | `/api/rs/testcase?projectId=1&search=QUERY` | GET |
| Get by ID | `/api/rs/testcase/{id}` | GET |
| Create | `/api/rs/testcase` | POST |
| Update | `/api/rs/testcase/{id}` | PATCH |
| Delete | `/api/rs/testcase/{id}` | DELETE |

### Launches & results

| Action | Endpoint |
|--------|----------|
| List launches | `/api/rs/launch?projectId=1&size=N` |
| Get launch | `/api/rs/launch/{id}` |
| Launch test results | `/api/rs/launch/{id}/testresult?size=N` |
| Test result by ID | `/api/rs/testresult/{id}` |

### Projects

| Action | Endpoint |
|--------|----------|
| List projects | `/api/rs/project` |

## Search patterns

```bash
# By exact prefix (folder)
search="API | CORE | FreeCheeps"

# By keyword anywhere in name
search="Cancel company"

# URL-encode the search param
curl -s "$BASE/api/rs/testcase?projectId=1&search=$(python3 -c 'import urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$search")"
```

## Writing a new test case

### Create a test case

```json
POST /api/rs/testcase
{
  "projectId": 1,
  "name": "API | CORE | FreeCheeps | Public-api | My new test",
  "statusId": -1,
  "testLayerId": -3,
  "automated": false,
  "description": "Step 1: ...\nExpected: ...",
  "precondition": "Precondition text"
}
```

**Name MUST follow the ` | ` folder convention.** First segment = test layer folder
(`API` for API Tests, `UI` for UI Tests, etc.).

### Name prefix rules

- **API tests**: `API | {area} | {subfolder} | {feature} | {test name}`
- **UI tests**: `UI | {game} | {submenu} | {category} | {test name}`
- **UI Mobile**: `UI Mobile | {game} | {feature} | {test name}`
- **New manual cases for automation**: `API | CORE | Manual | Regres New features cases | {test name}`

## Analyzing failed tests

### Find failed launches

```bash
# Recent launches (page 0, size 10)
curl -s "$BASE/api/rs/launch?projectId=1&size=10&page=0" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
for l in json.load(sys.stdin)['content']:
    print(f'{l[\"id\"]}: {l[\"name\"]} — status={l.get(\"status\")} — passed={l.get(\"passedCount\",\"?\")}/{l.get(\"totalCount\",\"?\")}')"

### Get failed test results from a launch

curl -s "$BASE/api/rs/launch/{launchId}/testresult?size=50&filter.status=FAILED" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
for r in json.load(sys.stdin)['content']:
    print(f'TC-{r[\"testCaseId\"]}: {r[\"name\"]} — {r.get(\"status\")}')"
```

### Common failure analysis steps

1. Get failed test results from the launch
2. Cross-reference with test case details (steps, preconditions)
3. Check recent changes in linked Jira issues (use Atlassian MCP)
4. Check CORE logs in OpenSearch for ERROR patterns around the test time
5. Report findings: test ID, name, failure reason, suggested fix

## Tips

- **15k+ test cases** — always use `search` or `filter` params, never iterate all
- **No folder API** — derive structure from ` | ` separators in names
- **Automated field**: `"automated": true` means the test has an `@AllureId` in qa-tests-v2
- **Token renewal**: re-exchange before every session if >16h
- **Allure IDs**: unique integer IDs from TestOps, linked via `@AllureId` annotation in qa-tests-v2