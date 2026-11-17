# CORE (test) — Test rules

> Rules for CORE tests (`api/src/test/java/live/winfinity/at/core`).
> Global note: applies when writing/editing CORE tests.

## Layout

```
live.winfinity.at.core.<area>/
  ├── <Feature>Tests.java          # @Test — regular tests
  ├── ...                          # @TestTemplate — parameterized
  ├── providers/                   # TestTemplateInvocationProvider + context providers
  └── ws/                          # WebSocket tests
```

Example: `core/backoffice/brandingcampaigns/{create,update}/BrandingCampaignsV5*Tests.java` + `providers/backoffice/brandingcampaigns/*ContextProvider.java`.

## Base classes

| Type | Base |
| --- | --- |
| HTTP-only | `BaseApiTest` |
| WebSocket | `BaseWsTest` |

Wrong base = wrong Allure taxonomy + wrong extensions.

## Environment tags — `@Tags` format

**Strictly per `docs/rules/backoffice.md` §7:**

- Environment tags — on a **single line**; no `@Tag` in a column and no trailing comma.
- Order: `CERTIFICATION`, `PREPROD`, `RELEASE`, `LATEST`, then feature environments.
- Included environments match where the test actually runs.

Scopes: `@SmokeTag`, `@CriticalTag`. Environment constants — `live.winfinity.at.constants.Environments`; structure tags — `core/consts/CoreTags` and `core/consts/tags/**`.

`@TestTemplate` rule: do **not** put `@Tag`, `@AllureId`, `@DisplayName`, or scope directly on a `@TestTemplate` method — only on regular `@Test`. Use providers for parameterization.

## Mandatory attributes

Each `@Test` carries: `@Tags({...})` (single line), `@SmokeTag`/`@CriticalTag`, `@AllureId`, `@DisplayName`. Without `@AllureId` there is no TestOps traceability.

## Assertions

- `.as(...)` — starting with a **capital letter** (§6).
- Do not duplicate checks: if one method already fully validates a composite object (e.g. `verifyGenericCampaign` checks `(tableId, brandedTableName)` pairs), do not add a second partial assertion over the same field.

## Data/random

- `live.winfinity.at.utils.random.*` (RandomUtils, RandomStringUtils, RandomEnumUtils).
- Take domains/data from core providers/`dto`, do not hardcode.

## Cleanup

- Factory-created entities auto-register. Manual resources need explicit `register(entity, this::delete)`.