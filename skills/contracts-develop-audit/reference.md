# Contracts vs develop — comparison reference

## Full endpoint algorithm

This expands the mandatory steps in [SKILL.md](SKILL.md). **No request or response may be skipped** if the contract documents it.

### A. Inventory all operations

```bash
cd ~/repos/contracts
REF=<audit-ref>   # commit, branch, or HEAD for local working tree

SERVICE=backoffice
VER=v5

# All endpoint stubs for latest API
git ls-tree -r --name-only $REF -- api-docs/$SERVICE/$VER/endpoints/

# Or from openapi root
git show $REF:api-docs/$SERVICE/$VER/openapi.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
for p,v in sorted(d.get('paths',{}).items()):
  for m,op in v.items():
    if m in ('get','post','put','patch','delete'):
      print(m.upper(), p, op.get('operationId',''))
"
```

Repeat per service at its latest API version. That list is the **audit checklist** — every row must be processed or marked Skipped with reason.

### B. Map operation → develop

```bash
cd ~/repos/backoffice   # matching service clone
git fetch origin develop

OP=UpdatePartnerSite
rg "$OP" src/ -g '*.cs' --glob '*Controller*' --glob '*Handler*'
```

Typical mappings:

| Contracts | Develop |
|---|---|
| `operationId: UpdatePartnerSite` | `UpdatePartnerSite.Request` + handler return (`Nothing`, `Unit`, or response type) |
| `operationId: GetPartnerSite` | `PartnerSiteResponse` or handler `.Response` |
| ApiResources-only services | Type in `*ApiResources*` matching handler return / body |

Read the handler file — do not guess type names from operationId alone.

### C. Resolve request AND response schemas

From `api-docs/.../endpoints/<Op>.json`:

**Response (always for success):**

```json
"responses": { "200": { "content": { "application/json": { "schema": { "$ref": "..." } } } } }
```

**Request (when present):**

```json
"requestBody": { "content": { "application/json": { "schema": { "$ref": "../requests/UpdatePartnerSiteRequest.json" } } } }
```

Follow every `$ref` to a leaf schema with `properties` (or array `items`).

```bash
git show $REF:api-docs/backoffice/requests/UpdatePartnerSiteRequest.json \
  | python3 -c "import json,sys; print(sorted(json.load(sys.stdin).get('properties',{}).keys()))"
```

### D. Walk base classes

Develop request/response types often inherit shared bases. **All base properties are wire properties** unless `[JsonIgnore]`.

Example — backoffice partner site:

```
UpdatePartnerSite.Request
  └─ PartnerSiteRequest<TResponse>
       └─ PartnerNodeRequest<...>
            └─ …
GetPartnerSite → PartnerSiteResponse
  └─ PartnerNodeResponse / …
```

```bash
cd ~/repos/backoffice
rg 'class PartnerSiteRequest|record PartnerSiteRequest' src/ -g '*.cs'
rg 'MaxExpoTemplateId' src/ -g '*PartnerSite*'
```

**Algorithm:**

1. Read mapped type file (e.g. `PartnerSiteRequest.cs`).
2. List properties on that type.
3. If ` : BaseType`, repeat for `BaseType` until no base.
4. Union all property names → camelCase wire names.
5. Diff union against **this operation’s** contract request or response schema.

**Cross-operation rule:** if `MaxExpoTemplateId` is on `PartnerSiteRequest`, it must appear on **every** contracts request schema whose develop type inherits `PartnerSiteRequest` (`CreatePartnerSiteRequest.json`, `UpdatePartnerSiteRequest.json`, …). Same for response-side bases on `PartnerSiteResponse` / `GetPartnerSiteResponse.json`.

```bash
# Find every contracts file that should carry a base-class field
rg -l 'maxExpoTemplateId' api-docs/backoffice/
# Expect: GetPartnerSiteResponse.json, CreatePartnerSiteRequest.json, UpdatePartnerSiteRequest.json
```

### E. Per-endpoint checklist (copy per operation)

```
[ ] Contract endpoint file located
[ ] Develop handler/controller located
[ ] Request schema resolved (or N/A)
[ ] Response schema resolved
[ ] Develop request type + base chain walked
[ ] Develop response type + base chain walked
[ ] Property-set diff request (if any)
[ ] Property-set diff response
[ ] Nested objects / array items recursed
[ ] Nullability / required / casing on intersection only
```

### F. Embedded / shared fragments (in addition to endpoints)

Some schemas are reused outside a single endpoint (`DefaultLimitsResponse`, inline `#/definitions/BetSettingsResponse`). After the endpoint pass:

```bash
rg -l 'BetSettingsResponse|betName' api-docs/backoffice/
```

Diff each file against the develop type it embeds — same rules as endpoints.

---

## Finding contract files (layout discovery)

Paths change between refactors — discover at audit time.

```bash
ls api-docs/partners/          # pick highest vN
git ls-tree -r --name-only $REF -- api-docs/partners/v9/responses/
git ls-tree -r --name-only $REF -- api-docs/partners/v9/requests/
rg -l 'GetSession' api-docs/partners/ --glob '*.json'
```

Read at ref: `git show $REF:path` or working tree for local branch audits.

---

## Property-set diff first

```
develop_props = props(mapped_type) ∪ props(each_base) ∪ props(nested_types)
oa_props      = keys after $ref resolution

develop_props − oa_props  → MISSING (Mismatch)
oa_props − develop_props  → extra (usually Mismatch)
then nullability / required / casing on intersection only
```

### maxCap example

`LimitSettingsResponse.MaxCap` absent from `DefaultLimitsResponse.json` → **MISSING**, not nullability.

### maxExpoTemplateId example (request/response + base)

| Develop | Contracts files that must include `maxExpoTemplateId` |
|---|---|
| `PartnerSiteResponse.MaxExpoTemplateId` | `GetPartnerSiteResponse.json` |
| `PartnerSiteRequest.MaxExpoTemplateId` | `CreatePartnerSiteRequest.json`, `UpdatePartnerSiteRequest.json` |

Fixing only the GET response **misses** create/update — this is why base-class + all-schema search is mandatory.

---

## Type-family checklist (backoffice)

When auditing partner site or limits, search **requests and responses**:

| Develop type | Search in contracts |
|---|---|
| `PartnerSiteResponse` | `GetPartnerSiteResponse.json`, related response fragments |
| `PartnerSiteRequest` | `CreatePartnerSiteRequest.json`, `UpdatePartnerSiteRequest.json` |
| `LimitSettingsResponse` | `DefaultLimitsResponse.json` |
| `BetSettingsResponse` | `DefaultLimitsResponse`, `TableSettingsItemResponse`, `ActiveTablesWithLimitsResponse`, … |

---

## Pitfall catalog (extra scrutiny, not a skip list)

These endpoints are easy to mis-map — still **must** go through the full algorithm:

| Area | Why |
|---|---|
| partners `GameTransactions` | Wrong `TransactionInfoResponse` namespace |
| partners `FullSearchPlayers` | `PagingResponse<T>` + item type |
| partners `GetMasterSessionsInfo` | wire name `data` vs `masterSessions` |
| partners nested `promoBalance` | on GetSession, not only promo-balance-service tree |
| playerstats last-results | array item schemas in shared JSON files |
| public-api-v1 | envelope vs item fields |

---

## Nullability

| Develop | Contracts |
|---|---|
| `string?`, `T?` | `type: [T, "null"]` or `anyOf: [{$ref}, {type: null}]` |
| non-null value type | non-null; usually in `required[]` |

Bare `$ref` to non-null shared schema: wrap with `anyOf` + null at call site.

## Required vs default

- OpenAPI `required[]` = must appear in payload.
- C# non-nullable without initializer ≈ required.
- `= default!` ≈ required at runtime (NRT), not an OpenAPI default.

## Casing

1. `[JsonPropertyName("X")]` → wire `X`
2. Else camelCase policy → OpenAPI camelCase
3. slots-adapter: PascalCase wire names

## Cross-service nested types

`SessionResponse.PromoBalance` must appear on partners `GetSession.json` even if `promo-balance-service` has its own tree.

## public-api-v1

- Envelope: `PartnerApiResponse` → `data` + `error`
- Items: `PartnerInteractionResponseMessage` from Bang.Common.Messages

## Output anti-patterns (never)

| Bad | Good |
|---|---|
| `see prior table` | `PUT /v5/updatePartnerSite` · `request` · `maxExpoTemplateId` |
| audited “high-signal only” | `Coverage: backoffice 45/45 endpoints` |
| fixed GET only | also `UpdatePartnerSiteRequest`, `CreatePartnerSiteRequest` |

Audit deliverables must be self-contained and show endpoint coverage counts.
