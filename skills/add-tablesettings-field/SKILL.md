---
name: add-tablesettings-field
description: Adds a new field to the Bang.BackOffice TableSettings / PartnerSite system across the model, requests, responses (v4 tableGameSettings / redefinedTableSettings, v5 tableSettings / tableSiteSettings), AutoMapper profiles, Mongo update writers, comparers, and the Kafka/Avro messages (TableSettingsMessage, SiteTableSettingsMessage, TableSiteSettingsMessage). Use when the user asks to add a table-scoped setting, a site-scoped override (e.g. ReplaysEnabled / ReplaysEnabledOnSite), a new TableSettings property, a new PartnerSite property, or mentions UpdateCommonFields, TableSettingsComparer, ExtensionData Fields constants, or editing the generated Avro contracts (in both Bang.BackOffice and the sibling avro-schemas repository).
disable-model-invocation: true
---

# Add a field to TableSettings / PartnerSite (Bang.BackOffice)

Repo: Bang.BackOffice (ask the user for the local path if not known). Solution: `src\Bang.BackOffice.sln`.
Sibling repo: **avro-schemas** — usually lives in the **same parent folder as Bang.BackOffice**
(e.g. `..\avro-schemas` relative to the BackOffice repo). Ask the user for its path if not adjacent.
Stack: **.NET 8 / C# / MongoDB** (no EF, no frontend). Persistence via MongoDB driver + `BsonClassMap`
(`AutoMap` + `IgnoreExtraElements`). Messaging via Kafka with **hand-maintained generated Avro contracts**
in Bang.BackOffice, plus **canonical `.avsc` schemas** in the sibling avro-schemas repository that must be
kept in sync.

## Golden rule: mirror a reference field

Do **not** reason field-by-field from scratch. Pick an existing field that already flows to the exact
same destinations, then `grep` it repo-wide and mirror **every** hit. This is the single most reliable
way to avoid missing a layer.

- **Site-scoped bool from PartnerSite → redefined/tableSite reads + all 3 messages**: use
  **`IsBlackjackBetBehindEnabled`** (on the source side) / **`IsBlackjackBetBehindEnabledOnSite`**
  (on the site-read side). It is a complete precedent for `ReplaysEnabled` / `ReplaysEnabledOnSite`.
- **Table-scoped common field → v4/v5 responses + TableSettings/SiteTableSettings messages**: use a
  plain base field such as **`Stage`**.

Start every task with:

```
rg -n "IsBlackjackBetBehindEnabled" src        # site-scoped reference
rg -n "\bStage\b" src                          # table-scoped common reference
```

Every file a reference match appears in is a file you must edit for the new field (matching type/default).

## Decision gate — ask the user first (do not guess)

1. **Scope:** table-scoped (lives on `TableSettings`), site-scoped (lives on `PartnerSite` + surfaced
   per-site), or **both** (two separate fields, e.g. `ReplaysEnabled` on TableSettings **and**
   `ReplaysEnabled`/`ReplaysEnabledOnSite` on PartnerSite).
2. **Site override?** — **always ask explicitly**: "Should this table-scoped setting be overridable
   per-site (i.e. also add a `<Field>OnSite` on `PartnerSite` that flows into `SiteTableSettingsMessage`
   and `TableSiteSettingsMessage`)?" If yes, use the **`OnSite` suffix** for the site-read/override
   field (mirroring `IsBlackjackBetBehindEnabledOnSite`) and follow **both** Path A and Path B.
3. **Type & default:** confirm type and default. A `bool` defaulting to `false` needs **no Mongo
   migration** (`AutoMap` + `IgnoreExtraElements` + default handle absent docs). Only a required/enum
   field needing a backfill on existing documents needs a migration.
4. **Destinations:** confirm exactly which of these get the field (the user usually lists them):
   v4 `tableGameSettings`, v5 `tableSettings`, v4 `redefinedTableSettings`, v5 `tableSiteSettings`,
   `TableSettingsMessage`, `SiteTableSettingsMessage`, `TableSiteSettingsMessage`.
5. **avro-schemas repo:** confirm the path to the sibling **avro-schemas** repository (default:
   `..\avro-schemas`). The corresponding `.avsc` files there must be updated in the **same PR/branch**
   as the Bang.BackOffice generated contracts.
6. **Validation:** any FluentValidation rules?

## Gotchas (these cause silent, hard-to-find bugs)

- **Two write paths differ.** Create uses AutoMapper; **Update uses manual `.Set()`**. If you forget the
  Update writer, the field never persists on edits.
  - TableSettings update writer: `UpdateTableSettings.UpdateCommonFields` (common) / the per-game switch.
  - PartnerSite update writer: `PartnerNodeService.UpdateSite` `.Set(...)` chain (~line 310).
- **Comparer.** `TableSettingsComparer` short-circuits the update if `Equals` returns true. A table-scoped
  field must be added to **both** `Equals` and `GetHashCode`, or edits are silently skipped.
- **MessagePack `[Key(n)]`** must be unique and stable per response type. Use the **next free integer**
  (mind existing gaps); never renumber existing keys.
- **Intermediate DTO.** Site-scoped values reach the redefined/tableSite reads through
  `PartnerTableSettings` (`Services\Contracts\PartnerTableSettings.cs`), built in
  `PartnerTableSettingService.cs`. Easy to miss.
- **Cache asset.** The site read has a cache asset `CacheAssets.TableSiteSettingAsset` that mirrors the field.
- **Avro contracts are committed, hand-maintained generated files** in Bang.BackOffice (no codegen target),
  while the canonical `.avsc` schemas live in the **sibling `avro-schemas` repo** and must be updated in
  lockstep. See the Avro sub-procedure below — 5 edit points per contract + matching `.avsc` edits.

---

## Path A — Table-scoped field on `TableSettings` (common, all games)

Reference field: `Stage`. Ordered checklist:

| # | File | Edit |
|---|------|------|
| 1 | `src\Bang.BackOffice.DataAccess\Models\Tables\TableSettings.cs` | Add the property (e.g. `public bool ReplaysEnabled { get; set; }`). |
| 2 | `src\Bang.BackOffice\ApiResources\Requests\TableSettingsRequest.cs` | Add the request property (usually nullable, or bool for a defaulted flag). |
| 3 | `src\Bang.BackOffice\Mapping\TableSettingsMappingExtensions.cs` | Add `.ForMember(dest => dest.ReplaysEnabled, ...)` in `MapTableSettingsRequest` (Create path). |
| 4 | `src\Bang.BackOffice\Handlers\Tables\Crud\UpdateTableSettings.cs` → `UpdateCommonFields` | Add `.Set(s => s.ReplaysEnabled, entity.ReplaysEnabled)`. **Required.** |
| 5 | `src\Bang.BackOffice\Comparers\TableSettingsComparer.cs` | Add to the base block of `Equals` **and** to `GetHashCode`. |
| 6 | `src\Bang.BackOffice.ApiResources\Responses\Game\TableGameSettingsResponse.cs` | Add property + next free `[Key(n)]` (v4 `tableGameSettings`). |
| 7 | `src\Bang.BackOffice\Mapping\TableSettingsProfile.cs` (`TableSettings → TableGameSettingsResponse`, ~line 191) | Add `.ForMember(...)`. |
| 8 | `src\Bang.BackOffice.ApiResources\Responses\Table\TableSettingsResponse.cs` | Add property + next free `[Key(n)]` (v5 `tableSettings` CRUD). |
| 9 | `src\Bang.BackOffice\Mapping\TableSettingsProfile.cs` (`TableSettings → TableSettingsResponse`, ~line 28) | Add `.ForMember(...)`. |
| 10 | `src\Bang.BackOffice.ApiResources\Messages\TableSettingsMessage.cs` | Add typed property. |
| 11 | `src\Bang.BackOffice\Mapping\TableSettingsMessageProfile.cs` | Add `.ForMember(...)` in the base map (~line 12). |
| 12 | `src\Bang.BackOffice.ApiResources\Messages\SiteTableSettingsMessage.cs` | Add a `Fields` const (e.g. `public const string ReplaysEnabled = "replaysEnabled";`). |
| 13 | `src\Bang.BackOffice\Handlers\Tables\TableSettingsExtensions.cs` (`ToSiteTableSettingsMessage`) | Add `.AddFieldValue(Fields.ReplaysEnabled, src.ReplaysEnabled)`. |
| 14 | Avro (see sub-procedure) | `TableSettingsMessage` + `SiteTableSettingsMessage` contracts + their `AvroProfile.cs` maps. |
| 15 | Validation (optional) | `src\Bang.BackOffice\Validation\Tables\Crud\TableSettingsRequestValidator.cs` (+ Create/Update variants). |
| 16 | Migration (only if required/backfill) | `src\Bang.BackOffice.MongoMigrations\V1_6_22_Add<Field>TableSettings.cs` (bump above the current highest). |

Do **not** touch `src\Bang.BackOffice\Utils\MongoClassMap.cs` for a scalar (`AutoMap` covers it); only new
derived classes require a `RegisterClassMap` line.

For a **game-specific** table field (only one game): add to the derived model, add a `<Game>Fields` string
const in `TableSettingsRequest.cs`, read it via `request.GetFieldData<T>(...)` in the matching
`Construct<Game>TableSettings`, add it to the game `case` in `UpdateTableSettings`, the game `case` in the
comparer, and the `<Game>TableSettingsResponse` / `<Game>TableGameSettingsResponse` + per-game profile maps.

---

## Path B — Site-scoped field on `PartnerSite` (+ `...OnSite` reads)

Reference: `IsBlackjackBetBehindEnabled` (source) / `IsBlackjackBetBehindEnabledOnSite` (site reads).
For `ReplaysEnabled` on PartnerSite the site-read field is `ReplaysEnabledOnSite`. Ordered checklist:

**Source (PartnerSite) side:**

| # | File | Edit |
|---|------|------|
| 1 | `src\Bang.BackOffice.DataAccess\Models\PartnerSite.cs` | Add `public bool ReplaysEnabled { get; set; }`. |
| 2 | `src\Bang.BackOffice\ApiResources\Requests\PartnerNodes\PartnerSiteRequest.cs` | Add request property. |
| 3 | `src\Bang.BackOffice.ApiResources\Responses\PartnerNodes\PartnerSiteResponse.cs` | Add property + next free `[Key(n)]`. |
| 4 | `src\Bang.BackOffice\Mapping\PartnerMappingExtensions.cs` (`MapPartnerSiteRequest`) | Add `.ForMember(...)` (request → entity). |
| 5 | `src\Bang.BackOffice\Mapping\PartnerNodesProfile.cs` (`PartnerSite → PartnerSiteResponse`) | Add `.ForMember(...)` (entity → response). |
| 6 | `src\Bang.BackOffice\Services\PartnerNodeService.cs` `UpdateSite` `.Set(...)` chain | Add `.Set(a => a.ReplaysEnabled, site.ReplaysEnabled)`. **Required.** |
| 7 | `src\Bang.BackOffice\Extensions\PartnerSiteExtensions.cs` | Add a `ReplaysEnabledChanged` extension **and** include it in `AreIntegrationFieldsChanged`. |

**Bridge DTO + cache (carry site value into reads):**

| # | File | Edit |
|---|------|------|
| 8 | `src\Bang.BackOffice\Services\Contracts\PartnerTableSettings.cs` | Add `public bool ReplaysEnabled { get; init; }`. |
| 9 | `src\Bang.BackOffice\Services\PartnerTableSettingService.cs` | Map `ReplaysEnabled = partnerSite.ReplaysEnabled`. |
| 10 | `src\Bang.BackOffice\CacheAssets.cs` (`TableSiteSettingAsset`) | Add `public bool ReplaysEnabledOnSite { get; set; }`. |

**v4 redefinedTableSettings:**

| # | File | Edit |
|---|------|------|
| 11 | `src\Bang.BackOffice.ApiResources\Responses\RedefinedTableSettingsResponse.cs` | Add property + next free `[Key(n)]` (currently next = 14). |
| 12 | `src\Bang.BackOffice\Handlers\TableNodeSettings\RedefinedTableSettings\GetRedefinedTableSettings.cs` | Set `settingsResponse.ReplaysEnabled = partnerTableSettings.ReplaysEnabled;`. |
| 13 | `...\RedefinedTableSettings\BatchGetRedefinedTableSettings.cs` | Same assignment as #12. |

**v5 tableSiteSettings:**

| # | File | Edit |
|---|------|------|
| 14 | `src\Bang.BackOffice.ApiResources\Responses\GetTableSiteSettingsResponse.cs` (`TableSiteSetting`) | Add `public bool ReplaysEnabledOnSite { get; set; }` (plain JSON, **no `[Key]`**). |
| 15 | `src\Bang.BackOffice\Handlers\TableNodeSettings\GetTableSiteSettings.cs` | Set `ReplaysEnabledOnSite` at **all three** construction sites (from cache asset, from tableSiteSetting, and from `partnerTableSettings.ReplaysEnabled`). |

**Messages** (use the **`OnSite` suffix** on the site-override field, mirroring
`IsBlackjackBetBehindEnabledOnSite`):

| # | File | Edit |
|---|------|------|
| 16 | `src\Bang.BackOffice.ApiResources\Messages\SiteTableSettingsMessage.cs` | Add `Fields.ReplaysEnabledOnSite` const. |
| 17 | `src\Bang.BackOffice\Services\PartnerNodeService.cs` `CreateSiteTableSettingsMessage` (~line 584) | `if (existingSite.ReplaysEnabledChanged(site)) msg.AddFieldValue(Fields.ReplaysEnabledOnSite, site.ReplaysEnabled);` mirroring the reference. |
| 18 | `src\Bang.BackOffice.ApiResources\Messages\TableSiteSettingsMessage.cs` | Add `public bool? ReplaysEnabledOnSite { get; set; }` and populate it in `CreateAnySettingsChanged` (add param + assignment). |
| 19 | `src\Bang.BackOffice\Mapping\Extensions\PartnerNodeExtensions.cs` | Populate the new site-override field on the message wherever the reference field is populated. |
| 20 | Avro (see sub-procedure) | `SiteTableSettingsMessage`, `TableSiteSettingsMessage` contracts + `AvroProfile.cs` maps **and** the corresponding `.avsc` files in the sibling **avro-schemas** repo. |

Also check the other manual construction sites of `SiteTableSettingsMessage` /
`TableSiteSettingsMessage` surfaced by `rg` (e.g. `TablesCrudService`, `TablesActivator`,
`TableToSiteBinder`, `TableOnSiteActivator`, `HardDelete*`) and populate the new field wherever the
reference field is populated.

---

## Avro contracts sub-procedure (hand-maintained generated files + sibling schema repo)

There is **no `.avsc`/`.avdl` in Bang.BackOffice** and **no codegen target** — the schema lives as a
chunked string literal inside each generated `.cs` and the reader/writer use explicit `case N:` positions.
The canonical `.avsc` files live in a **separate sibling repository (`avro-schemas`)** and must be kept
in sync manually.

Add the field at the **next free field index** (append at the end; e.g. `TableSiteSettingsMessage`
next index = 18) and edit **all five** points in Bang.BackOffice, mirroring
`IsBlackjackBetBehindEnabledOnSite`:

Per contract file under `src\Bang.Backoffice.AvroContracts\Responses\`:

1. **`_SCHEMA` string** — append `,{"name":"ReplaysEnabledOnSite","default":null,"type":["null","boolean"]}`
   inside the `"fields":[ ... ]` array (respect the chunked `" +` line-split formatting).
2. **Backing field** — `private System.Nullable<System.Boolean> _ReplaysEnabledOnSite;`
3. **Property** — the `get`/`set` returning/assigning `_ReplaysEnabledOnSite`.
4. **`Get(int fieldPos)`** — new `case N: return this.ReplaysEnabledOnSite;` before `default:`.
5. **`Put(int fieldPos, ...)`** — new `case N: this.ReplaysEnabledOnSite = (System.Nullable<System.Boolean>)fieldValue; break;`.

Then add the mapping in `src\Bang.BackOffice\Mapping\AvroProfile.cs` (one `.ForMember(...)` per contract):
- `SiteTableSettingsMessage → AvroSiteTableSettingsMessage` (~line 19): `.MapFrom(s => Value(s, SiteTableSettingsMessage.Fields.ReplaysEnabledOnSite))`.
- `TableSettingsMessage → AvroTableSettingsMessage` (~line 610): map the typed property.
- `TableSiteSettingsMessage → AvroTableSiteSettingsMessage` (~line 658): map the typed property.

### avro-schemas repository (sibling repo — mandatory sync)

The canonical Avro schemas live in a separate repo, typically at `..\avro-schemas` relative to
Bang.BackOffice (ask the user if not adjacent). You must add the same field to each corresponding
`.avsc` under that repo (look for files whose names match the contracts above, e.g.
`TableSettingsMessage.avsc`, `SiteTableSettingsMessage.avsc`, `TableSiteSettingsMessage.avsc`).

Steps for each `.avsc`:
1. `rg -n "IsBlackjackBetBehindEnabledOnSite" .` inside the avro-schemas repo to locate the exact
   files and mirror the entry.
2. **Append** the field to the `"fields"` array in the same optional shape:
   `{"name":"ReplaysEnabledOnSite","default":null,"type":["null","boolean"]}`.
3. Keep field order identical to the Bang.BackOffice `_SCHEMA` string (append at the end — never
   reorder). The `.avsc` and the generated `_SCHEMA` must match field-for-field.
4. If the avro-schemas repo has its own versioning / changelog / build (e.g. schema-registry publish),
   bump/update it per that repo's conventions.

**Avro compatibility:** always add as optional (`["null","boolean"]` with `"default":null`) and **append**
the field — never insert in the middle or renumber existing indices (breaks wire compatibility with
consumers). If you touch `Bang.Backoffice.AvroContracts`, bump its `<Version>` and `<PackageReleaseNotes>`
in the `.csproj` (it publishes a NuGet on build). Ship the Bang.BackOffice change and the avro-schemas
change **together** to avoid a schema-registry / consumer drift.

---

## Tests to update

Mirror the reference field's assertions in these (find them via the same `rg`):

- `Bang.BackOffice.UnitTests\Handlers\Tables\Crud\CreateTableSettingsTests.cs`, `UpdateTableSettingsTests.cs`
- `Bang.BackOffice.UnitTests\Comparers\TableSettingsComparerTests.cs`
- `Bang.BackOffice.UnitTests\Mapping\TableSettingsMessageProfileTests.cs`, `AvroProfileTests.cs`
- `Bang.BackOffice.UnitTests\Services\PartnerNodeServiceTests.cs`
- `Bang.BackOffice.UnitTests\Handlers\PartnerNodes\Crud\CreatePartnerSiteTests.cs`, `UpdatePartnerSiteTests.cs`
- `Bang.BackOffice.UnitTests\Extensions\PartnerSiteExtensionsTests.cs`
- `Bang.BackOffice.UnitTests\Handlers\TableNodeSettings\RedefinedTableSettings\GetRedefinedTableSettingsTests.cs`, `BatchGetRedefinedTableSettingsTests.cs`
- `Bang.BackOffice.UnitTests\Handlers\TableNodeSettings\GetTableSiteSettingsTests.cs`

## Verify

```
dotnet build src\Bang.BackOffice.sln
dotnet test  src\Bang.BackOffice.UnitTests\Bang.BackOffice.UnitTests.csproj
```

`AvroProfileTests` will fail loudly if a `Fields` constant / `AvroProfile` mapping / contract case is out
of sync — treat it as the guard for the message layer.

## Git workflow

Make changes on a feature branch. **Summarize the diff and ask the user before `git commit`/`git push`** —
do not commit without explicit approval.

## Quick checklist

1. Ask the decision-gate questions (scope, **site override? use `OnSite` suffix**, type/default,
   destinations, avro-schemas repo path, validation).
2. `rg` the reference field(s); mirror every hit.
3. Path A (table) and/or Path B (site) tables above — including the **Update writer** and the **comparer**.
4. Avro sub-procedure for each message contract (5 points) + `AvroProfile.cs` maps **and** the matching
   `.avsc` files in the sibling **avro-schemas** repo; keep fields optional & appended.
5. Update the listed tests.
6. `dotnet build` + `dotnet test`; ensure `AvroProfileTests` passes.
7. Summarize diff (in **both repos**); ask before commit/push.
