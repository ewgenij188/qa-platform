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

## Rules

- Prefer `search_documents` with `size: 0` + aggs, or `general_api_request`
  `_count`, over large `terms` on `log.message.keyword` (MCP read timeout ~10s).
- Scope by `app.kubernetes.io/name` + namespace + level + time before sampling messages.
- For release/regression comparison, load the `analyze-release-logs` skill instead.
