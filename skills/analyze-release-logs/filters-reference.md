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

Prefer `search_documents` with the body above. For noise rows, omit tier-1 `must_not` so FP patterns are counted. For **new-pattern hunting**, apply heavy `must_not` (tier-1 + tier-2 + noise list).

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
                "domains",
                "replays"
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
{ "wildcard": { "log.message.keyword": "*Failed to validate request*" } },
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
{ "wildcard": { "log.message.keyword": "*must be convertible to Mongo ObjectId*" } },
{ "wildcard": { "log.message.keyword": "*User replay not found for gameId*" } },
{ "wildcard": { "log.message.keyword": "*Failed to get expiration info by*" } }
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
| `*User replay not found for gameId*` | QA/dev — replay crashed/dropped |
| `*Failed to get expiration info by*` | QA/dev — video not recorded / test-generated |
| `*Health check*` / `/health/startup` | deploy / liveness |

## Noise checklist (count both windows)

### backoffice

- `*Deleted folders*is present in node ancestors*`
- `*no table settings with specified id*`
- `*Table * not found*`
- `*Table node settings not found*`
- `*Partner table settings for site*not found*`
- `*no site with specified id*`
- `*Some sites are not found*`
- `*Requested sites not found*`

### partners

- `*Site with id*not found*`
- `failed with code:601` (`match_phrase`)
- `*Payment metadata contains invalid bet names*`
- `*changeScreenName*`
- `*Unable to find requested partner site*`
- `*Table * not found*`

### playerstats

- `*Failed to validate request*`
- `*Game snapshot not found*`
- `*must be convertible to Mongo ObjectId*`

### adapters / other

- `*Unknown integration id*`
- `*Got 504*` (slots partner timeouts — often persisted suite)
- `*CreateSession returned*`
- `*Health check*`

### replays

- `*User replay not found for gameId*` (QA/dev — replay crashed/dropped)
- `*Failed to get expiration info by*` (QA/dev — video not recorded / test-generated)

## New-pattern verify

For each candidate message from after-window samples:

1. Build a stable `wildcard` or `match_phrase` (strip volatile IDs when needed).
2. Count in **after** and **before** windows.
3. Keep if **before = 0** and after > 0.
4. If all hits fall in the first ~30m after deploy `D` and then stop → note **deploy burst**.

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
| Investigate | New non-noise pattern; possible regression |
| Persisted | Present in both regression windows |
