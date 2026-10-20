# Add site setting autotests — reference

## Repository

| | |
|--|--|
| **GitLab** | `wnf3/qa/qa-tests-v2` |
| **Local** | `~/IdeaProjects/qa-tests-v2` |
| **Branch** | `master` → `{author}/{TICKET}-{setting-kebab-case}` |
| **Scope** | `api/src/main/java/live/winfinity/at/core/`, `api/src/test/java/live/winfinity/at/core/` |

## File touchpoints

Paths relative to `api/src/main/java/live/winfinity/at/core/`.
`{fieldType}` is the boxed field type (`Boolean`, `String`, `Integer`, or the enum class name).
Verify-method params use primitive `boolean` when `{fieldType}` is `Boolean`; otherwise the param type equals `{fieldType}`.

| # | File | Change |
|---|------|--------|
| | **Infrastructure (Phase 2)** | |
| 1 | `gateway/pojo/backoffice/getsiteresponse/GetSiteResponse.java` | + `{fieldType} {settingName}` (top-level) |
| 2 | `gateway/pojo/backoffice/getsiteresponse/assertions/GetSiteAssertions.java` | + `verify{SettingName}({fieldType} {settingName})` → asserts `.{settingName}()` |
| 3 | `kafka/dto/nodesettingsmessage/NodeSettingsMessage.java` | + field + `toAvro()` mapping |
| 4 | `kafka/dto/nodesettingsmessage/NodeSettingsMessageAvro.java` | + `{fieldType} {SettingName}` (PascalCase) |
| 5 | `gateway/pojo/kafka/assertions/json/NodeSettingsMessageAssertions.java` | + `verify{SettingName}({fieldType} {settingName})` → asserts `.{settingName}()` |
| 6 | `gateway/pojo/kafka/assertions/avro/NodeSettingsMessageAvroAssertions.java` | + `verify{SettingName}({fieldType} {settingName})` → asserts `.{SettingName}()` |
| 7 | `consts/CoreTags.java` | + `{SETTING_NAME_UPPER_SNAKE} = "{settingName}"` |
| | **Table redefinition (Phase 3, optional)** | |
| 8 | `gateway/pojo/backoffice/redefinedtablesettings/nested/RedefinedTableSettings.java` | + `{fieldType} {settingName}` |
| 9 | `gateway/pojo/backoffice/redefinedtablesettings/assertions/RedefinedTableSettingsAssertions.java` | + `verify{SettingName}(String tableId, {fieldType} {settingName})` |
| 10 | `gateway/pojo/backoffice/v5/tablesitesettings/nested/TableSiteSetting.java` | + `{fieldType} {settingName}OnSite` |
| 11 | `gateway/pojo/backoffice/v5/tablesitesettings/assertions/TableSiteSettingsAssertions.java` | + `verify{SettingName}OnSite(String siteId, {fieldType} {settingName}OnSite)` |
| 12 | `kafka/dto/TableSiteSettingsMessageAvro.java` | + `{fieldType} {SettingName}OnSite` (before `String TableName`) |
| 13 | `kafka/dto/tablesitesettings/assertions/TableSiteSettingsMessageAvroAssertions.java` | + `verify{SettingName}OnSite({fieldType} {settingName}OnSite)` → asserts `.{SettingName}OnSite()` |

## New files (always created)

Paths relative to `api/src/test/java/live/winfinity/at/core/`.

| Class | Path | Details |
|-------|------|---------|
| `{SettingName}CreateTestCase` | `providers/backoffice/site/newfields/{settingName}/testcases/{SettingName}CreateTestCase.java` | Record with **2** fields: `{settingName}` and `expected{SettingName}` |
| `{SettingName}CreateContextProvider` | `providers/backoffice/site/newfields/{settingName}/{SettingName}CreateContextProvider.java` | Implements `BaseTestTemplateInvocationProvider`, returns **3** create variants |
| `{SettingName}UpdateTestCase` | `providers/backoffice/site/newfields/{settingName}/testcases/{SettingName}UpdateTestCase.java` | Record with **4** fields: `default{SettingName}`, `defaultExpected{SettingName}`, `updated{SettingName}`, `updatedExpected{SettingName}` |
| `{SettingName}UpdateContextProvider` | `providers/backoffice/site/newfields/{settingName}/{SettingName}UpdateContextProvider.java` | Implements `BaseTestTemplateInvocationProvider`, returns **2** update variants |
| `{SettingName}Tests` | `backoffice/site/newfields/{SettingName}Tests.java` | 2 `@TestTemplate` methods: one with `{SettingName}CreateContextProvider`, one with `{SettingName}UpdateContextProvider`. Plus 3 table `@Test` when table redefinition applies |

### CreateContextProvider variants (always include all three)

| Case | `{settingName}` | `expected{SettingName}` | What it tests |
|------|-----------------|-------------------------|---------------|
| 1 | `true` | `true` | Create with `true` |
| 2 | `null` | `false` | Create without field → default `false` |
| 3 | `false` | `false` | Create with `false` → verify default `false` |

### UpdateContextProvider variants (always include both)

| Case | `default{SettingName}` | `defaultExpected{SettingName}` | `updated{SettingName}` | `updatedExpected{SettingName}` | What it tests |
|------|------------------------|-------------------------------|------------------------|-------------------------------|---------------|
| 1 | `null` | `false` | `true` | `true` | Create without → update to true |
| 2 | `true` | `true` | `null` | `false` | Create with true → update without → default false |

## Variable formats (example: AllowDemoSessions)

| Variable | Value |
|----------|-------|
| `{setting-kebab-case}` | `allow-demo-sessions` |
| `{settingName}` | `allowDemoSessions` |
| `{SettingName}` | `AllowDemoSessions` |
| `{fieldType}` | `Boolean` (boxed type; `boolean` in verify-method params) |
| `{SETTING_NAME_UPPER_SNAKE}` | `ALLOW_DEMO_SESSIONS` |

## Test method count

| Table redefinition? | Methods |
|---------------------|---------|
| No | 2 `@TestTemplate` (CreateContextProvider + FeatureSettingsUpdateContextProvider) |
| Yes | 2 `@TestTemplate` + 3 table `@Test` = 5 |

## Allure IDs needed

**Reference:** test case `90696` ("Create partner site with isBlackjackBetBehindEnabled field").
Create via MCP `allure-testops_testops_create_testcase`, mirroring `90696`'s scenario structure.
**Allure IDs are created automatically by the skill** — the agent calls the MCP tool and wires
the returned IDs into `@AllureId` annotations and ContextProvider params. No manual ID creation.
After creating each test case, the agent reports the link back to the user.

| Scenario | Count |
|----------|-------|
| `No` table redefinition | 3 CreateContextProvider + 2 UpdateContextProvider = **5 IDs** |
| `Yes` table redefinition | 3 CreateContextProvider + 2 UpdateContextProvider + 3 table `@Test` = **8 IDs** |

CreateContextProvider IDs go in `create()` params per variant (3 variants).
UpdateContextProvider IDs go in `create()` params per variant (2 variants).

## Naming conventions cheat sheet

| Context | Convention | Example |
|---------|-----------|---------|
| Java field (camelCase) | `{settingName}` | `allowDemoSessions` |
| Java class/method (PascalCase) | `{SettingName}` | `AllowDemoSessions` |
| JSON getter | `.{settingName}()` | `.allowDemoSessions()` |
| Avro getter | `.{SettingName}()` | `.AllowDemoSessions()` |
| CoreTags constant | `{SETTING_NAME_UPPER_SNAKE}` | `ALLOW_DEMO_SESSIONS` |
| Site-override field | `{settingName}OnSite` | `allowDemoSessionsOnSite` |
| Site-override Avro getter | `.{SettingName}OnSite()` | `.AllowDemoSessionsOnSite()` |

## Gotchas

- **JSON = camelCase, Avro = PascalCase.** Mixing getter casing → `NoSuchMethodError`.
- **Dual Kafka verification.** Must verify BOTH `NodeSettingsMessage` (JSON) AND `NodeSettingsMessageAvro`.
- **Append to records.** Never insert fields in the middle of Java records.
- **`OnSite` suffix** on TableSiteSetting/TableSiteSettingsMessageAvro — don't forget it.
- **Assertion signatures differ.** `RedefinedTableSettingsAssertions.verify{SettingName}(tableId, bool)` takes a
  `tableId`, but `TableSiteSettingsAssertions.verify{SettingName}OnSite(siteId, bool)` takes a `siteId`.

## Verification

Format first:
```bash
"/Applications/IntelliJ IDEA.app/Contents/bin/format.sh" \
  -s ~/IdeaProjects/qa-tests-v2/docs/xml/java_code_style_v5.xml \
  -r \
  ~/IdeaProjects/qa-tests-v2/api/src
```

Then compile: `mvn -pl api -am test-compile --no-transfer-progress` from `~/IdeaProjects/qa-tests-v2`.
When environment is available: `mvn -pl api test -Dtest={SettingName}Tests`.

## Example — AllowDemoSessions (CORE-4195)

| Item | Value |
|------|-------|
| Ticket | CORE-4195 |
| Branch | `{author}/CORE-4195-allow-demo-sessions` |
| Type | `Boolean`, default `false` |
| Table redefinition | Yes |
| Files edited | 13 existing + 3 new |
| Allure IDs needed | 8 (3 CreateContextProvider + 2 UpdateContextProvider + 3 table @Test) |
| New files | `AllowDemoSessionsCreateTestCase`, `AllowDemoSessionsCreateContextProvider`, `AllowDemoSessionsUpdateTestCase`, `AllowDemoSessionsUpdateContextProvider`, `AllowDemoSessionsTests` |

## Related

- CORE BackOffice side: `add-site-setting` skill
- QA autotest writing: `qa-tests-v2-write-auto-tests` skill
<!-- - Allure TestOps: `winfinity-testops` skill -->
