# OpenSearch filters reference — analyze-release-logs

Scope queries to **release services only**. Replace `<app>` per service. Windows are **regression-after** and **regression-before** (discovered from ERROR spikes — see SKILL.md), not `D` vs `D−1 day`.

## Resolve index

```http
GET /_cat/indices/win-dev-core-*?v&s=index:desc&h=index,docs.count
```

Use the latest `win-dev-core-*` name in paths below.

## Base query skeleton

```json
{
  "size": 0,
  "timeout": "55s",
  "track_total_hits": true,
  "query": {
    "bool": {
      "must": [
        { "term": { "kubernetes.pod_namespace.keyword": "<release|preprod>" } },
        { "term": { "kubernetes.pod_labels.app.kubernetes.io/name.keyword": "<app>" } },
        { "match": { "log.level": "ERROR" } },
        { "range": { "timestamp": { "gte": "<ISO_START>", "lt": "<ISO_END>" } } },
        { "wildcard": { "log.message.keyword": "<PATTERN>" } }
      ],
      "must_not": []
    }
  }
}
```

Use `search_documents` (direct OpenSearch MCP) or `opensearch_search_documents` (wnf-developer), whichever is configured, with the body above. For noise rows, omit tier-1 `must_not` so FP@ patterns are counted. For **new-pattern hunting**, apply heavy `must_not` (tier-1 + tier-2 + noise list).

## Spike discovery (window finder)

Hourly overview:

```json
{
  "size": 0,
  "timeout": "55s",
  "query": {
    "bool": {
      "must": [
        { "term": { "kubernetes.pod_namespace.keyword": "<ns>" } },
        { "match": { "log.level": "ERROR" } },
        { "range": { "timestamp": { "gte": "<D-36h>", "lt": "<D+12h>" } } }
      ]
    }
  },
  "aggs": {
    "by_hour": {
      "date_histogram": {
        "field": "timestamp",
        "calendar_interval": "1h",
        "time_zone": "UTC",
        "min_doc_count": 0
      },
      "aggs": {
        "by_app": {
          "terms": {
            "field": "kubernetes.pod_labels.app.kubernetes.io/name.keyword",
            "size": 15
          }
        }
      }
    }
  }
}
```

15m multi-service **signal** (refine edges):

```json
{
  "size": 0,
  "timeout": "55s",
  "query": {
    "bool": {
      "must": [
        { "term": { "kubernetes.pod_namespace.keyword": "<ns>" } },
        { "match": { "log.level": "ERROR" } },
        { "range": { "timestamp": { "gte": "<day_start>", "lt": "<day_end>" } } }
      ]
    }
  },
  "aggs": {
    "by_15m": {
      "date_histogram": {
        "field": "timestamp",
        "fixed_interval": "15m",
        "time_zone": "UTC",
        "min_doc_count": 0
      },
      "aggs": {
        "signal": {
          "filter": {
            "terms": {
              "kubernetes.pod_labels.app.kubernetes.io/name.keyword": [
                "partners",
                "public-api-v1",
                "playerstats",
                "slots-adapter",
                "wagercraft-adapter",
                "hub88",
                "softswiss",
                "parimatch",
                "currency",
                "topwins",
                "promo-balance-service",
                "domains"
              ]
            }
          }
        }
      }
    }
  }
}
```

Quiet baseline: low `signal.doc_count`. Regression window: sustained elevated `signal` (and usually elevated total), then return toward baseline.

## OS tier-1 `must_not` (when hunting non-noise / new)

### All apps

```json
{ "wildcard": { "log.message.keyword": "*Unauthorized*" } },
{ "match_phrase": { "log.message": "Failed to validate" } },
{ "match_phrase": { "log.message": "validation error" } },
{ "match_phrase": { "log.message": "One or more validation errors" } },
{ "match_phrase": { "log.message": "Request validation" } },
{ "match_phrase": { "log.message": "is not valid" } },
{ "match_phrase": { "log.message": "must not be empty" } },
{ "match_phrase": { "log.message": "ISO 4217" } },
{ "match_phrase": { "log.message": "RandomHeaderValue" } },
{ "match_phrase": { "log.message": "failed with code:400" } },
{ "wildcard": { "log.message.keyword": "*Site with id*not found*" } },
{ "wildcard": { "log.message.keyword": "*siteId*not found*" } }
```

### partners, public-api-v1 (add)

```json
{ "match_phrase": { "log.message": "failed with code:601" } },
{ "terms": { "log.requestPath.keyword": ["/v9/rollbackCorrection", "/getSiteInfo", "/v5/rollbackCorrection"] } }
```

### public-api-v1 only (add)

```json
{ "term": { "log.logger.keyword": "Bang.PublicApiV1.Handlers.ExecutePartnersSingleRequest" } }
```

### Extra strips for new-pattern sampling

```json
{ "wildcard": { "log.message.keyword": "*Deleted folders*is present in node ancestors*" } },
{ "wildcard": { "log.message.keyword": "*no table settings with specified id*" } },
{ "wildcard": { "log.message.keyword": "*Table * not found*" } },
{ "wildcard": { "log.message.keyword": "*Table settings not found*" } },
{ "wildcard": { "log.message.keyword": "*Table node settings not found*" } },
{ "wildcard": { "log.message.keyword": "*Partner table settings*" } },
{ "wildcard": { "log.message.keyword": "*Health check*" } },
{ "wildcard": { "log.message.keyword": "*Payment metadata contains invalid bet names*" } },
{ "wildcard": { "log.message.keyword": "*changeScreenName*" } },
{ "wildcard": { "log.message.keyword": "*Game snapshot not found*" } },
{ "wildcard": { "log.message.keyword": "*Unknown integration id*" } },
{ "wildcard": { "log.message.keyword": "*RandomHeaderValue*" } },
{ "wildcard": { "log.message.keyword": "*Can not find site*" } },
{ "wildcard": { "log.message.keyword": "*must be convertible to Mongo ObjectId*" } }
```

## Post-filter / noise wildcards (tier 2 — count in noise table)

| Pattern | Typical source |
|---------|----------------|
| `*must be convertible to Mongo ObjectId*` | Invalid ObjectId in QA |
| `Site [^ ]+ not found` (regexp) | Site missing |
| `*Requested sites not found*` | attach / binder |
| `*no site with specified id*` | getPartnerSite |
| `*siteIds*not found*` / `*SiteIds*not found*` | Multi-site ops |
| `*Some sites are not found*` | activator |
| `*Can not find site with id*` / `*Can not find site *` | missing site |
| `*SiteIds*must not be empty*` | validation |
| `*no table settings with specified id*` | getTable polling |
| `*Partner table settings for site*not found*` | partner tables |
| `*lobbyTables*500*` | lobby 500s |
| `*Table * not found*` | tableSiteLimits/Settings |
| `*Table settings not found*` | folder table settings |
| `*Table node settings not found*` | node settings |
| `*Deleted folders*is present in node ancestors*` | folder tree noise |
| `*Health check*` / `/health/startup` | deploy / liveness |

## Noise checklist (count both windows)

### backoffice

Useless (skip from findings; still count in the noise table). `match_phrase`:

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
- request path `/backoffice/hardDeletePartnerNodes`
- `Some sites are not found`
- `Requested sites not found`
- `Table settings not found`
- `Table node settings not found`
- `Partner table settings`

### partners

- `*Site with id*not found*`
- `failed with code:601` (`match_phrase`)
- `*Payment metadata contains invalid bet names*`
- `*changeScreenName*`
- `*Unable to find requested partner site*`
- `*Table * not found*`

### playerstats

- `*Game snapshot not found*`
- `*must be convertible to Mongo ObjectId*`

### adapters / other

- `*Unknown integration id*`
- `*Got 504*` (slots partner timeouts — often persisted suite)
- `*CreateSession returned*`
- `*Health check*`

## Per-service pass

For each release service, query that service alone. Strip only that service’s useless `must_not`. Sample the remainder. Then count critical exceptions (never stripped): logs where `log.exception` is not null.

```json
{ "exists": { "field": "log.exception" } }
```

Count every non-noise candidate in **after** and **before**. Keep the row when after > 0. `before > 0` stays in the table as Persisted or Critical. `new` only when before = 0.

If all hits fall in the first ~30m after deploy `D` and then stop → note **deploy burst**, and still list the row.

## Backoffice useless `must_not`

Apply only with `app.kubernetes.io/name` = `backoffice`. `match_phrase`, not a leading wildcard.

```json
{ "match_phrase": { "log.message": "is present in node ancestors" } },
{ "match_phrase": { "log.message": "Settings for table" } },
{ "match_phrase": { "log.message": "Site with id " } },
{ "match_phrase": { "log.message": "There is no site with specified" } },
{ "match_phrase": { "log.message": "There is no folder with specified id" } },
{ "match_phrase": { "log.message": "Invalid currencies are requested" } },
{ "match_phrase": { "log.message": "'From' header" } },
{ "match_phrase": { "log.message": "Failed to validate" } },
{ "match_phrase": { "log.message": "no table settings with specified" } },
{ "match_phrase": { "log.message": "not found in table order" } },
{ "match_phrase": { "log.message": "failed with code:400" } },
{ "match_phrase": { "log.message": "failed with code:206" } },
{ "term": { "log.requestPath.keyword": "/backoffice/hardDeletePartnerNodes" } },
{ "match_phrase": { "log.message": "Some sites are not found" } },
{ "match_phrase": { "log.message": "Requested sites not found" } },
{ "match_phrase": { "log.message": "Table settings not found" } },
{ "match_phrase": { "log.message": "Table node settings not found" } },
{ "match_phrase": { "log.message": "Partner table settings" } }
```

Request validation above applies to every service. `failed with code:206` stays backoffice-only.

Database errors are not request validation. Never strip a database error, and never strip a log where `log.exception` is not null.

If a validation pattern has before = 0, mention it once in the verdict as new validation. Leave it out of the critical table.

## Slice example (timeouts)

Split long windows into 1h or 2h ranges and sum counts.

```json
"range": { "timestamp": { "gte": "2026-07-24T13:45:00Z", "lt": "2026-07-24T14:45:00Z" } }
```

## Class labels

| Label | When |
|-------|------|
| FP / noise | Tier-2 / known polling / site-not-found |
| Business | Known business codes (601, 605, 606, 608, 702, …) |
| QA | Suite fingerprints, RandomHeaderValue, empty required fields |
| Deploy noise | Health/startup clustered at rollout |
| Critical | `log.exception` is not null, including every database error. Always listed, even when before > 0 |
| Investigate | Other non-noise failure |
| Persisted | Same non-noise pattern in the before window; still listed |
