---
name: analyze-daily-regression
description: Analyzes daily CORE regression test results across 3 environments (latest, release, preprod) from the Allure TestOps dashboard (project/1/dashboards/6). Finds failed/broken tests with the "core" tag in umbrella regression launches, classifies failures, and outputs a per-environment report. Use when the user asks to analyze daily regression, check regression results, review Core test failures, or mentions dashboard/6.
---

# Analyze Daily Regression

## Goal

Analyze Core daily regression test results across **3 environments** — `latest`, `release`, `preprod` — from the [Core dashboard](https://testops.wnf.rocks/project/1/dashboards/6).

**Workflow:**
1. Find umbrella regression launches: `QA-TESTS SCHEDULED - REGRESSION - {env}`
2. Within each umbrella launch, find tests tagged **`core`** with statuses **Failed** or **Broken**
3. Discard all tests without the `core` tag
4. Classify failures and output a concise per-environment report

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

All subsequent calls use `-H "Authorization: Bearer $ACCESS"`.

## Launch discovery

Only umbrella regression launches: names starting with `QA-TESTS SCHEDULED - REGRESSION - {env}`.

Fetch the **most recent** per environment:

```bash
curl -s "$BASE/api/rs/launch?projectId=1&size=3&page=0&sort=createdDate,DESC" \
  -H "Authorization: Bearer $ACCESS" | python3 -c "
import sys, json
for l in json.load(sys.stdin).get('content', []):
    if 'QA-TESTS SCHEDULED - REGRESSION - {env}' in l['name']:
        print(json.dumps({'id': l['id'], 'name': l['name']}))
"
```

Get launch stats:

```bash
curl -s "$BASE/api/rs/launch/{launchId}/statistic" \
  -H "Authorization: Bearer $ACCESS"
# Returns: [{"status":"failed","count":N}, {"status":"broken","count":M}, ...]
```

Skip launches where `failed + broken = 0`.

## Core tag filtering

A test is considered Core if its test case has the **`core`** tag. The tag is checked via the test case API.

### Filtering workflow

1. Fetch all test results from the umbrella launch (paginate), collecting testCaseId for statuses `failed` or `broken`
2. For each distinct failed/broken testCaseId, fetch the test case and check its tags
3. Keep only tests where `'core'` is in the tags list
4. Discard all others

```bash
# Fetch test case and check for core tag
curl -s "$BASE/api/rs/testcase/{testCaseId}" \
  -H "Authorization: Bearer $ACCESS" | python3 -c "
import sys, json
tc = json.load(sys.stdin)
tags = [t['name'] for t in tc.get('tags', [])]
if 'core' in tags:
    print(json.dumps({'tcId': tc['id'], 'name': tc['name']}))
"
```

### Combined script

```python
import json, subprocess

BASE = "https://testops.wnf.rocks"
ACCESS = "..."  # from auth step

launch_id = 195151  # example

# Step 1: Collect all distinct failed/broken testCaseIds
failed_tc_ids = set()
for page in range(16):  # 7000+ tests / 500 per page
    result = subprocess.run(
        ['curl', '-s', f'{BASE}/api/rs/testresult?launchId={launch_id}&size=500&projectId=1&page={page}',
         '-H', f'Authorization: Bearer {ACCESS}'],
        capture_output=True, text=True, timeout=30
    )
    data = json.loads(result.stdout)
    for r in data.get('content', []):
        if r.get('status') in ('failed', 'broken') and r.get('testCaseId'):
            failed_tc_ids.add(r['testCaseId'])
    if len(data.get('content', [])) < 500:
        break

# Step 2: Filter by core tag
core_failures = []
for tcId in failed_tc_ids:
    result = subprocess.run(
        ['curl', '-s', f'{BASE}/api/rs/testcase/{tcId}',
         '-H', f'Authorization: Bearer {ACCESS}'],
        capture_output=True, text=True, timeout=10
    )
    tc = json.loads(result.stdout)
    tags = [t['name'] for t in tc.get('tags', [])]
    if 'core' in tags:
        core_failures.append({
            'tcId': tcId,
            'tcName': tc.get('name', ''),
            'tags': tags
        })
```

## Fetching failure details

For each Core failure found, get the test result details (message, trace, status):

```bash
curl -s "$BASE/api/rs/testresult?launchId={launchId}&testCaseId={testCaseId}&projectId=1" \
  -H "Authorization: Bearer $ACCESS" | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('content', []):
    if r.get('status') in ('failed', 'broken'):
        print(json.dumps({
            'status': r['status'],
            'message': (r.get('message', '') or '')[:300]
        }))
"
```

## Failure classification

Categorize each failure by matching `message` patterns:

| Class | Patterns | Meaning |
|-------|----------|---------|
| **Timeout** | `Read timed out`, `connect timed out`, `SocketTimeoutException`, `Connection refused`, `was not received during` | Network/infra timeout |
| **Assertion** | `expected:`, `but was:`, `AssertionError`, `Status code` | Test assertion failed — unexpected API response |
| **Infra** | `500 INTERNAL_SERVER_ERROR`, `502 Bad Gateway`, `503 Service`, `Connection reset`, `Failed to connect` | Service-side error |
| **Test data** | `null`, `Not Found`, `no .* with specified`, `ObjectId` | Missing or invalid test data |
| **Script** | `NullPointerException`, `NoSuchElementException`, `StaleElementReferenceException` | Test script issue |
| **Unknown** | Empty message or doesn't match | Needs manual investigation |

## Output format

```markdown
## Daily Core Regression — {YYYY-MM-DD}

### Environment: {env}
**Launch:** QA-TESTS SCHEDULED - REGRESSION - {env} — {N} failed, {M} broken, {P} passed

Core tag filter: {X} failed/broken out of {Y} total failed/broken

| # | TC-ID | Test name | Status | Failure | Class |
|---|-------|-----------|--------|---------|-------|
| 1 | TC-81749 | Send statistic correction... | failed | Read timed out | Timeout |

**Summary:**
- Total Core failed/broken: X
- Timeout: Y
- Assertion: Z
- Infra: W

### Environment: release

...

### Overall verdict
- **Blocker**: [if any]
- **New failures**: [list]
- **Recurring**: [list]
```

## Tips

- Only umbrella launches (`QA-TESTS SCHEDULED - REGRESSION - {env}`) are analyzed.
- Core tests are identified by the **`core`** tag on the test case (not the tree path).
- If a test fails across multiple environments, it's a **code regression**; env-only failures are likely infra.
- `Read timed out` on partners tests is often a known intermittent CI issue.
- The `core` tag appears on tests that belong to Core services (partners, playerstats, public-api, etc.).