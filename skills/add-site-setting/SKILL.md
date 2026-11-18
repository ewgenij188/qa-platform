---
name: add-site-setting
description: Adds a new property to Bang.BackOffice PartnerSite across the model, requests, responses, AutoMapper profiles, Mongo update writers, Kafka/Avro messages, OpenAPI contracts, and the avro-schemas repository. Use when adding a site-scoped setting (e.g. AllowDemoSessions), a new PartnerSite property, or mentioning PartnerSiteRequest, PartnerSiteResponse, PartnerNodeExtensions, NodeSettingsMessage, or site-level Avro contracts.
disable-model-invocation: true
---

# Add a new PartnerSite property (Bang.BackOffice + contracts + avro-schemas)

Three repos:
- **Bang.BackOffice** — main service. Solution: `src\Bang.BackOffice.sln`. Path: ask the user.
- **avro-schemas** — usually adjacent to BackOffice (`..\avro-schemas`). Ask if not found.
- **contracts** — OpenAPI JSON schemas. Usually at `C:\Work\core\contracts`. Ask if not found.

Stack: **.NET 8 / C# / MongoDB** (AutoMap + IgnoreExtraElements), Kafka via hand-maintained Avro contracts, OpenAPI JSON contracts.

**Important:** contracts repo uses `master` branch (no `develop`). Both BackOffice and avro-schemas use `develop`.

---

## Phase 0 — Gather information (ask, don't guess)

1. **Property name** (PascalCase, e.g. `AllowDemoSessions`).
2. **Type** — `bool`, `string`, `int?`, or an enum. This determines which patterns to follow.
3. **Branch name** for all three repos.
4. **Confirm repo paths:**
   - BackOffice: (default `<workspace>\backoffice` or ask)
   - avro-schemas: (default adjacent, `..\avro-schemas`)
   - contracts: (default `C:\Work\core\contracts`)

---

## Phase 1 — Git setup (all 3 repos)

For each repo, in parallel or sequentially:

```powershell
git fetch origin
```

- BackOffice: `git checkout develop`, `git pull`, `git checkout -b <branch>`
- avro-schemas: `git checkout develop`, `git pull`, `git checkout -b <branch>`
- contracts: `git checkout master`, `git pull`, `git checkout -b <branch>`

---

## Phase 2 — avro-schemas repo

**File:** `wnf3/core/backoffice/responses/NodeSettingsMessage.avsc`

Append the field **at the end** of the `"fields"` array (before the closing `]`). Use the same optional shape as existing booleans:

For `bool`:
```json
{
  "name": "AllowDemoSessions",
  "type": ["null", "boolean"],
  "default": null
}
```

For `string`:
```json
{
  "name": "ExampleStringField",
  "type": ["null", "string"],
  "default": null
}
```

For `int?`:
```json
{
  "name": "ExampleIntField",
  "type": ["null", "int"],
  "default": null
}
```

> **Always use `["null","..."]` with `"default":null` for Avro compatibility.** Append at end — never reorder or insert in the middle.

**After the `.avsc` change is approved by the user**, run from the avro-schemas repo root:

```powershell
./run.ps1
```

> **Always use `["null","..."]` with `"default":null` for Avro compatibility.** Append at end — never reorder or insert in the middle.

---

## Phase 3 — Bang.BackOffice repo

### 3.0 Regenerate Avro C# from .avsc (do this first)

Before any manual code changes in BackOffice, regenerate the Avro contract from the updated `.avsc`:

```powershell
cd tools
.\generate_avro_model NodeSettingsMessage.avsc response
```

This runs against the avro-schemas repo's `.avsc` file and auto-generates `NodeSettingsMessage.cs` in `Bang.Backoffice.AvroContracts\Responses\`. Verify the generated file compiles before proceeding.

### 3.1 csproj version bumps

**File:** `src\Bang.Backoffice.AvroContracts\Bang.Backoffice.AvroContracts.csproj`

Bump `<Version>` (patch) and update `<PackageReleaseNotes>` to reflect the new field.

**File:** `src\Bang.BackOffice.ApiResources\Bang.BackOffice.ApiResources.csproj`

Also bump `<Version>` (patch) and update `<PackageReleaseNotes>`. Both packages publish NuGet on build — downstream consumers need the bumps.

### 3.2 Messages (Kafka pipeline constants)

**File:** `src\Bang.BackOffice.ApiResources\Messages\NodeSettingsMessage.cs` → `Fields` class

Add constant — camelCase for the key:
```csharp
public const string AllowDemoSessions = "allowDemoSessions";
```

### 3.3 Data Model

**File:** `src\Bang.BackOffice.DataAccess\Models\PartnerSite.cs`

Add property:
```csharp
public bool AllowDemoSessions { get; set; }
```

For `bool` defaults to `false` — no migration needed (AutoMap + IgnoreExtraElements handle absent docs).

### 3.4 Request DTO

**File:** `src\Bang.BackOffice\ApiResources\Requests\PartnerNodes\PartnerSiteRequest.cs`

Add property:
```csharp
public bool AllowDemoSessions { get; set; }
```

> **For enum types only:** also add a `[JsonIgnore]` computed property (e.g. `JurisdictionEnum`) that parses the string into the enum, and import the enum namespace. For `bool`/`string`/`int?` — just the plain property.

### 3.5 Response DTO

**File:** `src\Bang.BackOffice.ApiResources\Responses\PartnerNodes\PartnerSiteResponse.cs`

Add property with **next free `[Key(N)]`**:
```csharp
[Key(49)]
public bool AllowDemoSessions { get; set; }
```

Check existing keys to find the next free number. Never renumber.

### 3.6 AutoMapper: Request → Model

**File:** `src\Bang.BackOffice\Mapping\PartnerMappingExtensions.cs`

Add in `MapPartnerSiteRequest`:
```csharp
.ForMember(dest => dest.AllowDemoSessions, opts => opts.MapFrom(src => src.AllowDemoSessions))
```

For bool/string/int — direct mapping. For enum — map the parsed enum property (e.g. `src.JurisdictionEnum`).

### 3.7 AutoMapper: Model → Response

**File:** `src\Bang.BackOffice\Mapping\PartnerNodesProfile.cs`

Add in `PartnerSite → PartnerSiteResponse` map:
```csharp
.ForMember(dest => dest.AllowDemoSessions, opts => opts.MapFrom(src => src.AllowDemoSessions))
```

For enum types, convert `.ToString()` with null check (e.g. `src.Jurisdiction != null ? src.Jurisdiction.ToString() : null`).

### 3.8 MongoDB Update Writer

**File:** `src\Bang.BackOffice\Services\PartnerNodeService.cs` → `UpdateSite` method

Add `.Set(...)` in the chain **before** `.Execute()`:
```csharp
.Set(a => a.AllowDemoSessions, site.AllowDemoSessions)
```

> **CRITICAL:** The create path uses AutoMapper; the **update path uses manual `.Set()`**. Forgetting this means the field never persists on edits.

### 3.9 Kafka Message: Create (new site)

**File:** `src\Bang.BackOffice\Mapping\Extensions\PartnerNodeExtensions.cs` → `ToMessage(newSite)`

Add:
```csharp
.AddFieldValue(NodeSettingsMessage.Fields.AllowDemoSessions, newSite.AllowDemoSessions)
```

### 3.10 Kafka Message: Update (existing → new site)

**File:** `src\Bang.BackOffice\Mapping\Extensions\PartnerNodeExtensions.cs` → `ToMessage(existingSite, newSite)`

Add:
```csharp
.AddFieldValueIfDifferent(NodeSettingsMessage.Fields.AllowDemoSessions, existingSite.AllowDemoSessions, newSite.AllowDemoSessions)
```

### 3.11 Avro Profile: Pipeline → Avro wire message

**File:** `src\Bang.BackOffice\Mapping\AvroProfile.cs`

Add mapping in `NodeSettingsMessage → AvroNodeSettingsMessage`:
```csharp
.ForMember(
    avroMessage => avroMessage.AllowDemoSessions,
    message =>
    {
        message.MapFrom(s => Value(s, NodeSettingsMessage.Fields.AllowDemoSessions));
    })
```

### 3.12 Validation (optional — only for enums)

**File:** `src\Bang.BackOffice\Validation\PartnerNodes\PartnerSiteRequestValidator.cs`

For enum types, add a `When(...)` block validating the string is a valid enum name. For bool/string/int, usually no validation needed.

### 3.13 Unit Tests

**File:** `src\Bang.BackOffice.UnitTests\Mapping\AvroProfileTests.cs`
- Add fixture data in the `extensionData` dictionary (e.g. `["allowDemoSessions"] = true`)
- Add assertion: `destination.AllowDemoSessions.Should().Be((bool)extensionData[NodeSettingsMessage.Fields.AllowDemoSessions]);`

**File:** `src\Bang.BackOffice.UnitTests\Handlers\PartnerNodes\Crud\CreatePartnerSiteTests.cs`
- Add `.RuleFor(s => s.AllowDemoSessions, true)` in the test that sets all parameters
- Add `.RuleFor(s => s.AllowDemoSessions, true)` in the notification test
- Add service verification: `PartnerNodeServiceMock.VerifyOnce(service => service.CreateNode(It.Is<PartnerSite>(p => p.AllowDemoSessions == request.AllowDemoSessions), ...))`
- Add notification verification: `NodeSettingsMessageNotifier.VerifyOnce(publisher => publisher.Notify(It.Is<NodeSettingsMessage>(m => m.TryGetFieldValue<bool>(NodeSettingsMessage.Fields.AllowDemoSessions, null) == request.AllowDemoSessions)))`

**File:** `src\Bang.BackOffice.UnitTests\Handlers\PartnerNodes\Crud\UpdatePartnerSiteTests.cs`
- Add `.RuleFor(s => s.AllowDemoSessions, true)` in the test that sets all parameters
- Add service verification: `PartnerNodeServiceMock.VerifyOnce(service => service.UpdateSite(It.Is<PartnerSite>(p => p.AllowDemoSessions == request.AllowDemoSessions), ...))`

**File:** `src\Bang.BackOffice.UnitTests\Services\PartnerNodeServiceTests.cs`
- Add `.RuleFor(s => s.AllowDemoSessions, false)` on oldSite and `.RuleFor(s => s.AllowDemoSessions, true)` on newSite in the update test
- Add notification assertion: `NodeSettingsMessageNotifier.VerifyOnce(publisher => publisher.Notify(It.Is<NodeSettingsMessage>(m => m.TryGetFieldValue<bool>(NodeSettingsMessage.Fields.AllowDemoSessions, null) == newSite.AllowDemoSessions)))`

> **Always use explicit values** (e.g. `true`, `false`) instead of relying on AutoFaker randomness — prevents flaky tests.

---

## Phase 4 — contracts repo

### 4.1 Response contract

**File:** `api-docs/backoffice/responses/GetPartnerSiteResponse.json`

Add after the last property (before the `},` that closes `"properties"`):
```json
"allowDemoSessions": {
  "type": "boolean",
  "description": "Indicates if demo sessions are allowed for the partner site."
}
```

No comma after the last property if you're appending; add a comma to the previous property if inserting.

### 4.2 Create request contract

**File:** `api-docs/backoffice/requests/CreatePartnerSiteRequest.json`

Same shape as response, add before the closing of `"properties"`.

### 4.3 Update request contract

**File:** `api-docs/backoffice/requests/UpdatePartnerSiteRequest.json`

Same shape, add before the closing of `"properties"`.

---

## Phase 5 — Build & Test

```powershell
dotnet build src\Bang.BackOffice.sln
dotnet test src\Bang.BackOffice.UnitTests\Bang.BackOffice.UnitTests.csproj --filter "FullyQualifiedName~AvroProfileTests|FullyQualifiedName~CreatePartnerSite|FullyQualifiedName~UpdatePartnerSite|FullyQualifiedName~PartnerNodeServiceTests"
```

`AvroProfileTests` will fail if any of the 5 Avro contract points or the AvroProfile mapping is out of sync.

---

## Summary checklist

| # | File | Edit |
|---|------|------|
| **avro-schemas** | | |
| 1 | `NodeSettingsMessage.avsc` | Append field to schema |
| 2 | `run.ps1` (repo root) | Run after schema change approved |
| **BackOffice — Codegen** | | |
| 3 | `tools/generate_avro_model` | Regenerate `NodeSettingsMessage.cs` from .avsc |
| **BackOffice — csproj** | | |
| 4 | `Bang.Backoffice.AvroContracts.csproj` | Bump version + release notes |
| 5 | `Bang.BackOffice.ApiResources.csproj` | Bump version + release notes |
| **BackOffice — Messages** | | |
| 6 | `NodeSettingsMessage.cs` (Fields) | Add constant |
| **BackOffice — Model/Request/Response** | | |
| 7 | `PartnerSite.cs` (model) | Add property |
| 8 | `PartnerSiteRequest.cs` | Add property (+ enum parser if enum type) |
| 9 | `PartnerSiteResponse.cs` | Add property with `[Key(N)]` |
| **BackOffice — AutoMapper** | | |
| 10 | `PartnerMappingExtensions.cs` | Request → Model |
| 11 | `PartnerNodesProfile.cs` | Model → Response |
| 12 | `AvroProfile.cs` | Pipeline message → Avro |
| **BackOffice — Persistence** | | |
| 13 | `PartnerNodeService.cs` UpdateSite | `.Set(...)` in MongoDB updater |
| **BackOffice — Kafka** | | |
| 14 | `PartnerNodeExtensions.cs` ToMessage(create) | `.AddFieldValue(...)` |
| 15 | `PartnerNodeExtensions.cs` ToMessage(update) | `.AddFieldValueIfDifferent(...)` |
| **BackOffice — Tests** | | |
| 16 | `AvroProfileTests.cs` | Fixture + assertion |
| 17 | `CreatePartnerSiteTests.cs` | Rule + 2 verifications |
| 18 | `UpdatePartnerSiteTests.cs` | Rule + 1 verification |
| 19 | `PartnerNodeServiceTests.cs` | Rule on old+new + notification assertion |
| **contracts** | | |
| 20 | `GetPartnerSiteResponse.json` | Add property |
| 21 | `CreatePartnerSiteRequest.json` | Add property |
| 22 | `UpdatePartnerSiteRequest.json` | Add property |