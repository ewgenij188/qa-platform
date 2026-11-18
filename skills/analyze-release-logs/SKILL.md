---
name: analyze-release-logs
description: Analyzes CORE release ERROR logs in OpenSearch (win-dev-core-*) service by service. Compares two regression windows, skips only known useless noise, and reports every remaining ERROR — including patterns that already existed before deploy. Use when the user asks to analyze release logs, post-deploy log health, regression vs regression ERROR comparison, or new ERROR patterns after deployment.
---

# Analyze Release Logs

## Goal

Compare two **regression** windows, then report every ERROR that is not on the useless-noise list.

A pattern that already existed before deploy is still in the report. `before > 0` is context, not a reason to drop the row. The slots-adapter `value too long for type character varying(36)` miss happened because findings were limited to `before = 0` and slots was not read on its own.

Post-deploy traffic is dominated by automated regression. Comparing “same hour yesterday” mixes quiet hours with suite runs and produces false alarms. Keep spike-based windows.

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

- **MCP server:** OpenSearch and Grafana may be a direct MCP or wnf-developer. Use whichever is configured. If both are configured, either is valid.
  - Direct OpenSearch (`user-opensearch` or `opensearch`): `search_documents`, `general_api_request`.
  - Direct Grafana (`user-grafana` or `grafana`): that server's Grafana tools.
  - wnf-developer (`user-wnf-developer`): OpenSearch tools are prefixed `opensearch_`, Grafana tools `grafana_`.
- **Tool:** `search_documents` or `opensearch_search_documents`, with `size: 0`, `track_total_hits: true`, `timeout: "55s"`. Fall back to `general_api_request` or `opensearch_general_api_request` `POST /…/_count`.
- **Index:** resolve latest `win-dev-core-*` via `GET /_cat/indices/win-dev-core-*?v&s=index:desc` (do not hardcode a stale number). If the latest index starts after deploy, query the previous `win-dev-core-*` for the before window.
- Filter field: `kubernetes.pod_labels.app.kubernetes.io/name.keyword` — **not** `projName`. `log.serviceName` is a different value (`slotsadapter` vs `slots-adapter`).

MCP read timeout is ~10s — prefer **per-service** queries, **per-pattern counts**, **1h–2h slices**, and **sampled hits**. Avoid large `terms` aggs on `log.message.keyword` and leading `wildcard` on `log.message.keyword` (those time out). Use `match_phrase` for noise strips.

Also read workspace rule `release-opensearch-log-filters.mdc` for FP semantics.

## Workflow

```
Progress:
- [ ] Confirm namespace + deploy UTC + release services
- [ ] Resolve OpenSearch index
- [ ] Discover regression-after and regression-before windows from ERROR spikes
- [ ] Confirm windows with user if ambiguous; then compare
- [ ] For each service: raw total, strip useless noise, sample what remains
- [ ] For each service: count logs with `log.exception` set (never noise)
- [ ] Count useless-noise patterns (after vs before) for the noise table
- [ ] Report every non-noise pattern with after > 0, whether or not before is 0
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
   - **After:** first clear multi-service spike starting at or after deploy `D` (suite start → return to baseline). If a later spike in the same post-deploy period is still in scope (user asked for “today”), include it or say why it was left out.
   - **Before:** last comparable multi-service spike **before** `D` (same shape if possible)

**Typical shape:** signal rises above quiet baseline, peaks for 1–3h, then drops. Backoffice alone at ~6–9k ERROR/h is **not** a regression window.

4. State the chosen windows (ISO UTC) in the report header. If two candidates are equally plausible, prefer equal-length windows and briefly note the choice. If spikes are unclear, ask the user to confirm windows before comparing.

### Step 2 — One service at a time

Do this for **every** release service, including ones with a small raw total. Do not stop after the noisiest app.

For the **after** window, then the same patterns in the **before** window:

1. Raw ERROR total for that service only.
2. Sample what remains after that service’s useless-noise `must_not` (`size: 40–80`, sort by time). Read the message text. Do not classify a service from the raw total alone.
3. Always run a separate count for **critical exceptions** on that service: logs where `log.exception` is not null. These are never noise, even when `before > 0`.
   ```json
   { "exists": { "field": "log.exception" } }
   ```
4. Normalize each remaining message (strip IDs/UUIDs) into a `match_phrase`. Count it in **after** and **before**.

Keep the row when **after > 0** and the pattern is not on the useless list. Put `before` in the table. Mark `new` only when `before = 0`.

Classify:

- **Critical** — `log.exception` is not null. Includes every database error. Never noise, even when `before > 0`.
- **Investigate** — other non-noise failure
- **Persisted** — same non-noise pattern in the before window; still listed
- **Deploy noise** — health/startup only in the first ~30m after `D`, then gone

### Step 3 — Useless noise (the only skip list)

Skip a pattern only when it is on this list. Everything else is reported.

Count skipped patterns in the noise table (after vs before). Do not promote them to Critical.

#### backoffice

`match_phrase` on `log.message`, plus the request path. Apply **only** when the service is backoffice.

- `is present in node ancestors`
- `Settings for table`
- `Site with id `
- `There is no site with specified`
- `There is no folder with specified id`
- `Invalid currencies are requested`
- `'From' header`
- `Failed to validate`
- `no table settings with specified`
- `not found in table order`
- `failed with code:400`
- `failed with code:206`
- `log.requestPath` = `/backoffice/hardDeletePartnerNodes`
- also still useless: `Some sites are not found`, `Requested sites not found`, `Table settings not found`, `Table node settings not found`, `Partner table settings`

#### partners

- `Site with id` + `not found`
- `failed with code:601`
- `Payment metadata contains invalid bet names`
- `changeScreenName`
- `Unable to find requested partner site`
- `getSiteInfo`

#### playerstats

- `Game snapshot not found`
- `must be convertible to Mongo ObjectId`

#### adapters

- `Unknown integration id`
- `RandomHeaderValue`
- `Can not find site`
- `Got 504` (partner timeout during the suite)
- `CreateSession returned`

#### all services — request validation

Skip on every service. These are the API rejecting a bad body or header (suite input), not a failed write.

`match_phrase` on `log.message`:

- `Failed to validate`
- `validation error`
- `One or more validation errors`
- `Request validation`
- `is not valid`
- `must not be empty`
- `ISO 4217`
- `RandomHeaderValue`
- `failed with code:400`

Count them in the noise table. If a validation pattern has **before = 0**, add one line in the verdict (“new validation”). A new reject rule can mean a real client broke. Do not put it in the critical table.

Do **not** treat database errors as validation. A log with `log.exception` set is not validation.

#### all services — other useless

- `Unauthorized`
- `Health check` / `/health/startup`

Full query bodies: [filters-reference.md](filters-reference.md).

## Expected output

One report. Raw totals are overview. The primary table is non-noise ERROR per service, including rows that existed before deploy.

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

### 2. Useless noise (skipped)

| Service | Pattern | After | Before | Delta | Class |
|---------|---------|------:|-------:|-------|-------|
| backoffice | `is present in node ancestors` | … | … | … | useless |
| … | … | … | … | … | … |

### 3. Non-noise ERROR (kept even when before > 0)

| Service | Pattern / example | After | Before | Class |
|---------|-------------------|------:|-------:|-------|
| slots-adapter | `varchar(36)` on `external_transaction_id` | 36 | 0 | Critical |
| playerstats | `Fail to call Redis` | 288 | 31 | Critical |
| … | … | … | … | … |

### 4. Verdict
- …
```

**Delta column:** prefer `−N%` / `+N%` / `flat` / `new` / `gone`. Note if window lengths differ materially.

**Verdict:** 3–6 bullets. Lead with Critical rows. Say when a hit is persisted from before deploy. A count of 1–2 still matters.

## Tips

- Walk services one by one. A small raw total can still hide logs with `log.exception` set.
- `Fail to call Redis` / health Unhealthy clustered in the first ~30m after deploy → label **deploy burst** if counts drop to 0 afterward. Still list it when `log.exception` is set.
- partners `invalid bet names` and `changeScreenName` are useless suite noise.
- If OpenSearch times out: one service, shorter range, `match_phrase` counts, then sample.

## Additional resources

- [filters-reference.md](filters-reference.md) — query bodies, noise list, slice examples
