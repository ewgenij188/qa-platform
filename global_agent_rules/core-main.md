# CORE (main) — Framework rules

> Rules for CORE framework code (`api/src/main/java/live/winfinity/at/core`).
> Global note: applies when working with CORE code.

## Layout of `live.winfinity.at.core`

| Directory | Contents |
| --- | --- |
| `gateway/` | CORE clients: `steps` (direct calls), `flows`, `pojo`, `factory`, `providers`, `configs`, `interceptors` |
| `dto/` | integration and backoffice DTOs |
| `enums/` | enumerations (brandingcampaigns, gameType, table, kafka, etc.) |
| `kafka/` | Kafka DTOs (Avro + Schema Registry) |
| `consts/` | constants: `CoreTags`, `CoreXErrorCodesConstants`, error messages, locks |
| `params/`, `meta/`, `serializers/`, `properties/`, `partners/` | scaffolding |

## Gateway: steps vs flows vs pojo

- **Steps** (`gateway/steps/**`) — call the API directly and return `RestResponse`. Named `{Module}Steps`.
- **Flows** (`gateway/flows/**`) — orchestrate steps/clients, build complex entities, auto-register cleanup, return domain objects.
- **Pojo** (`gateway/pojo/**`) — request/response models, assertions next to models.
- Steps/Flows that manage resources: `extend CleanUpHandler` and `register(entity, deleteFn)`.

## Package naming (important)

**Known inconsistency — follow existing code, do not "fix" it without a task:**
- `gateway/flows/backOffice` — capital **O** (`BrandingCampaignsFlows`).
- `gateway/steps/backoffice` and `gateway/pojo/backoffice` — lowercase **o**.

New files use the case of their target directory.

## Constants and tags

- Error codes/messages: `core/consts/CoreXErrorCodesConstants.java`, `core/consts/backoffice/**`.
- Do not hardcode strings loosely in tests — take them from `consts` (BOF-6159 rule).
- Framework tags: `core/consts/tags/**`, classes `Core<Topic>Tags` (e.g. `CoreBackofficeTags`); common ones — `core/consts/CoreTags.java`.

## Conventions

- Comments: 1–2 lines in Russian, explaining "why".
- `@Step` for backoffice — prefix `Backoffice:` plus the correct verb (docs/rules/backoffice.md §1).