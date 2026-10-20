---
name: add-new-site-setting-autotests
description: Writes CORE API autotests in qa-tests-v2 for a new PartnerSite field added globally in the endpoint. Covers GetSiteResponse, NodeSettingsMessage, NodeSettingsMessageAvro, RedefinedTableSettings, TableSiteSetting, TableSiteSettingsMessageAvro, CoreTags, parameterized @TestTemplate with ContextProvider, and Allure test cases. Use ONLY when adding a new global PartnerSite field to qa-tests-v2, or the user asks to write PartnerSite setting autotests, or mentions add-site-setting-qa, or requests a new PartnerSite field in tests.
disable-model-invocation: true
---

# Add new site setting autotests (qa-tests-v2)

## Purpose

Write CORE API autotests in **qa-tests-v2** for a new PartnerSite field added globally in the endpoint (top-level field in `GetSiteResponse`, not nested inside a sub-object).

## Context (read first)

- **`knowledge-map/testing/qa-tests-v2-core.md`** — branch/MR conventions, CORE test patterns, CI.

**Repo:** `wnf3/qa/qa-tests-v2` · **Local:** `~/IdeaProjects/qa-tests-v2` · **Default branch:** `master`

<!-- ## Use when

The user adds **API autotest coverage** for a new **live** CORE site setting in **qa-tests-v2** (not slots — see `add-new-slot-game` or `add-new-game-type-autotests`). -->

<!-- ---

## Golden rule: mirror a reference field

Do **not** write new code from scratch. Grep an existing global PartnerSite boolean field
(top-level in GetSiteResponse) that already flows to the same destinations, then mirror every
hit — every file the reference appears in is a file to edit, with the same shape (type, default,
assertion style, Kafka wiring).

Start by grepping a complete reference, e.g. a field that also has table redefinition.

--- -->

## Required inputs — ask before coding

**Stop and ask** if any row is missing. **Do not guess** Allure IDs, static table ids, or bet names.

## Phase 0 — Decision gate (MANDATORY, ask ONE at a time)

Ask each question **interactively** using the `question` tool. Present options for the user to pick.
**Never ask all questions at once** — wait for the answer before asking the next one.

### Variable substitution reference (internal)

| Placeholder | Example (`AllowDemoSessions`) | Used in |
|---|---|---|
| `{taskNumber}` | `CORE-4195` | Branch name, Allure tags |
| `{setting-kebab-case}` | `allow-demo-sessions` | Branch name, package paths |
| `{settingName}` | `allowDemoSessions` | Java fields, methods, package names |
| `{SettingName}` | `AllowDemoSessions` | Class names, Avro getters, display names |
| `{fieldType}` | `Boolean` / `String` / `Jurisdiction` | Field declarations, verify-method params |
| `{SETTING_NAME_UPPER_SNAKE}` | `ALLOW_DEMO_SESSIONS` | CoreTags constant |
| `{allureId1}`…`{allureId5}` | `"123456"` | ContextProvider Allure IDs (3 Create + 2 Update) |
| `{author}` | `zhuk` | Git username, branch prefix |

### 0.1 Task number

Ask for the task number. Offer options like `CORE-4195`, plus a "type your own" fallback.
Store `{taskNumber}`.

### 0.2 Setting name

Ask the user to **manually enter** the setting name in PascalCase (e.g. `AllowDemoSessions`).
Store `{SettingName}`.

### 0.3 Branch name

Present the computed branch `{author}/{taskNumber}-add-new-{setting-kebab-case}` for confirmation
(resolve `{author}` from `git config user.name` or `whoami`, default `test`).
Options: proceed, or enter a custom branch name.

### 0.4 Field type & default value

Ask for the field type. Options: `Boolean` (default `false`), `String`, `Integer`, `Enum`, or type your own.
Then ask for the default value, offering a sensible default per type.

Store the type as `{fieldType}` and use it in every field declaration and verify-method parameter
instead of hardcoding `Boolean`:

| Chosen type | `{fieldType}` (record field) | verify-method param |
|---|---|---|
| `Boolean` | `Boolean` | `boolean` |
| `String` | `String` | `String` |
| `Integer` | `Integer` | `Integer` |
| `Enum` | the enum class name (e.g. `Jurisdiction`, as in `public enum Jurisdiction`) | same enum class name |

Field declaration examples (with the `OnSite` suffix):
- Boolean → `Boolean {settingName}OnSite`
- String → `String {settingName}OnSite`
- Enum → `Jurisdiction {settingName}OnSite`

Verify-method examples: `verify{SettingName}OnSite({fieldType} {settingName}OnSite)`,
`verify{SettingName}OnSite(String {settingName}OnSite)`, `verify{SettingName}OnSite(Jurisdiction {settingName}OnSite)`.

If the chosen type is **not `Boolean`** — the phases below (and their boolean-specific test variants)
no longer apply verbatim. Analyze the repo for an existing global field of the same type and mirror
that field's test, or propose a custom solution tailored to the type (and confirm it with the user).

### 0.5 Table redefinition

Ask: **"Are partner site settings redefined on the table?"**

Options:
- `Yes` — include table-level tests (`RedefinedTableSettings`, `TableSiteSetting`, `TableSiteSettingsMessageAvro`)
- `No` — site-level only (`getSite`/`getSites` + `NodeSettingsMessage` Kafka)

Store as `isTableRedefinition`.

- **No** → skip Phase 3. Create 2 `@TestTemplate` methods (CreateContextProvider + FeatureSettingsUpdateContextProvider).
- **Yes** → include Phase 3. Create 2 `@TestTemplate` + 3 table `@Test` = 5 test methods.

#### 0.5.1 OnSite field name (only if "Yes" in 0.5)

Ask: **"What is the camelCase name for the onSite field in TableSiteSetting?"**

Default: `{settingName}OnSite` (e.g., `allowDemoSessionsOnSite`). If the user accepts the default, no
further action is needed. If the user enters a custom name (e.g., `demoSessionsOnSite`), store it as
`{onSiteFieldName}` and use it in Phase 3:

| Place | Default | If custom |
|---|---|---|
| `TableSiteSetting` record field | `{fieldType} {settingName}OnSite` | `{fieldType} {onSiteFieldName}` |
| `TableSiteSettingsAssertions` method | `verify{SettingName}OnSite` | `verify{SettingName}OnSite` (assertion method name follows PascalCase of the field) |
| `TableSiteSettingsMessageAvro` record field | `{fieldType} {SettingName}OnSite` | `{fieldType} {OnSiteFieldName}` (PascalCase) |
| `TableSiteSettingsMessageAvroAssertions` method | `verify{SettingName}OnSite` | `verify{OnSiteFieldName}` (PascalCase of the Avro field) |
| Test class method name | `test{SettingName}OnSite...` | `test{OnSiteFieldName}...` |
| Test class field references | `.{settingName}OnSite()` | `.{onSiteFieldName}()` |

### 0.6 Summary & proceed

Present the full decision summary (task, setting, branch, type, table redefinition, test method count)
and ask to proceed. Options: proceed, or loop back to a specific question.

---

## Gotchas

See **reference.md → Gotchas** (JSON/Avro casing, dual Kafka verification, append-to-records,
`OnSite` suffix, `tableId` vs `siteId` assertion signatures).

---

## Phase 1 — Git setup

Fetch, checkout `master`, pull, then create branch `{author}/{taskNumber}-{setting-kebab-case}`
(resolve `{author}` from `git config user.name` or `whoami`, default `zhuk`).
**No commit, no push** unless the user explicitly approves.

---

## Phase 2 — Infrastructure (always needed)

Add the field + its assertion to the 7 infra classes. Full paths and change descriptions are in
**reference.md → File touchpoints → Infrastructure (Phase 2)**. Mirror an existing global Boolean field in
each class.

1. `GetSiteResponse`
2. `GetSiteAssertions`
3. `NodeSettingsMessage`
4. `NodeSettingsMessageAvro`
5. `NodeSettingsMessageAssertions` (JSON)
6. `NodeSettingsMessageAvroAssertions` (Avro)
7. `CoreTags`

---

## Phase 3 — Table-level redefinition (only if "Yes" in 0.5)

Add the field + its assertion to the 6 table classes. Full paths and change descriptions are in
**reference.md → File touchpoints → Table redefinition (Phase 3, optional)**.

8. `RedefinedTableSettings`
9. `RedefinedTableSettingsAssertions`
10. `TableSiteSetting`
11. `TableSiteSettingsAssertions`
12. `TableSiteSettingsMessageAvro`
13. `TableSiteSettingsMessageAvroAssertions`

---

## Phase 4 — Parameterized test infrastructure

**ALWAYS create parameterized tests using `@TestTemplate` + `ContextProvider`** (the preferred
pattern). The test class uses **two** `@TestTemplate` methods — one for create, one for update.

Create the 5 new classes below. Full paths, field details and the variant table are in
**reference.md → New files**.

1. `{SettingName}CreateTestCase` — record with 2 fields: `{settingName}` and `expected{SettingName}`
2. `{SettingName}CreateContextProvider` — 3 create variants (true / null / false)
3. `{SettingName}UpdateTestCase` — record with 4 fields: `default{SettingName}`, `defaultExpected{SettingName}`, `updated{SettingName}`, `updatedExpected{SettingName}`
4. `{SettingName}UpdateContextProvider` — 2 update variants
5. `{SettingName}Tests` — test class with 2 `@TestTemplate` methods:
   - `@ExtendWith({SettingName}CreateContextProvider.class)` for create scenarios
   - `@ExtendWith({SettingName}UpdateContextProvider.class)` for update scenarios

---

## Phase 5 — Allure test cases & IDs

Manual RFA test cases are created via MCP `allure-testops`. Use test case `90696`
("Create partner site with isBlackjackBetBehindEnabled field") as the structural reference.

**Mandatory:** if MCP `allure-testops` is not configured or unavailable, **ask the user to provide
an `allureId` for each test manually** (one per `@Test` method and one per ContextProvider variant).
Never invent/generate Allure IDs yourself. Collect them before wiring the code in step 3 below.

1. Read the reference test case via MCP `allure-testops_testops_find_testcases` (with `expand: ["scenario"]`)
   to see its scenario structure and reuse it as the template shape.
2. For each test method (and each ContextProvider variant), create a test case via
   `allure-testops_testops_create_testcase`:
   - `projectId`: `1`
   - `name`: `API | CORE | BackOffice | {display name from @DisplayName}`
   - `status`: `Draft`
   - `workflow`: `Manual Testing`
   - `testLayer`: `API Tests`
   - `description`: what the test verifies
   - `precondition`: create site with `{settingName}`, verify via getSite/getSites,
     check Kafka topics `core.node.settings.message` and `core.node.settings.message.internal`
   - `expectedResult`: status code + `{settingName}` returned as expected
   - `tags`: `core`, `RFA`, `backoffice`, `{settingName}`
   - `scenario`: mirror the reference test case's scenario steps.

Then collect each new test case ID and wire it into the code: replace `@AllureId("0")` placeholders and the
ContextProvider `{allureId1}` / `{allureId2}` values with the real IDs.

**Rules:**
- **ContextProvider variants need their own IDs** — don't reuse the same ID.
- After creating each test case, report the link back to the user so they can review it immediately.
  Format: `https://testops.wnf.rocks/project/1/test-cases/{id}`.

---

## Phase 6 — Format, build and verify

### 6.1 Format

Run IntelliJ formatter on all new and modified `.java` files using the project code style:

```bash
"/Applications/IntelliJ IDEA.app/Contents/bin/format.sh" \
  -s ~/IdeaProjects/qa-tests-v2/docs/xml/java_code_style_v5.xml \
  -r \
  ~/IdeaProjects/qa-tests-v2/api/src
```

If IntelliJ is already running and `format.sh` exits with "Only one instance of IDEA can be run at a time",
close IntelliJ first, then rerun. Alternatively, remind the user to run **Reformat Code + Rearrange Code**
manually in IntelliJ before committing.

### 6.2 Compile

Run `mvn -pl api -am test-compile --no-transfer-progress` from `~/IdeaProjects/qa-tests-v2`.
Check for `BUILD SUCCESS`. On `COMPILATION ERROR`, read the error, fix, recompile.

**Note:** Full test execution requires a running environment (Kafka, CORE services).
Run `mvn -pl api test -Dtest={SettingName}Tests` when environment is available.

---

## Quick checklist

1. Decision gate → task #, setting name, type, table redefinition.
2. `rg` reference field; mirror every hit (incl. an existing `{SettingName}Tests.java`).
3. `git checkout -b {author}/{task}-{setting}` from master (resolve `{author}` from git config, default `zhuk`).
4. Phase 2: Add field to 7 infrastructure files (CoreTags).
5. Phase 3 (if table redefinition): Add to 6 table files.
6. Phase 4: Create `{SettingName}CreateTestCase` + `{SettingName}CreateContextProvider` + `{SettingName}UpdateTestCase` + `{SettingName}UpdateContextProvider` + test class.
   - CreateContextProvider: 3 variants (true, null, false).
   - UpdateContextProvider: 2 variants (null→true, true→null).
   - Test class uses **two** `@TestTemplate`: CreateContextProvider + UpdateContextProvider.
7. Phase 5: Create Allure test cases via MCP, replace @AllureId placeholders.
8. Phase 6: run `format.sh` with `java_code_style_v5.xml`, then `mvn -pl api -am test-compile` — fix errors, recompile.
9. Summarize diff, ask before commit/push.
