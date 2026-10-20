---
name: qa-tests-v2-autotests
description: >-
  Writes CORE API autotests in qa-tests-v2 (write/extend test classes, Steps,
  Flows, providers, tags). Mandatory branch workflow: every invocation starts by
  asking the user whether to work on a new branch (prefix `zhuk/{taskNumber}`,
  user supplies the task number, description completed from context) or an
  existing local branch (user names it). Never commits/pushes without explicit
  per-message approval. Use when writing, extending, or scaffolding qa-tests-v2
  autotests, or when a task matches the CORE QA test-writing flow.
---

# qa-tests-v2 — Write auto-tests

## Purpose

Write/extend CORE API autotests in **qa-tests-v2** according to team conventions.

**Repo (GitLab):** `wnf3/qa/qa-tests-v2` · **Local:** `~/IdeaProjects/qa-tests-v2` · **Default branch:** `master`

---

## Skill files — where content belongs

- **`SKILL.md`** — rules, workflow, checklists. Keep it short, without long code examples.
- **`reference.md`** — every concrete code snippet, tag set, error-body pattern, naming list.

---

## MANDATORY branch workflow (run every time, before any code)

1. **Ask the user:** new branch or existing local branch?
    - If the user already named the branch in the request (e.g. "We work only in branch
      ``{author}`/`{taskNumber}`-...``"), that **is** the answer — do not ask again.
    - **Existing local branch** → ask the user to name it, then `git checkout` it.
    - **New branch** → use prefix **``{author}`/`{taskNumber}``**, ask the user for the
      **task number**, then complete the description from the ticket/context.
2. `git fetch` + `git pull origin master` before **creating** a new branch. Do not merge
   `master` into an existing branch unless asked.
3. Continue only after the user answers. **Never guess the branch or task number.**
4. **Check the working tree first** — `git branch --show-current`, `git status --short`,
   `git log --oneline -5`. Verify what is actually at HEAD, and re-read every file before
   editing (the user may have touched it in the IDE meanwhile).

---

## Git rules

- **No commit, no push** unless the user explicitly approves in the **current** message.
- Commits: `{TICKET}: Short message`.
- Squash merge to `master`.
- `bootstrap.properties` — ignored (local-only config, never committed). It usually has
  local modifications; if a reset/revert wiped them, warn the user — there is no copy in git.

---

## Context (read first)

- **`knowledge-map/testing/qa-tests-v2-core.md`** — branch/MR conventions, CORE test patterns, CI (canonical guide).
- Repo **`AGENTS.md`** files (`api/src/test/AGENTS.md`, root) — conventions.
- Repo **`REVIEW.md`** — review rules.
- Related skills: `qa-analyze` (analysis), `create-testcases`.

---

## Team context

| Field           | Value                         |
|-----------------|-------------------------------|
| Name            | Yauheni Zhuk                  |
| GitLab username | `yauheni.zhuk`                |
| Email           | `yauheni.zhuk@winfinity.live` |
| Branch prefix   | `zhuk/`                       |

---

## Allure IDs

If MCP `allure-testops` **is active** (and the token is active), still **ask the user**
which way to assign Allure IDs:

- **auto** — generate new test cases automatically via MCP `allure-testops`, using the
  real returned IDs directly in `@AllureId`;
- **manual** — the user supplies the Allure IDs by hand.

**Mandatory:** if MCP `allure-testops` is **not configured or unavailable**,
**you must ask the user to provide an `allureId` manually for each test**
(one per `@Test` method and one per `ContextProvider` variant).
Never invent or generate Allure IDs yourself. It is allowed to use a placeholder
Allure ID (for example, `@AllureId("0")`).

---

## Environments & tags

Standard CORE `@Tag` set, scope tags and component tag — see
[reference.md](reference.md#standard-tag-set).

- **All tags live in `CoreTags`** — package `live.winfinity.at.core.consts`
  (`api/src/main/java/live/winfinity/at/core/consts/CoreTags.java`). Import them statically:
  `import static live.winfinity.at.core.consts.CoreTags.<TAG>;`.
  When creating a **new test class**, pick the existing component tag from `CoreTags`
  that matches the feature; if none fits (e.g. a brand-new domain), **add a new constant
  to `CoreTags`** first, then use it — do not hardcode tag strings in the test.
- `@Tags` are **always formatted as a column** — one `@Tag` per line, both on the class and
  on methods. Never write them inline on one line — see the code sample in
  [reference.md](reference.md#standard-tag-set).
- **Do not add `@Tag(FEATURE_*)`** (e.g. `FEATURE_BACKOFFICE`) — remove it when refactoring
  or writing new tests, unless the user explicitly asks for it. The standard method-level
  environment set is `CERTIFICATION`, `PREPROD`, `RELEASE`, `LATEST`, `CORE_QA`.
- **Entity-type test classes each get a new type tag** — every test class that represents a
  distinct entity/subtype carries its own type tag (e.g. campaign types `GENERIC_BRANDING`,
  `BLUE_SCREEN_BRANDING`, `PHYSICAL_BRANDING`) alongside the component tag (`@Tag(BRANDING)`).
  **When creating a new test class, add one new type-tag constant to `CoreTags` and use it on
  the class** — do not reuse a tag from another entity (MR 6022 added
  `BLUE_SCREEN_BRANDING = "blueScreenBranding"` this way). The tag value is the camelCased
  entity name.
- **Positive/smoke methods keep `@Tag(CERTIFICATION)`; `@CriticalTag` validation methods
  drop it** — merged brandingcampaigns MRs use `{CERTIFICATION, PREPROD, RELEASE, LATEST,
  CORE_QA}` for positives and `{PREPROD, RELEASE, LATEST, CORE_QA}` for validation.

---

## How to write a new autotest (template)

Below is the canonical step-by-step workflow. Follow this for every new test, regardless
of the feature domain.

### Phase A — Understand the API under test

1. **Read the backend MR / source code** — controllers, handlers, validators, service layer.
   Identify:
    - Endpoint paths (the URL segment — often derivable from controller names, but always
      ask the user if uncertain).
    - HTTP methods (POST/GET/PUT/DELETE).
    - Request shape (body vs query params, required fields, nested objects).
    - Response shape (success body, error body, status codes — e.g. 201 for create, 200 or
      204 for update, 204 or empty for delete).
    - Validation rules (required fields, length limits, enum boundaries, conditional
      constraints across fields).
    - Business rules (status transitions, type-dependent field requirements, uniqueness
      constraints, relationship checks).
2. **Check git history in qa-tests-v2** — look for previous commits on the same ticket
   number. If prior work was stashed/reset, recover the code from git objects (`git show
   <commit>:<path>`). Never rewrite infrastructure that already existed.

### Phase B — Discover what already exists in qa-tests-v2

3. **Search for existing Steps** (`core/gateway/steps/`) — do create/get/update/delete
   step classes already exist for this domain? What endpoints do they hit?
4. **Search for existing POJOs** (`core/gateway/pojo/`) — do request/response DTOs and
   enums exist? Are they records or classes? How are enums serialized (strings vs
   integers via `@JsonValue`)? If a Response/assertions for the same operation already
   exists in a neighbouring domain (in its root or an operation folder), **reuse or add an
   overload rather than imposing a fresh layout.**
5. **Search for existing Flows** (`core/gateway/flows/`) — what multi-step orchestration
   is available (e.g. create-and-activate patterns)?
6. **Search for existing tests** (`core/backoffice/<domain>/`) — what test structure is
   already established for this feature? What base class is used? What tags?

### Project structure (canonical CORE feature layout)

Mirror the current `brandingcampaigns` layout when adding a new CORE BackOffice feature:

```
api/src/main/java/live/winfinity/at/
├── core/enums/<domain>/                       # feature enums (CAPS + @JsonValue value)
│   └── BrandingCampaignStatus, BrandingCampaignType, GenericAssetsKeys
├── core/dto/backoffice/                       # raw-id response wrappers (StringResponse)
│   └── BrandingCampaignIdResponseWrapper
├── core/gateway/pojo/backoffice/<domain>/     # POJOs split by operation
│   ├── create/
│   │   ├── CreateBrandingCampaignRequest       # record + @Builder + static factories
│   │   └── nested/                             # shared nested DTOs (BrandingCampaignTable, SiteInfo, ...)
│   ├── get/
│   │   ├── BrandingCampaignResponse            # record + implements *Assertions + getSelf()
│   │   └── assertions/BrandingCampaignAssertions  # interface extends ObjectAssertions<T>
│   └── harddelete/HardDeleteBrandingCampaignRequest
├── core/gateway/steps/backoffice/<domain>/    # @Component steps → RestResponse
│   └── BrandingCampaignsV5Steps                # create/get/hardDelete + keepCreatedX cleanup
├── core/gateway/flows/backOffice/<domain>/    # @Component flows → domain values (create+get orchestration)
│   └── BrandingCampaignsFlows                  # createAndGetGenericCampaign(...) + private createAndGetCampaign(request)
api/src/test/java/live/winfinity/at/core/backoffice/<domain>/
└── CreateGenericBrandingCampaignsTests         # @Feature("API | BackOffice | v5 | ...")
```

Key conventions (from the merged MR):
- **Create+get orchestration goes to a flow** — `BrandingCampaignsFlows.createAndGetGenericCampaign(...)`
  wraps create→201→unwrap→get→200; the shared create→unwrap→get body lives in a **private
  `createAndGetCampaign(request)` helper on the same flow** (not in the test).
- **Tests call the flow**; `verifyGenericCampaign(...)` lives on the response
  (assertions interface), not on the flow.
- Request/response POJOs live under operation-scoped folders (`create/` for the request +
  `create/nested/`, `get/` for the GET response, delete payloads under `harddelete/`).
  This `create/`+`get/` split is the canon for a **new** domain, not a requirement to
  restructure an existing one — other domains keep Response+assertions in their root or in
  an operation-named folder (`gettable/assertions/`, `getsiteresponse/assertions/`).
- **Nested DTOs live once under `create/nested/` and are shared** — the GET response
  (`get/BrandingCampaignResponse`) imports `BrandingCampaignTable`, `SiteInfo` and
  `PartnerInfo` from `create.nested` rather than redeclaring them.
- Enums and key constants (asset keys) live under `core/enums/<domain>/`.

### Phase C — Build infrastructure (bottom-up: POJOs → Steps → Test)

Create in dependency order — compile after each layer, not only at the end.

7. **POJOs first** — create enums, request DTOs, response DTOs, and any nested objects.
    - Enums: constants are **CAPS** (`DRAFT`, `ACTIVE`, `ABORTED`); if the backend serializes
      by value, add a `value` field + `@JsonValue` (e.g. `DRAFT("Draft")`) and a `@Getter`
      — mirror `core.enums.topwins.OrderBy`. Never name constants like the serialized value
      (`Draft`, `Active`).
    - **Package layout for a feature:** keep domain enums under
      `live.winfinity.at.core.enums.<domain>` (e.g. `core/enums/brandingcampaigns/`); split
      request/response POJOs by operation into `pojo/backoffice/<domain>/create/`,
      `.../<domain>/create/nested/`, `.../<domain>/get/` (response + `<domain>/get/assertions/`),
      `.../<domain>/harddelete/`, …; the raw-id response wrapper (a `StringResponse` subclass)
      lives under `core/dto/backoffice/`.
    - Requests: use `record` with `@Builder` (Lombok). Prefer existing patterns in the
      codebase.
    - Responses: use `record`. Match field names and structure to the backend response
      shape (the C# `*Response` class).
    - Nested records for arrays of objects in the response — put them in the `nested/`
      sub-package.
    - **Assertions for a response:** create an interface
      `*Assertions extends ObjectAssertions<TheResponse>` next to the response
      (e.g. `.../get/assertions/BrandingCampaignAssertions`), with `default` verify
      methods that pull `getSelf()`; the response record `implements` it and returns `this`
      from `getSelf()`. Call verifies on the response instance, e.g.
      `brandingCampaign.verifyGenericCampaign(...)`.
8. **Steps second** — create a `@Component` step class with methods for each endpoint.
    - Use `RestClient` + `HttpRequest.builder()`.
    - Inject `${haproxy.url}` + the RestClient.
    - Use `@Step("Core V5: ...")` for Allure reporting.
    - Match the endpoint path to the controller name (ask the user to confirm).
    - **Query params** for GET endpoints, **body** for POST/PUT/DELETE.
    - If an endpoint takes a body on DELETE (e.g. batch-delete with a list of IDs), create
      a small request DTO for that body — do NOT use query params.
    - **Create steps return the raw-id wrapper** (`RestResponse<XxxIdResponseWrapper, String>`
      via `sendRequestAndWrapString(...)`), see
      [reference.md](reference.md#stringresponse-id-wrapper).
    - **Bean-name collisions:** Spring names beans from the simple class name, so a new
      `@Component` must not duplicate any existing class name in the repo — even in
      another package. Before creating, run `find api/src -name "<Name>.java"`; on
      collision (e.g. `BrandingCampaignsSteps` vs existing
      `backoffice.tables.steps.BrandingCampaignsSteps`) disambiguate with a version
      suffix (`BrandingCampaignsV5Steps`). POJO records/enums are not beans and do not
      collide.

### Phase D — Write the test class

9. **Placement** — package under `core/{service}/<domain>/`, where `{service}` is the
   service name from the task or GitLab (e.g. `core/backoffice/<domain>/`). Class name
   ends with `Tests`.
10. **Class-level annotations** — `@Tags` (component area tags), `@AllureComponentCore`,
    `@Feature("API | {service} | <Feature>")` — use the service name from the task or
    GitLab, e.g. `@Feature("API | BackOffice | Branding campaigns V5")`. Explicitly
    stating the service in `@Feature` is optional; `@Feature("API | <Feature>")` is fine
    too.
11. **Extend `BaseApiTest`** — provides Spring context, cleanup, and the `api` JUnit tag
    via `@AllureLayerApi`.
12. **Inject dependencies** — `@LazyAutowired` (never `@Autowired`), `@Value` for
    properties like `${backoffice.test-folder-id}`.
13. **Constants and helpers** — extract repeated data (e.g. required payload maps for
    validation) to `static final` fields. Request construction goes to **static factories
    on the request POJO** (see [Where to put extracted code](#where-to-put-extracted-code));
    class-local orchestration goes to private helpers.
    - **Test data is random, never hardcoded** — see [Random test data](#random-test-data).
    - **Per-test random state goes to `@BeforeEach`**, not to `final` instance fields —
      declare the field, initialize it in `setUp()` (mirror `CreateGenericBrandingCampaignsTests`:
      `gameType`, `brandingCampaignName`). Keeps each test fresh under `PER_METHOD`.
14. **State** — use `List<String>` for IDs that need manual cleanup. Instance fields for
    the entities created in `@BeforeEach` (if applicable).
15. **Cleanup** — `@AfterEach` method: call the batch-delete step for the accumulated
    IDs, wrapped in try/catch (some may already be deleted by the test itself). Entities
    created through framework-managed flows clean up automatically — see
    [Cleanup](#cleanup--framework-managed-do-not-hand-roll).
16. **Each test method** — follow the strict annotation order
    ([reference.md](reference.md#test-method-annotation-order)).
17. **Test method body** — follow the step-by-step orchestration the user described:
    - **No step-narration comments** — do NOT write `// 1. Create site`, `// 2. Create
      table`, `// 6. Get site tables...` etc. The user explicitly rejects them. Group
      logical blocks with a blank line instead (package convention). If a reason is
      genuinely non-obvious (e.g. campaign ordering matters), prefer `@DisplayName` over a
      comment.
    - **Explicit types, not `var`** — e.g. `GameType gameType = RandomUtils.randomGameType();`.
      The package does not use `var` for test data declarations.
    - **Status codes** — activate/update (`updateStatus`) returns **204**, reads (GET)
      return **200**. Confirm from an existing test in the same package before asserting.
    - **STOP before writing — ask the user about site/table strategy:**
      > "For site and table prerequisites — use **static** (from `core.static-site-id` +
      > `CoreStaticTables.getStaticTableIdByGameType`) or **create new ones** via
      > `backofficeSiteSteps.createSite` + `coreTableFlows.createTable`?"
        - **Static** → requires `@Value("${core.static-site-id}")` and `CoreStaticTables`
          autowiring. No cleanup needed (always exist). Preferred for simple tests.
        - **Create new** → requires site/table flows (`BackofficeSiteSteps`,
          `CoreTableFlows`). Auto-cleanup via framework. Needed when the test
          must control table properties (gameType, etc.) or needs multiple distinct
          sites/tables beyond what static config provides.
        - **Do not guess** — wait for the user's answer before writing.
    - Create prerequisite entities (site, table, etc.) using existing flows/steps.
    - Perform the action under test.
    - Assert the response (status code, body fields).
    - Verify by reading back (GET the created entity and assert all relevant fields).
    - Use `assertThat(...).as("fieldName")` on each assertion.
    - **Chain instead of intermediate variables** — for a "create + verify" sequence call
      `flow.createAndGetXxx(...).verifyXxx(...)` in a chain, do not store the response in a
      local variable just to verify it (review feedback on `CreateGenericBrandingCampaignsTests`).
      Domain-specific checks (brandedTableName, empty sitesInfo, ...) go to separate
      `default` verify methods in `*Assertions`, then chain them:
      `flow.createAndGetGenericCampaign(...).verifyGenericCampaign(...).verifyBrandedTableNames(...)`.
    - **More than 2 assertions in a row → always `SoftAssertions`** (repo style) — code
      sample in [reference.md](reference.md#softassertions-pattern). 1–2 assertions stay
      plain `assertThat`.
    - **Hard-assert structural preconditions BEFORE indexing inside a soft block**
      (REVIEW.md) — if the block indexes a collection (`getFirst()`/`get(0)`), assert
      size/element presence **before** `assertSoftly`, then read the element into a local
      variable. An unchecked missing element throws `NoSuchElementException` instead of a
      readable assert report — the review bot flags this (real case:
      `verifyBlueScreenCampaign`). Prefer collection-style assertions
      (`extracting(...)`, `hasSize`, `first()`) where no indexing is needed; one soft
      scope per verify method. Code sample in
      [reference.md](reference.md#softassertions-pattern).

### Phase D2 — Validation / negative test classes (separate file)

When the task includes **negative / validation** cases, put them in a **separate
`*ValidationTests` class** — do NOT mix them into the positive CRUD class.

> **Parameterized positive cases (`@TestTemplate`)** — when several positive cases differ
> only by one boundary value (e.g. brandedTableName 1 char / 40 chars), merge them into a
> single `@TestTemplate` + `ContextProvider`:
> - Test method takes a plain value (`Integer length`), NOT a testcase record — pass the raw
>   value via `.value(length)` in the provider (review feedback).
> - Provider (`*ContextProvider implements BaseTestTemplateInvocationProvider`) returns a
>   stream of `buildTestContext(context).displayName(TEMPLATE, name).allureId(id).value(value)
>   .scopes(criticalTag()).environments([...]).build()`, one entry per Allure ID.
> - Do NOT put `@Tag`/`@AllureId`/`@DisplayName`/scope annotations on the `@TestTemplate`
>   method — they live in the provider.
> - Scope is per provider, not forced to critical — the BlueScreen streamId-length positives
>   (1 / 100 chars, AllureId per case) are smoke-scoped (`scopes(smokeTag())`) and keep
>   `CERTIFICATION`.

Rules for a validation test class:

- **Static prerequisites only** — do **not** create a site/table in `@BeforeEach`.
  Resolve them from static config instead:
    - Site id via `@Value("${core.static-site-id}")`.
    - Table id via the `CoreStaticTables` bean (`getStaticTableIdByGameType(...)`) — the
      per-gameType property keys are listed in [Tips](#tips).
- **No cleanup needed** — the request is rejected before any resource is created.
- **Shared request defaults** — keep a `static final` map of required payload (e.g. the
  valid asset keys) and a reusable base name field; each test only overrides the field
  it is targeting.
- **Valid-request factory** — when the same valid Generic/Dedicated/... request is rebuilt
  in every negative test, add a factory to the request POJO (e.g.
  `CreateBrandingCampaignRequest.validGenericBuilder(tableId, siteIds)`) that returns a
  `@Builder`-typed builder pre-filled with the valid defaults; each negative test then
  overrides only the field it targets (`.name(...)`, `.siteIds(List.of())`, `.tables(List.of())`,
  `.assets(...)`, ...). Do NOT merge the test scenarios themselves — only share the builder.
- **Type-specific builders bake the type contract** so a wrong field cannot be sent for a
  type (merged Physical MR): `validPhysicalBuilder(tableId)` and `physical(name, table)`
  omit `siteIds` entirely (Physical = `tableId` only; its GET then returns empty
  `sitesInfo`/`partnersInfo`/`assets`/`settings`). BlueScreen builders always carry a
  `streamId`. Give each campaign type its own factory instead of one generic builder with a
  type flag.
- **Each test** targets one validation rule. Assert the error body too (`String error = ...`
  → `.verifyErrorBody(error)`) when the message is deterministic; a few merged cases only
  check `.statusCodeIs400()` (e.g. an arbitrary key in BlueScreen `assets`/`settings`) —
  match the reviewed MR. Code sample in
  [reference.md](reference.md#validation-assertion-pattern).
- **Isolate the targeted rule** — build the request so ONLY the rule under test is
  violated; otherwise the expected error body depends on validation order and the test is
  brittle (real review feedback on `CreateBlueScreenCampaignsTests`). Common traps: using
  the same static tableId for two elements (the duplicate-value rule fires instead of the
  count rule) and leaving a nested required field null (e.g. `streamId`) while targeting
  the table-count rule. The count-rule test overrides `.tables(...)` with two **distinct
  active** tables — `coreTableFlows.createActivatedTable(gameType, siteId)` (BlueScreen:
  first table via `createSiteWithActiveTable`), each carrying a valid streamId — never
  reuse one static id.
- **"Without table -> 400" sends ONE table with a null `tableId`** (merged BlueScreen &
  Physical MRs) — `validXxxBuilder(null, ...)` → expect `"The TableId field is required."`.
  Do NOT switch to an empty `tables` list unless a live run proves the API fails on the
  count rule first. When the valid factory pre-fills a nested collection, override the whole
  collection (`.tables(List.of(...))`) to change it — example in
  [reference.md](reference.md#valid-request-factory-for-negative-tests).
- **`@DisplayName` names the field + expected status in plain words, no bracket prefixes** —
  `Create Physical campaign with siteIds -> 400`, `Create BlueScreen campaign with
  streamId 101 chars -> 400`. The merged MRs and all master brandingcampaigns tests drop
  `[BVA]`/`[DT]`/`[EP]`/`[EG]` prefixes.
- **Error body always goes to a local variable first** — assign the expected body to
  `String error = "..."` (or `expectedError`) **before** the call, then pass it:
  `.verifyErrorBody(error)`. Never inline the string literal in the call chain.
- **Error-body text patterns** in a validation class — see [Tips](#tips) (always confirm on
  first real run); default guesses are in
  [reference.md](reference.md#fluentvalidation-error-body-patterns).
- **`@DisplayName` naming** and **boundary naming** conventions — see
  [reference.md](reference.md#displayname-naming).
- **`@CriticalTag`** by default for validation cases (not `@SmokeTag`), unless the user says
  otherwise.

### Phase E — Build and verify

18. **Compile** — `mvn -pl api -am test-compile --no-transfer-progress -q`.
19. **Check for errors** — grep the output for `BUILD FAILURE`, `ERROR`, or `cannot find
    symbol`. Fix and recompile until clean.
20. **Verify compiled classes exist** — confirm `.class` files in `target/test-classes/`
    and `target/classes/` match the expected count.
21. **Format & code style** — after writing **every** test (and after every edit), format
    the file and bring it to the repo code style before reporting done:
    - 4-space indentation; aligned method/builder chains and annotation columns (match the
      surrounding files).
    - Ordered `@Tags({ ... })` columns and a consistent annotation order.
    - Imports: remove unused imports, no wildcard imports, alphabetically grouped and
      separated from `static` imports.
    - No trailing whitespace; a single blank line between members/methods.
    - Follow the same style as neighbouring test classes in the package — when in doubt,
      mirror an existing file rather than inventing a layout.

### Phase F — Review with the user

22. **Ask for the real Allure ID** if a placeholder was used.
23. **Confirm endpoint paths** if any were inferred rather than confirmed.
24. **Confirm response shapes** (status codes, enum serialization format) — adjust if the
    user reports different behaviour.
25. **Report open concerns** — any assumptions that need runtime verification.

---

## Refactoring existing tests

Used when the user asks to refactor / remove duplication in existing test classes.

1. **One class at a time** — the user picks the class; do not touch other test classes in
   the same pass. Report cross-class duplication you noticed as a follow-up suggestion.
2. **Analyse first** — list the duplicated blocks inside the class, then grep the package
   (`grep -c` over `core/backoffice/<domain>/*.java`) to see whether the same code is
   copy-pasted across classes. Repo-wide duplication → extract to `api/src/main`
   (factories/flows); class-only duplication → private helper in the test class.
3. **Reuse before creating** — search `flows/` and `pojo/` for an existing method first;
   prefer adding an **overload** to an existing flow over a new class. If a Response /
   assertions for the operation already exists (in its root or an operation folder), reuse
   or extend it — do not rebuild the `create/`+`get/` layout over it.
4. **Preserve test semantics** — don't change what the test verifies. Example: a test that
   activates two tables in one batch (`activateTablesOnSite`) must stay batched, even if
   `createActivatedTable` ×2 would look shorter. Call out any semantic change explicitly.
5. **Near-identical tests** (e.g. BVA pair differing only by one value) → collapse bodies
   into one `createAndVerify...(value)` helper, keeping separate `@Test` methods with their
   own Allure IDs. Converting to `@TestTemplate` + `ContextProvider` only on request — and
   then pass the raw value (`.value(length)`), not a testcase record (review feedback).
6. **Compile** (`mvn -pl api -am test-compile`), remove unused imports/fields, report what
   was extracted where and any behaviour differences (names, random data, call order).

### Where to put extracted code

| What is duplicated                          | Where it goes                                                                                                              | Example                                                                                                                                                                    |
|---------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Request building (builder chains)           | `public static` factory on the request record/class in `pojo/`                                                             | `CreateBrandingCampaignRequest.generic(name, siteIds, tables)`, `BrandingCampaignTable.of(tableId[, brandedTableName])`, cf. `CreateTableRequest.of(...)` |
| Default payload constants used by factories | `public static final` on the request POJO                                                                                  | `GenericAssets.GENERIC_ASSET_KEYS`                                                                                                                                        |
| "call step → assert status → unwrap body"   | private helper **on the domain flow** when shared across tests; private helper in the test only for one-off orchestration | `BrandingCampaignsFlows.createAndGetCampaign(request)` → create 201 → `body().campaignId()` → get 200; public wrapper `createAndGetGenericCampaign(...)` |
| Verify a response                           | `*Assertions` interface next to the response (default method on `getSelf()`)                                               | `brandingCampaign.verifyGenericCampaign(name, siteIds, tables, assets)`                                                                                                  |
| Site + activated table                      | existing `CoreSiteTableRelationFlows.createSiteWithActiveTable(folderId, gameType)` → `SiteTableRelation(siteId, tableId)` |                                                                                                                                                                            |
| Table + activation on a site                | existing `CoreTableFlows.createActivatedTable(gameType, siteId)`                                                           |                                                                                                                                                                            |
| Random names / values                       | `common/.../utils/random/RandomUtils` + prefix in `common/.../constants/PrePostfixes`                                      | see below                                                                                                                                                                  |
| Test-specific create+verify                 | private helper in the test class                                                                                           | `createAndGetCampaign(request)`, `createAndVerify...(value)`                                                                                                               |

- Flows are for shared multi-step orchestration; a create→unwrap→get sequence **is** a valid
  flow method when several tests use it (mirror `BrandingCampaignsFlows`): public
  `createAndGetXxx(...)` wrapper + private `createAndGetCampaign(request)` body.
- Steps keep returning `RestResponse`; if a flow exists, it returns domain values.
- Code comments in qa-tests-v2 are in **English** (repo style), 1–2 lines, explain "why".
  **No step-narration comments** in test method bodies (`// 1. Create site`) — see Phase D →
  step 17: group logical blocks with blank lines instead, and prefer `@DisplayName`.

---

## Random test data

- **Names/strings** — use a `RandomUtils.randomXxx()` generator. If none fits, add:
    1. a prefix constant to `PrePostfixes` (`X_AT_<ENTITY>_` style), e.g.
       `BRANDED_TABLE_NAME_PREFIX = "X_AT_BRANDED_TABLE_"`;
    2. a generator in `RandomUtils`: `return PREFIX + RandomStringUtils.randomNumeric(10);`
       (e.g. `randomBrandedTableName()`).

    - Campaign names use the existing `RandomUtils.randomCampaignName()` (→ `CAMPAIGN_PREFIX`,
      `X_AT_CAMPAIGN_`) — do not build `"Test X Campaign " + System.currentTimeMillis()`.
    - Stream ids use the existing `RandomUtils.randomStreamId()`.
    - Check the backend max length (e.g. campaign name ≤ 200, brandedTableName ≤ 40) — the
      generated value must fit.
    - Don't reuse an existing prefix that belongs to another domain (`BRANDING_PREFIX` —
      `randomBranding()`, `BRANDING_CAMPAIGNS_PREFIX` — legacy GraphQL/v2 campaigns).
    - Boundary values stay explicit (`"a"`, `RandomStringUtils.randomAlphabetic(40)`).
- **GameType** — when the test doesn't depend on a specific game, don't hardcode
  `GameType.BACCARAT`; use the generator
  `RandomEnumUtils.randomValue(GameType.getLiveCasinoGameTypes())`.
  `private static final` = one value per class/run; a plain instance field = new value per
  test (JUnit per-method lifecycle). **Preferred: declare the field and initialize it in
  `@BeforeEach`** (mirror `CreateGenericBrandingCampaignsTests.setUp()`) so each test
  exercises a fresh value.
- **Asset/param key lists** — when a payload takes a fixed set of keys (e.g. generic
  campaign assets `Loading/Desktop/Mobile`), model them as `static final List<String>`
  on the POJO (e.g. `GenericAssets.GENERIC_ASSET_KEYS`), generate values with a
  `random()` factory from those keys, and reuse the list in validation (e.g. building a
  map missing one key) instead of hardcoding `Map.of(...)` in each test.

---

## Cleanup — framework-managed (do NOT hand-roll)

- `BaseTest.cleanUp()` runs in `@AfterEach` automatically, delegating to
  `CleanUpHandlerService`, which iterates all beans that `extend CleanUpHandler`
  (sorted by `getPriority()`).
- **How to hook into cleanup:** make the Steps class `extends CleanUpHandler`, and in the
  create method call `register(id, this::delete)` after a successful response. Then the
  test needs **no** `@AfterEach` for those entities.
- **Preferred style — `keepCreatedX(id)` helper:** mirror `BackofficeSiteSteps.keepCreatedSite`:
  `create` calls `keepCreatedCampaign(response.body().campaignId())` on 201, and the helper
  does `register(id, campaignId -> hardDelete(List.of(campaignId)).statusCodeIs204())`.
  Assert the delete status inside the cleanup lambda — otherwise a failed delete is silently
  treated as success and the entity leaks on the env.
- **String id from a raw response body:** the body of a `RestResponse<String, ...>` is the
  **raw HTTP string including quotes** (`"abc123"`). Do NOT use `.replace("\"", "")` and do
  NOT parse with `ObjectMapper`. Use the repo's `StringResponse` wrapper pattern:
  `sendRequestAndWrapString(...)` + a `StringResponse` subclass that strips quotes with
  `StringUtils.substringBetween(data(), "\"")` — see
  [reference.md](reference.md#stringresponse-id-wrapper).
- **Batch delete with a body:** if the delete endpoint takes a list of ids in the body
  (e.g. hard-delete), create a small request DTO for that body and expose a
  `delete(List<id>)` step. Register each created id against `delete(List.of(id))`.
- **Priority:** override `getPriority()` so the child entity is deleted before its parent
  (lower priority = deleted first). Reuse the existing priority constants
  (`CORE_TABLE_PRIORITY`, `CORE_SITE_PRIORITY`, …).
- **Sites/tables created via flows** already register themselves for cleanup — do not
  manually delete them.

---

## Tips

- **Site/table strategy — ALWAYS ask before writing** — ask the user for every test that
  needs a site or table (static vs create new). Full rules in Phase D → step 17. Never
  assume one approach over the other.
- **Error-body text patterns** — always confirm on first real run. Use the existing tests
  in the same domain as reference for exact FluentValidation message formats. Default-guess
  patterns: [reference.md](reference.md#fluentvalidation-error-body-patterns).
- **Static tables are per-gameType** — `CoreStaticTables.getStaticTableIdByGameType(GameType.X)`
  reads from `application-*.properties` (`core.static-table.<game>-table-id`).
- **Static sites** — `@Value("${core.static-site-id}")` is available in every environment
  (`application-*.properties`). There is also `core.mock-static-site-id` for a second site.
  **Caveat:** some environments lack the static site/table properties — e.g.
  `core.static-site-id` is NOT present in `application-certification.properties`. If a test
  depends on a static resource that does not exist on an env, drop `@Tag(CERTIFICATION)`
  from that test's env set rather than failing at context load.
- **Cleanup is automatic** for entities created via factory flows — see
  [Cleanup](#cleanup--framework-managed-do-not-hand-roll). Do not hand-roll `@AfterEach`.
- **`bootstrap.properties` is ignored** — never commit or stage it.

---

## TODO — team data to fill incrementally

- [ ] Roster / roles / reviewers (if any besides the owner).
- [ ] Who assigns Allure ID ranges and the process.
- [ ] `knowledge-map` local path and service repo local paths.
- [ ] Team-specific environment matrix.
