---
name: analyze-core-logs
description: Analyzes CORE ERROR logs in OpenSearch (win-dev-core-*) for services within the current test scope. Collects a UTC time range, identifies ERROR patterns, extends the analysis window to 3× the original range, and compares ERRORs between the original and extended periods. Reports new, missing, and recurring error patterns, including noise/FP pattern count differences. Use for post-feature testing analysis, regression-to-regression ERROR comparison, and detecting new ERROR patterns after deployment.
---

# Analyze CORE logs

## Goal

Find **new** ERROR patterns after testing (before count = 0) and report **noise/FP** pattern count changes between two time range extends the analysis window to 3× the original range, and compares ERRORs between the original and extended periods

## Required inputs (ask before querying)

Do **not** run OpenSearch until the time range is confirmed (infer from context when possible):

- **Time range** — e.g. `now-1h`, `2026-07-24T12:00Z–13:00Z`, `за последние * минут`. If the user did not specify a time range in the request, use the `question` tool to ask:
  > За какой временной диапазон смотреть логи?
  
  Options: `15m`, `30m`, `1h`, `2h`, `3h`, `4h`, `6h`

- **Service** — which CORE service to search. If the user did not specify a service in the request, use the `question` tool to ask after the time range is confirmed:
  > По какому сервису искать логи?
  
  Options: `all`, `partners`, `public-api-v1`, `playerstats`, `slots-adapter`, `wagercraft-adapter`, `hub88`, `softswiss`, `parimatch`, `currency`, `topwins`, `promo-balance-service`, `domains`, `replays`

## Index and environment

Default every log search to CORE (Bang) services in the `win-dev-core-*` index
family. Do **not** search per-game or Java helper indices unless the user
explicitly names them.

- Dev index: `win-dev-core-*`
- Prod index: `win-prod-core-*`
- Feature index: `win-feature-core-*`

## Resolve the latest index (never hardcode)

```http
GET /_cat/indices/win-dev-core-*?v&s=index:desc&h=index,docs.count
```

Use the newest index in queries.

## Field mapping

| Concept | Field |
|---|---|
| Service name | `kubernetes.pod_labels.app.kubernetes.io/name.keyword` (`partners`, `backoffice`, `public-api-v1`, `playerstats`, `slots-adapter`, `domains`, `replays`, …) |
| Namespace | `kubernetes.pod_namespace.keyword` (`release`, `preprod`, `core-qa`, `latest`) |
| Level | `log.level.keyword` (`ERROR`, `WARN`, `INFO`) |
| Message | `log.message` / `log.message.keyword` |
| Timestamp | `timestamp` (ISO date, NOT `@timestamp`) |
| Logger | `log.logger.keyword` (prefix `Bang.*`, e.g. `Bang.Partners.Services.DomainsService`) |
| Structured fields | `log.EventName`, `log.EventId`, `log.template`, `log.serviceName`, `log.domain`, `traceId`, `spanId` |

## Naming trap — partners vs qa-partner

| Service | Stack | Index | Logger |
|---|---|---|---|
| `partners` (CORE) | .NET / `Bang.Partners` | `win-dev-core-*` | `Bang.*` |
| `qa-partner` (helper) | Java / Micronaut | `win-dev-qa-partner-*` | `live.winfinity.at.*` |

`*partner*` matches the Java `win-dev-qa-partner-*` index, NOT the CORE
`partners` service. For CORE `partners`, query `win-dev-core-*` with
`app.kubernetes.io/name: partners`.

## Query skeleton

```json
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term": { "kubernetes.pod_labels.app.kubernetes.io/name.keyword": "<service>" } },
        { "term": { "log.level.keyword": "ERROR" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

## Keyword field trap — `ignore_above: 256`

`log.message.keyword` is a `keyword` subfield with `ignore_above: 256`. Any
message longer than 256 characters is **not indexed** in the keyword field, so
a `terms` aggregation on `log.message.keyword` silently drops them. The
aggregation `doc_count_error_upper_bound` may still read `0` — this is NOT a
signal that the counts are complete.

Always reconcile totals. If `sum(buckets) < hits.total`, the remainder are long
messages (>256 chars). Count them explicitly and sample them:

```json
{
  "size": 3,
  "query": {
    "bool": {
      "must": [ /* service + namespace + level + time filters */ ],
      "must_not": [ { "exists": { "field": "log.message.keyword" } } ]
    }
  },
  "_source": ["log.message"]
}
```

Report the long-message group as its own row in the table (usually the same
logical error as a short pattern, but with the full JSON body appended).

## Reporting format (ALWAYS)

Every ERROR analysis must produce **two tables**:

1. **Full grouped table** — every error group, no truncation. Columns: group,
   count, %, patterns. The last row must reconcile to the total:
   `short patterns + long messages (>256) = hits.total`. Never hide the
   long-message remainder — show it as an explicit row.

2. **Noise table** — a separate table listing ONLY noise/FP patterns
   (site not found, unauthorized, screen-name validation, etc.) with their
   counts, so real issues and test noise are clearly separated. Tag each group
   as `noise`, `fp`, or `real`.

Do not cap the pattern list to a top-N that hides errors. Show all groups; if
there are hundreds of single-occurrence patterns, aggregate them into a
summary row (e.g. "Not found (other) — N patterns × 1") but still list the
top offenders explicitly.

## Rules

- Prefer `search_documents` with `size: 0` + aggs, or `general_api_request`
  `_count`, over large `terms` on `log.message.keyword` (MCP read timeout ~10s).
- Scope by `app.kubernetes.io/name` + namespace + level + time before sampling messages.
- For release/regression comparison, load the `analyze-release-logs` skill instead.
