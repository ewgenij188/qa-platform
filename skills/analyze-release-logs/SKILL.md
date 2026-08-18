---
name: analyze-release-logs
description: Analyzes CORE release ERROR logs in OpenSearch (win-dev-core-*) for services in the current release scope. Asks for deploy time (UTC), discovers regression windows via ERROR log spikes (after deploy vs before deploy), then compares noise/FP pattern counts and reports patterns that are new after release. Use when the user asks to analyze release logs, post-deploy log health, regression vs regression ERROR comparison, or new ERROR patterns after deployment.
---

# Analyze Release Logs

## Goal

Find **new** ERROR patterns after release (before count = 0) and report **noise/FP** pattern count changes between two **regression** windows — not calendar day−1 clock slots.

Post-deploy traffic is dominated by automated regression. Comparing “same hour yesterday” mixes quiet hours with suite runs and produces false alarms.

## Required inputs (ask before querying)

Do **not** run OpenSearch until these are confirmed (infer from context when possible):

1. **Namespace** — `release` or `preprod`?
2. **Deployment time (UTC)** — e.g. `2026-07-24T13:00:00Z` (ask if missing)
3. **Services in this release** — list of `app.kubernetes.io/name` values

### Resolving the service list

Services are **only** those deployed/changed in the **current release**, not every CORE app.

**Infer from context when possible:**
- User named apps in the request
- Prior messages (deploy checklist, branch-release, release scope)
- **core-release-diff-audit** / GitLab develop-vs-master results
- Release ticket list or pipeline links

**If unclear, ask:**

> Which services are in this release? (e.g. `backoffice`, `partners`, `playerstats`, `slots-adapter`)

## OpenSearch

- **MCP server:** `user-opensearch` (or `opensearch` after platform-ai sync)
- **Tool:** prefer `search_documents` with `size: 0`, `track_total_hits: true`, `timeout: "55s"`; fall back to `general_api_request` `POST /…/_count`
- **Index:** resolve latest `win-dev-core-*` via `GET /_cat/indices/win-dev-core-*?v&s=index:desc` (do not hardcode a stale number)
- Filter field: `kubernetes.pod_labels.app.kubernetes.io/name.keyword` — **not** `projName`

MCP read timeout is ~10s — prefer **per-pattern counts**, **1h–2h slices**, and **sampled hits** over large `terms` aggs on `log.message.keyword` (those often time out).

Also read workspace rule `release-opensearch-log-filters.mdc` for FP semantics.

## Workflow

```
Progress:
- [ ] Confirm namespace + deploy UTC + release services
- [ ] Resolve OpenSearch index
- [ ] Discover regression-after and regression-before windows from ERROR spikes
- [ ] Confirm windows with user if ambiguous; then compare
- [ ] Noise/FP pattern counts (after vs before)
- [ ] New-only patterns (after > 0, before = 0)
- [ ] Deliver tables + short verdict
```

### Step 1 — Discover regression windows from log spikes

Do **not** use `D` vs `D − 1 day` as the primary comparison.

**Regression signal:** ERROR volume on multi-service apps (not backoffice-only baseline), e.g. `partners`, `public-api-v1`, `playerstats`, `slots-adapter`, `wagercraft-adapter`, plus other release services.

1. Query hourly histogram from roughly `D − 36h` through `D + 12h` (or full calendar days spanning before/after deploy):
   - `must`: namespace, `log.level: ERROR`
   - `date_histogram` on `timestamp`, `calendar_interval: 1h`
   - Optional sub-agg: `terms` on `app.kubernetes.io/name` (top apps)
2. Refine candidates with **15m** buckets and a **signal** filter agg on the multi-service app list (exclude pure backoffice background).
3. Pick:
   - **After:** first clear multi-service spike starting at or after deploy `D` (suite start → return to baseline)
   - **Before:** last comparable multi-service spike **before** `D` (same shape if possible — often morning suite on deploy day or previous day)

**Typical shape:** signal rises above quiet baseline (~few dozen/15m on signal apps), peaks for 1–3h, then drops. Backoffice alone at ~6–9k ERROR/h is **not** a regression window.

4. State the chosen windows (ISO UTC) in the report header. If two candidates are equally plausible, prefer equal-length windows and briefly note the choice. If spikes are unclear, ask the user to confirm windows before comparing.

### Step 2 — Compare windows

For **after** and **before** regression windows:

1. **Raw totals** per release service (ERROR, no filters) — overview only.
2. **Noise / FP table** — count known noisy patterns per service (see checklist below); columns: Service, Pattern, After, Before, Delta, Class.
3. **New after release** — patterns with **after > 0 and before = 0**, after stripping noise/FP (and optional QA fingerprints). Small counts matter if non-noise.

#### Finding “new” patterns

1. Sample ERROR hits in the **after** window with heavy `must_not` (tier-1 + tier-2 + known noise list). Prefer `size: 40–80` sorted by time; avoid large `terms` on `log.message.keyword` unless it completes quickly.
2. Normalize candidates (strip IDs/UUIDs/hex when matching) into wildcard / `match_phrase` patterns.
3. For each candidate, `_count` / `track_total_hits` in **after** and **before**.
4. Keep only **before = 0**. Classify:
   - **Investigate** — possible regression (e.g. Redis failures, unexpected infra)
   - **Deploy noise** — health/startup only in first ~30m after `D`, then gone
   - **QA** — RandomHeaderValue, empty required fields, invalid ISO codes from suite

### Step 3 — Noise pattern checklist

Count these when relevant to services in scope (skip patterns for services not in the release list):

| Area | Patterns (examples) | Class |
|------|---------------------|-------|
| backoffice | `*Deleted folders*is present in node ancestors*`, `*no table settings with specified id*`, `*Table * not found*`, `*Table node settings not found*`, `*Partner table settings*`, `*no site with specified id*`, `*Some sites*`, `*Requested sites*` | FP / noise |
| partners | `*Site with id*not found*`, `failed with code:601`, `*invalid bet names*`, `*changeScreenName*`, rollback/`getSiteInfo` paths | FP / Business / QA |
| playerstats | `*Failed to validate request*`, `*Game snapshot not found*`, `*must be convertible to Mongo ObjectId*` | QA / Business / FP |
| adapters | `*Unknown integration id*`, `*RandomHeaderValue*`, `*Can not find site*` | QA / FP |
| all | `*Health check*`, `/health/startup` failures | Deploy noise |
| all | `*Unauthorized*` | FP |

Full wildcards and query skeletons: [filters-reference.md](filters-reference.md).

## Expected output

One report with **two main tables** (plus optional raw totals). Do **not** dump per-service volume tables of unfiltered ERROR as the primary deliverable.

### Output template

```markdown
**Namespace:** release
**Deploy:** 2026-07-24T13:00:00Z
**Regression after:** 2026-07-24T13:45Z–15:30Z UTC
**Regression before:** 2026-07-23T06:30Z–09:00Z UTC
**Index:** win-dev-core-000420
**Services:** backoffice, partners, …

### 1. Raw ERROR totals by service

| Service | After | Before | Delta |
|---------|------:|-------:|-------|
| … | … | … | … |

### 2. Noisy / false-positive logs

| Service | Pattern | After | Before | Delta | Class |
|---------|---------|------:|-------:|-------|-------|
| backoffice | `Deleted folders …` | … | … | … | FP / noise |
| … | … | … | … | … | … |

### 3. New after release (before = 0)

| Service | Pattern / example | After | Note |
|---------|-------------------|------:|------|
| playerstats | `Fail to call Redis` | 53 | Investigate — deploy burst only |
| … | … | … | … |

### 4. Verdict
- …
```

**Delta column:** prefer `−N%` / `+N%` / `flat` / `new` / `gone`. Note if window lengths differ materially; optionally add per-hour rates.

**Verdict:** 3–6 bullets — what is truly new vs noise, deploy-only bursts vs sustained, what needs investigation.

## Tips

- Prefer **new-only** over volume spikes; a count of 1–2 can still be critical if non-noise.
- `Fail to call Redis` / health Unhealthy clustered in the first ~30m after deploy → label **deploy burst**, not sustained regression, if counts drop to 0 afterward.
- partners `invalid bet names` and `changeScreenName` usually persist across regression runs (suite noise).
- If OpenSearch times out: shrink time range, drop `terms` on message, use `match_phrase` / wildcard `_count` per pattern, or sample then verify.

## Additional resources

- [filters-reference.md](filters-reference.md) — query bodies, FP list, slice examples
