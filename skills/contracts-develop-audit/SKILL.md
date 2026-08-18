---
name: contracts-develop-audit
description: >-
  Audits CORE OpenAPI contracts against each service origin/develop for the latest
  API version. Walks every contract endpoint; compares request and response; walks
  C# base classes. Property-set diff first, then nullable/required/casing. Use when
  the user asks to check contracts vs services, validate OpenAPI against develop, or
  audit contract drift.
---

# Contracts vs develop audit

## Purpose

Compare **contracts OpenAPI** (published `origin/master` or a named fix branch/ref) to each CORE service **`origin/develop`**, for the **latest API version only**.

**Truth:** service develop C# (ApiResources / Features / handlers / `Bang.Common.Messages`).
**Audit target:** contracts OpenAPI under `api-docs/`.

## Hard rules

- **Ignore hydra** — no develop pair.
- **Every endpoint in scope must be audited.** No “high-signal only” pass as a substitute for full coverage.
- **Request AND response** — for each operation, diff **both** `requestBody` (when present) and success response (`200` / default). Skipping request because response was OK is forbidden.
- **Base classes** — collect **all** JSON-relevant properties from the develop type **and every base class** in its inheritance chain; diff that full set against the contract schema.
- **Property-set diff FIRST.** Never classify a field as “nullability only” until the key exists in both OpenAPI and develop wire types.
  - **MISSING** = develop/base has JSON key, OpenAPI does not → **Mismatch**.
  - **Nullability** = key in both, `?` / `required[]` differs → **Mostly OK** or **Mismatch**.
- **Fix on one schema ⇒ check all schemas for that C# type family** — e.g. `maxExpoTemplateId` on `PartnerSiteResponse` must also appear on `UpdatePartnerSiteRequest` / `CreatePartnerSiteRequest` (`PartnerSiteRequest` base).
- **Fixed baseline per run.** State `contracts @ <ref>`. Do not mix baselines.
- **Uncommitted / stashed local edits:** exclude unless user says they are applied.
- **C# `= default!` / `= null!`:** NRT suppressors, not OpenAPI defaults.
- **Git:** never commit/push without explicit approval in the same user message.
- **Every table row must be explicit.** No “see prior table” or grouped shorthand.
- **Verify every row** against OpenAPI fragment + develop type before reporting.

## Scope

| Service | Latest API | Develop truth |
|---|---|---|
| partners | v9 | ApiResources + handlers |
| playerstats | v6 | Handlers / ApiResources |
| currency | v2 | ApiResources |
| preferences | v1 | Features (camelCase wire) |
| domains | v1 | ApiResources |
| topwins | v1 | Features/Responses |
| replays | v1 | Replays DTOs |
| slots-adapter | v1 | ApiResources (`JsonPropertyName`) |
| public-api-v1 | v1 | PublicApiV1 + Bang.Common.Messages |
| promo-balance-service | v1 | ApiResources |
| backoffice | v5 | ApiResources + shared `api-docs/backoffice/responses` and `requests/` |

Local clones: `/Users/<user>/repos/<service>`, contracts: `/Users/<user>/repos/contracts`.

## Mandatory algorithm (every run)

Detail and search recipes: [reference.md](reference.md#full-endpoint-algorithm).

### 0. Prep

1. GitLab MCP health (if GitLab-dependent); fail fast if unreachable.
2. `git fetch` contracts audit ref + each service `origin/develop`.

### 1. Inventory — all contract endpoints (latest API)

For each in-scope service, list **every operation** from latest OpenAPI (`vN/openapi.json` or equivalent):

```bash
# Example: list endpoint files for backoffice v5
git ls-tree -r --name-only <ref> -- api-docs/backoffice/v5/endpoints/
# or parse openapi.json paths / $ref to endpoints/
```

Build a checklist table (internal): `service | method | path | operationId | endpoint file`.

**Coverage gate:** audit is **incomplete** if any latest-API operation is not mapped to develop.

### 2. Map each contract endpoint → develop handler

For each row in the checklist:

1. Find controller/handler by `operationId`, route, or handler class name.
2. Resolve develop **request** type: handler `Request`, `[FromBody]` DTO, or ApiResources request.
3. Resolve develop **response** type: handler `.Response`, ApiResources return type, `IRequestBase<T>` second type param, etc.

If develop has no pair → **Skipped** (document why). Otherwise continue.

### 3. Resolve contract schemas

From the endpoint JSON:

- **Request:** `requestBody.content.application/json.schema` → follow `$ref` to `requests/*.json`.
- **Response:** `responses.200` (or documented success code) → follow `$ref` to `responses/*.json`.
- Follow **all** `$ref` / `#/definitions` until concrete `properties` (or array item schema).

No requestBody on GET/DELETE is normal — mark request **N/A**, still audit response.

### 4. Walk develop type + base classes

For each request/response C# type:

1. Start at the mapped type (e.g. `UpdatePartnerSite.Request`).
2. Walk **up** the inheritance chain (`PartnerSiteRequest` → `PartnerNodeRequest` → …) until `object`.
3. Union **all public instance properties** from each level (wire-relevant only; skip `[JsonIgnore]`).
4. That union is the develop property set for this operation’s request or response.

Also walk **nested** property types (objects, array items, `$ref` targets) recursively.

### 5. Compare (each operation × request/response)

For each side (request / response):

1. **Property set** — `develop_props − oa_props` → MISSING; `oa_props − develop_props` → extra.
2. **Wire name** — wrong JSON key for same shape.
3. **Nullability** — only on intersection.
4. **Required[]** — soft gaps → Mostly OK.
5. **Casing** — `JsonPropertyName` / camelCase policy.

### 6. Cross-file type families (after per-endpoint pass)

For each C# type used on multiple operations or fragments:

```bash
rg -l 'maxExpoTemplateId' api-docs/backoffice/
rg -l 'BetSettingsResponse|betName' api-docs/backoffice/
```

Every contracts file that serializes that type (or a derived type’s shared base) must carry the same property set for base-class fields. **Fixing GET response alone is not enough.**

### 7. Report

Header must include **endpoint coverage**: `audited N / N operations` per service (or list skipped).

## Comparison order (always)

1. Property set (including base-class props)
2. Wire name
3. Nullability
4. Required[]
5. Casing

## Issue classification

| Issue | When | Severity |
|---|---|---|
| **MISSING** | develop/base has JSON key, OpenAPI does not | **Mismatch** |
| **extra in contracts** | OpenAPI has key, develop does not | **Mismatch** |
| **wire name** | wrong key for same shape | **Mismatch** |
| **nullability** | key in both, `?` differs | **Mismatch** if develop nullable + contracts non-null; else **Mostly OK** |
| **required[]** | develop required, OpenAPI optional | **Mostly OK** |

## Output format

### Header (required)

```
Contracts: <ref>   Truth: origin/develop   Local/stash: excluded|included
Method: full endpoint walk (request + response + base classes)
Coverage: <service>: audited X/X endpoints (list skipped if any)
```

### Summary

| Service | Latest API | Endpoints | Status |
|---|---|---|---|

### Mismatch / Mostly OK tables

| Service | Endpoint | Side | Field | Issue | Contracts @ref | Develop |
|---|---|---|---|---|---|---|

**Side** = `request` | `response` | `fragment` (for cross-file base-type checks).

One row per field. Omit OK services from detail tables.

## When applying fixes

1. Sync contracts `master`, branch `feature/<slug>`.
2. When adding a field to one schema, run step 6 — find **all** contract files for that C# type family.
3. Summarize files + suggested commit message; **stop** until explicit commit/push approval.

## Additional resources

- Algorithm detail, base-class examples, search commands: [reference.md](reference.md)
