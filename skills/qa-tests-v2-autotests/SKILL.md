---
name: qa-tests-v2-autotests
description: >-
  Writes/extends CORE API autotests in qa-tests-v2 (test classes, Steps, Flows,
  providers, tags). Always asks new branch vs existing before coding; commits/
  pushes only on explicit approval. Use when a task matches the CORE QA
  test-writing flow.
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

Tags live in tag-constant classes and are imported statically — never hardcode tag strings.
Common CORE area tags live in `CoreTags`; service/entity tags live in
`core/consts/tags/<service>/Core<Service>Tags`. When a **new test class** has no fitting
subtype tag, add the constant to the matching tag class first.
Standard `@Tag` set, column formatting and the no-`FEATURE_*` rule — see
[reference.md](reference.md#standard-tag-set).

Decision rules unique to this skill:

- **Entity-type test classes each get a new type tag** — a distinct entity/subtype carries its
  own tag `<TYPE>_<DOMAIN>` (camelCased value) alongside the component tags. **Add one new
  type-tag constant to the matching tag class**; do not reuse another entity's tag.
- **Env set follows the folder convention** — if every method in the target folder runs
  certification (the BackOffice branding folder does), positives and `@CriticalTag`
  validations all use `{CERTIFICATION, PREPROD, RELEASE, LATEST, CORE_QA}`. Elsewhere
  `@CriticalTag` validation methods drop `CERTIFICATION`: `{PREPROD, RELEASE, LATEST, CORE_QA}`.
  Check neighbouring classes before choosing.
- **Subtype test classes** use the shared component tags of the area
  (`{<COMPONENT>, <COMPONENT>_<VERSION>, <AREA>}`) plus their subtype tag.
- **State-specific operation classes get an operation+state+type tag** — constant
  `<OPERATION>_<STATE>_<TYPE>_<DOMAIN>` with a camelCased value in the matching tag class; the
  class carries the shared component tags plus this tag (no separate subtype tag). `@Feature`
  path: `"API | {Service} | {version} | {Feature} | <Type> <entity> | <Operation> | <State>"`.
  Template/example: [reference.md](reference.md#state-dependent-operation-tests).

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
6. **Search for existing tests** (`core/<service>/<domain>/`) — what test structure is
   already established for this feature? What base class is used? What tags?

### Project structure (canonical CORE feature layout)

Template for a new CORE feature (BackOffice uses `backoffice` as `<service>`; the flows
package keeps its historical `backOffice` casing). Concrete example tree:
[reference.md](reference.md#project-structure-examples).

```
api/src/main/java/live/winfinity/at/
├── core/enums/<domain>/                         # <Entity>Status, <Entity>Type, <Payload>Keys (CAPS + @JsonValue)
├── core/dto/<service>/                          # <Entity>IdResponseWrapper (StringResponse)
├── core/gateway/pojo/<service>/<domain>/        # POJOs split by operation
│   ├── create/
│   │   ├── Create<Entity>Request                # record + @Builder + static factories
│   │   └── nested/                              # shared nested DTOs
│   ├── get/
│   │   ├── <Entity>Response                     # record + implements <Entity>Assertions + getSelf()
│   │   └── assertions/<Entity>Assertions        # interface extends ObjectAssertions<T>
│   ├── update/Update<Entity>Request
│   └── harddelete/HardDelete<Entity>Request
├── core/gateway/steps/<service>/<domain>/       # <Entity>s[V<N>]Steps → RestResponse, keepCreated<Entity> cleanup
├── core/gateway/flows/<service>/<domain>/       # <Entity>sFlows → domain values (createAndGet<Type><Entity> + private createAndGet<Entity>)
├── core/params/<service>/<domain>/              # <Query>Params (QueryParamsConverter) for GET endpoints
api/src/test/java/live/winfinity/at/core/<service>/<domain>/[<operation>/]
└── <Operation><Type><Entity>sTests              # @Feature("API | <Service> | <version> | <Feature>")
```

### Versioned Steps and Flows

When a new API version is introduced (e.g. v6), create **versioned** Steps and Flows classes
under a version subfolder — do not add methods to the existing unversioned class:

- Steps: `core/gateway/steps/<service>/<version>/<Service><Version>Steps.java`
- Flows: `core/gateway/flows/<service>/<version>/<Service><Version>Flows.java`

Reviewer-approved pattern. The version subfolder avoids
bean-name collisions and keeps each API version's infrastructure isolated.

**When two versions of the same endpoint coexist (reviewer rules):**

- **One Steps class per version** — split `v1` and `v2` into separate classes/packages
  (`steps/<service>/v1/<Service>V1Steps`, `steps/<service>/v2/<Service>V2Steps`). Do NOT keep both
  versions in one class with per-method `version` parameters or `*V2` method-name suffixes —
  the reviewer rejects both.
- **Version lives in `BASE_PATH`**, not as a method argument:
  `private static final String BASE_PATH = "/<service>/api/v1";` (and `.../v2` in the v2 class).
  Truly unversioned endpoints keep their own path constant.
- **Tests are versioned by package, not by class name** — put v1 tests under
  `core/<service>/<domain>/v1/` and v2 tests under `.../v2/`. The test class name carries NO
  version token: `<domain>/v2/<Feature>Tests` (NOT `<Service>V2<Feature>Tests`).
- **`@Feature` uses lowercase version**: `@Feature("API | <Service> | v2 | <Feature>")`
  (lowercase `v1`/`v2`, not `V1`/`V2`).
- A v2 test that still needs a shared read-only step autowires
  the v1 Steps class separately for that call — the common read endpoint stays in the v1 class.
- **MR title** — when an automation ticket exists for the test work, use it in the MR name
  (reviewer asks for the automation task, not just the feature ticket).

Key conventions (from merged MRs):

- **Create+get orchestration goes to a flow** — public `createAndGet<Type><Entity>(...)` wraps
  create→201→unwrap→get→200; the shared body lives in a **private `createAndGet<Entity>(request)`
  helper on the same flow** (not in the test).
- **Tests call the flow**; `verify<Type><Entity>(...)` lives on the response
  (assertions interface), not on the flow.
- Request/response POJOs live under operation-scoped folders (`create/` for the request +
  `create/nested/`, `get/` for the GET response, delete payloads under `harddelete/`).
  This `create/`+`get/` split is the canon for a **new** domain, not a requirement to
  restructure an existing one — other domains keep Response+assertions in their root or in
  an operation-named folder (`get<entity>/assertions/`).
- **Nested DTOs live once under `create/nested/` and are shared** — the GET response imports
  them from `create.nested` rather than redeclaring them.
- Enums and key constants live under `core/enums/<domain>/`.
- **Dynamic API-provided configuration**: when valid request keys come from an API response
  rather than a fixed enum, extend the response DTO first (`<Config>` → nested `<ConfigItem>`)
  and build payload maps from that data; do not hardcode environment-dependent key lists in
  tests. Example: [reference.md](reference.md#api-driven-payload-configuration).

### Phase C — Build infrastructure (bottom-up: POJOs → Steps → Test)

Create in dependency order — compile after each layer, not only at the end.

7. **POJOs first** — create enums, request DTOs, response DTOs, and any nested objects.
    - Enums: constants are **CAPS** (`<CONSTANT>`); if the backend serializes by value, add a
      `value` field + `@JsonValue` (`<CONSTANT>("<Value>")`) and a `@Getter` — mirror an
      existing serialized enum in `core/enums/`. Never name constants like the serialized value.
      Example: [reference.md](reference.md#enum-constants).
    - **Package layout for a feature:** domain enums under `core/enums/<domain>/`;
      request/response POJOs by operation into `pojo/<service>/<domain>/create/`,
      `.../create/nested/`, `.../get/` (response + `get/assertions/`), `.../harddelete/`, …;
      the raw-id response wrapper (a `StringResponse` subclass) under `core/dto/<service>/`.
    - Requests: use `record` with `@Builder` (Lombok). Prefer existing patterns in the
      codebase.
    - Responses: use `record`. Match field names and structure to the backend response
      shape (the C# `*Response` class).
    - Nested records for arrays of objects in the response — put them in the `nested/`
      sub-package.
    - **Assertions for a response:** create an interface
      `<Entity>Assertions extends ObjectAssertions<<Entity>Response>` next to the response
      (`.../get/assertions/`), with `default` verify methods that pull `getSelf()`; the response
      record `implements` it and returns `this` from `getSelf()`. Call verifies on the response
      instance: `<entity>.verify<Type><Entity>(...)`.
8. **Steps second** — create a `@Component` step class with methods for each endpoint.
    - Steps call APIs directly and return `RestResponse`; flows/factories orchestrate multiple
      steps and return domain objects.
    - Use `RestClient` + `HttpRequest.builder()`.
    - Pick the correct REST client overload by response shape — see
      [reference.md](reference.md#rest-client-overloads).
    - Inject `${haproxy.url}` + the RestClient.
    - Use `@Step("Core: ...")` or `@Step("Core V<N>: ...")` for Allure reporting — match
      the version if the Step class is versioned.
    - Match the endpoint path to the controller name (ask the user to confirm).
    - **Query params** for GET endpoints, **body** for POST/PUT/DELETE.
    - **QueryParamsConverter for GET params** — when a GET endpoint takes query parameters,
      create a `Params` class implementing `QueryParamsConverter` with a static `.of()`
      factory under `core/params/<service>/<domain>/`. Use `.objectQueryParams(params)` in
      `HttpRequest.builder()`. See [reference.md](reference.md#queryparamsconverter-pattern).
    - If an endpoint takes a body on DELETE (e.g. batch-delete with a list of IDs), create
      a small request DTO for that body — do NOT use query params.
    - **Create steps return the raw-id wrapper** (`RestResponse<<Entity>IdResponseWrapper, String>`
      via `sendRequestAndWrapString(...)`), see
      [reference.md](reference.md#stringresponse-id-wrapper).
    - **Bean-name collisions:** Spring names beans from the simple class name, so a new
      `@Component` must not duplicate any existing class name in the repo — even in
      another package. Before creating, run `find api/src -name "<Name>.java"`; on
      collision disambiguate with a version suffix (`<Entity>sSteps` → `<Entity>sV<N>Steps`).
      POJO records/enums are not beans and do not collide.
      Example: [reference.md](reference.md#bean-name-collision-check).

### Phase D — Write the test class

9. **Placement** — package under `core/{service}/<domain>/`, where `{service}` is the
   service name from the task or GitLab; an operation subfolder (`create/`, `update/`) when
   the domain already uses one. Class name ends with `Tests`.
10. **Class-level annotations** — `@Tags` (component area tags), `@AllureComponentCore`,
    `@Feature("API | {Service} | {version} | {Feature}")` — include the API version when
    the Steps/Flows are versioned; deeper levels add `| <Type> <entity> | <Operation> | <State>`
    when the domain splits classes that way.
11. **Extend `BaseApiTest`** — provides Spring context, cleanup, and the `api` JUnit tag
    via `@AllureLayerApi`.
12. **Inject dependencies** — `@LazyAutowired` (never `@Autowired`), `@Value("${<property>}")`
    for configured ids (folders, static sites).
13. **Constants and helpers** — extract repeated data (e.g. required payload maps for
    validation) to `static final` fields. Request construction goes to **static factories
    on the request POJO** (see [Where to put extracted code](#where-to-put-extracted-code));
    class-local orchestration goes to private helpers.
    - **Test data is random, never hardcoded** — see [Random test data](#random-test-data).
    - **Per-test random state goes to `@BeforeEach`**, not to `final` instance fields —
      declare the field, initialize it in `setUp()` (e.g. a random game type, a random entity
      name). Keeps each test fresh under `PER_METHOD`.
    - **Constants are first in the class** — `private static final ...` fields (e.g. a fixed
      `GAME_TYPE`) go before injected fields (review feedback).
14. **State** — use `List<String>` for IDs that need manual cleanup. Instance fields for
    the entities created in `@BeforeEach` (if applicable).
15. **Cleanup** — `@AfterEach` method: call the batch-delete step for the accumulated
    IDs, wrapped in try/catch (some may already be deleted by the test itself). Entities
    created through framework-managed flows clean up automatically — see
    [Cleanup](#cleanup--framework-managed-do-not-hand-roll).
16. **Each test method** — follow the strict annotation order
    ([reference.md](reference.md#test-method-annotation-order)).
17. **Test method body** — follow the step-by-step orchestration the user described:
    - **No step-narration comments** — do NOT write `// 1. Create <x>`, `// 2. Get <y>` etc.
      The user explicitly rejects them. Group logical blocks with a blank line instead
      (package convention). If a reason is genuinely non-obvious, prefer `@DisplayName` over a
      comment.
    - **Explicit types, not `var`** — `<Type> <name> = ...;`.
      The package does not use `var` for test data declarations.
    - **Reference types, not primitives** — all variables and parameters use wrapper/reference
      types (`Integer`, `Long`, `Boolean`, `Double`, …), never primitives (`int`, `long`,
      `boolean`, `double`, …). Applies to local variables, method/constructor parameters, and
      fields across tests, Steps, Flows, and POJOs — `Integer`, not `int`; `Boolean`, not
      `boolean`.
    - **Do not add a private helper for a single existing flow call.** If a prerequisite can be
      created by an existing flow with all required arguments, call it directly at the usage site
      instead of wrapping it in a local helper.
    - **Multiline `.formatted(...)` strings need parentheses around the whole concatenation** —
      otherwise Java applies `.formatted()` only to the last string literal. See
      [reference.md](reference.md#multiline-formatted-strings).
    - **Status codes** — status transitions/updates usually return **204**, reads (GET)
      return **200**. Confirm from an existing test in the same package before asserting.
    - **STOP before writing — ask the user about site/table strategy:**
      > "For site and table prerequisites — use **static** (configured static site id + the
      > static-tables bean by game type) or **create new ones** via the site/table flows?"
        - **Static** → `@Value` of the static site property + the static-tables bean. No
          cleanup needed (always exist). Preferred for simple tests.
        - **Create new** → existing site/table steps & flows. Auto-cleanup via framework.
          Needed when the test
          must control table properties (gameType, etc.) or needs multiple distinct
          sites/tables beyond what static config provides.
        - **Configured partner site + fresh table** — site id from the partner properties
          bean, table created and activated on it by the existing table flow. Used when each
          test mutates its own entity/table but needs only one site; switch to the
          site+table relation flow when the scenario needs a second site.
        - **Do not guess** — wait for the user's answer before writing.
    - **Session-based tests** — when the test needs a player session (game rounds, Kafka
      messages, player stats), start one through the existing player flow — it auto-selects a
      static table for the game type and is lighter than creating site+table infrastructure.
      Example: [reference.md](reference.md#session-based-tests-kafka--game-rounds).
    - Create prerequisite entities (site, table, etc.) using existing flows/steps. When the
      entity requires a specific table attribute (e.g. lobby category) that static tables do
      not cover, create a fresh site/table relation with that attribute — otherwise negative
      tests fail during setup instead of exercising the API.
    - Perform the action under test.
    - Assert the response (status code, body fields).
    - Verify by reading back (GET the created entity and assert all relevant fields).
    - **Asynchronous / eventually-consistent endpoints** — when the result depends on async
      processing (Kafka consumption, cache invalidation), use **Awaitility** to poll.
      Put the wait logic in a Flow method, not in the test. Two patterns:
      - **`until()`** — poll until a condition becomes true (e.g. response contains expected
        data). See [reference.md](reference.md#awaitility-patterns).
      - **`during()`** — wait for a settle window where the condition stays true continuously
        (e.g. a zero-bet round must NOT appear, and we need to wait long enough to be sure
        the message was consumed). See [reference.md](reference.md#awaitility-patterns).
      Avoid `Predicate`, `AtomicReference`, and complex helper state — keep the `until()`
      lambda inline and simple (review feedback).
    - **Kafka-message-based tests** — when the action-under-test is sending Kafka messages
      through the statistic flows rather than calling REST endpoints, extract message-sending
      logic into **private helpers on the test class** — `send<GameKind><Message>With<Condition>(session)`.
      Keep each helper focused on one message type; live-game rounds require a start message
      before finish/cancel (the game loop is Start→Finish/Cancel).
    - Use `Assertions.assertThat(...).as("fieldName")` on each assertion in test classes;
      import `org.assertj.core.api.Assertions` — do not static-import `assertThat`. Same in
      Flows (`Assertions.assertThat(...)`, no static import).
    - **Chain instead of intermediate variables** — for a "create + verify" sequence call
      `flow.createAndGetXxx(...).verifyXxx(...)` in a chain, do not store the response in a
      local variable just to verify it. Same for wait→verify chains:
      `flow.waitXxxContains(...).verifyXxxContains(...)`. Domain-specific
      checks go to separate `default` verify methods in `*Assertions`, then chain them.
    - **Method chain formatting** — align continuation methods under the object they chain on.
      When the call starts with a flow/step field, break after the field and indent methods:
      `<x>Flows\n        .waitXxx(...)`. For return chains in Steps/Flows:
      `return <x>Steps.<call>(...)\n                    .statusCodeIs200()\n                    .body()\n                    .<field>();`
      (review feedback).
    - **More than 2 assertions in a row → always `SoftAssertions`** (repo style); in test
      classes 1–2 stay `Assertions.assertThat`. Soften-assertion and structural-precondition
      rules with code samples — [reference.md](reference.md#softassertions-pattern). Key points: assert
      size/element presence **before** indexing (`getFirst()`/`get(0)`) inside a soft block;
      prefer collection-style assertions (`extracting(...)`, `hasSize`, `first()`) where no
      indexing is needed; one soft scope per verify method.

### Phase D2 — Validation / negative test classes (separate file)

When the task includes **negative / validation** cases, put them in a **separate
`*ValidationTests` class** by default — do NOT mix them into the positive CRUD class. If you are
extending an existing reviewed class/package that already intentionally keeps positives and
validation together, preserve that local style instead of splitting without request.

> **Parameterized positive cases (`@TestTemplate`)** — when several positive cases differ
> only by one boundary value, merge them into a single `@TestTemplate` + `ContextProvider`.
> The test method takes a plain value (`Integer length`), NOT a testcase record — pass the raw
> value via `.value(length)`. Provider (`*ContextProvider implements
> BaseTestTemplateInvocationProvider`) owns `@DisplayName`/`@AllureId`/scope/env — put NO
> `@Tag`/`@AllureId`/`@DisplayName` on the `@TestTemplate` method. Scope is per provider, not
> forced to critical (see [reference.md](reference.md#parameterized-positive-cases-testtemplate)).

Rules for a validation test class:

- **Static prerequisites only** — do **not** create a site/table in `@BeforeEach`. Static
  site via `@Value`, table via the static-tables bean (see [Tips](#tips)). **No cleanup needed** —
  the request is rejected before any resource is created.
- **Shared request defaults** — keep a `static final` map of the valid payload and a reusable
  base name; each test overrides only the field it targets.
- **Valid-request factory** — when negative tests rebuild the same valid request, add a
  `validXxxBuilder(...)` factory to the request POJO; each test then overrides just one field.
  Do NOT merge the scenarios — only share the builder. Type-specific builders bake the type
  contract (a type without sites omits `siteIds`, a type that needs a nested attribute always
  sets it) — give each type its own factory. Code:
  [reference.md](reference.md#valid-request-factory-for-negative-tests).
- **Each test targets one validation rule.** Assert the error body too
  (`String error = ...` → `.verifyErrorBody(error)`) when the message is deterministic; a few
  merged cases only check `.statusCodeIs400()`. Code sample:
  [reference.md](reference.md#validation-assertion-pattern).
- **Missing lookup data must fail with a useful exception** — no bare `.orElseThrow()`. Put
  `String error = "... %s.".formatted(value)` immediately above the stream and use
  `.orElseThrow(() -> new QaWinfinityException(error))`.
- **Isolate the targeted rule** — build the request so ONLY the rule under test is violated
  (e.g. a count-rule test uses two **distinct active** items, never one reused static id; a
  nested required field must not be left null, else the duplicate/NotEmpty rule fires first).
- **"Without <item> -> 400" sends ONE item with a null id** — `validXxxBuilder(null, ...)`.
  Do NOT switch to an empty list unless a live run proves the count rule fires first.
- **Error body always goes to a local variable first** — assign it to `String error = "..."`
  **before** the call; never inline the literal in the chain.
  If the method already has another setup error variable, name the assertion message
  `expectedError`.
- **`@DisplayName`** names field + expected status in plain words, no `[BVA]`/`[DT]`/`[EP]`
  prefixes — see [reference.md](reference.md#displayname-naming). Error-body text patterns:
  [Tips](#tips) + [reference.md](reference.md#fluentvalidation-error-body-patterns).
- **`@CriticalTag`** by default for validation cases (not `@SmokeTag`), unless the user says
  otherwise.
- **Duplicate-value tests must really duplicate** — the same id twice (`List.of(id, id)`),
  never two different ids (a non-existent id fails for another reason).

### Phase D3 — State-dependent operation tests (entity in a non-initial state)

Applies when an operation (e.g. update) behaves differently depending on the entity state
(e.g. Draft vs Active). Template + example: [reference.md](reference.md#state-dependent-operation-tests).

- **One class per state × type** — `<Operation><State><Type><Entity>sTests`; positives
  (`@SmokeTag`) and negatives (`@CriticalTag`) live together, matching neighbouring classes of
  the same operation.
- **Bringing the entity into the state goes to a flow** — public
  `create<Transition>AndGet<Type><Entity>(...)` (random name/payload inside) delegating to a
  shared private `create<Transition>AndGet<Entity>(request)`: create → assert id → status
  transition → get. Never repeat create + transition in tests. Tests take `id`, `name` and the
  payload from the returned response.
- **Status-aware verify** — public `verify<State><Type><Entity>(...)` wrappers delegate to one
  **private** interface method `verify<Type><Entity>(..., <Status> status)`; the private method
  has no state in its name. Rename existing callers in the same MR.
- **Isolate the rule against the live entity** — in every negative request keep ALL fields of
  the created entity (name, payload, nested items with all their attributes) and change only
  the field under test. `*Builder` factories that randomize name/payload/nested values break
  other state rules at once and make the test depend on validation order — prefer the full
  factory fed with the response values; if a builder is unavoidable, override the fields back
  to the originals.
- **Count rules** — keep existing items unchanged and make the added item fully valid, so only
  the count rule fires.
- **Validator-level rules are state-agnostic** (`must not be empty`, `must be null`,
  duplicates) — they fire before the state check and only duplicate the initial-state class.
  Add them only when the TestOps cases prescribe them; ask the user otherwise.
- **Naming** — method `<operation><State><Type><Entity><Scenario>` (positives) /
  `...<Scenario>CheckError` (negatives); `@DisplayName("<Operation> <State> <Type> <entity>:
  <scenario>[ and check error]")`. The method name must describe the actual scenario. One rule =
  one test: drop a test whose trigger and error duplicate another one.

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
    - No trailing whitespace; a single blank line between members/methods; **no blank line
      before the class's closing `}`** and a newline at end of file (REVIEW.md, bot review).
    - **No commented-out tests** — finish the test or delete it (open a Jira task if the API
      behaviour is pending). Remove fields/`@BeforeEach` init that no test uses anymore.
    - Follow the same style as neighbouring test classes in the package — when in doubt,
      mirror an existing file rather than inventing a layout.
    - No primitive types left in variables/parameters/fields — confirm every `int`/`long`/
      `boolean`/`double`/… was written (or converted) as its reference-type counterpart.

### Phase F — Review with the user

22. **Ask for the real Allure ID** if a placeholder was used — `@AllureId("0")` must not reach
    the MR review (REVIEW.md requires a valid id per test; the bot marks it `[important]`).
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
   (`grep -c` over `core/<service>/<domain>/*.java`) to see whether the same code is
   copy-pasted across classes. Repo-wide duplication → extract to `api/src/main`
   (factories/flows); class-only duplication → private helper in the test class.
3. **Reuse before creating** — search `flows/` and `pojo/` for an existing method first;
   prefer adding an **overload** to an existing flow over a new class. If a Response /
   assertions for the operation already exists (in its root or an operation folder), reuse
   or extend it — do not rebuild the `create/`+`get/` layout over it.
4. **Preserve test semantics** — don't change what the test verifies. Example: a test that
   activates two items in one batch call must stay batched, even if two single-item calls
   would look shorter. Call out any semantic change explicitly.
5. **Near-identical tests** (e.g. BVA pair differing only by one value) → collapse bodies
   into one `createAndVerify...(value)` helper, keeping separate `@Test` methods with their
   own Allure IDs. Converting to `@TestTemplate` + `ContextProvider` only on request — and
   then pass the raw value (`.value(length)`), not a testcase record (review feedback).
6. **Compile** (`mvn -pl api -am test-compile`), remove unused imports/fields, report what
   was extracted where and any behaviour differences (names, random data, call order).

### Where to put extracted code

| What is duplicated                          | Where it goes                                                                                         | Template                                                                                       |
|---------------------------------------------|-------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Request building (builder chains)           | `public static` factory on the request record/class in `pojo/`                                        | `Create<Entity>Request.<type>(...)`, `<Nested>.of(id[, attr])`                                 |
| Default payload constants used by factories | `public static final` on the request POJO                                                             | `<Payload>.<PAYLOAD>_KEYS`                                                                     |
| "call step → assert status → unwrap body"   | private helper **on the domain flow** when shared; private helper in the test only for one-offs      | public `createAndGet<Type><Entity>(...)` → private `createAndGet<Entity>(request)`             |
| Verify a response                           | `<Entity>Assertions` interface next to the response (default method on `getSelf()`)                   | `<entity>.verify<Type><Entity>(...)`                                                           |
| Same verify for different entity states     | public `verify<State><Type><Entity>` wrappers → **private** interface method `verify<Type><Entity>(..., status)` | `verify<State>Xxx(...)` → `verifyXxx(..., <Status>.<STATE>)`                         |
| Create entity in a non-initial state        | public flow method + shared private helper on the flow                                                | `create<Transition>AndGet<Type><Entity>(...)` → private `create<Transition>AndGet<Entity>(request)` |
| Site + activated table / table on a site    | existing site/table flows (search `core/gateway/flows/` before writing)                              |                                                                                                |
| Random names / values                       | `RandomUtils` + prefix in `PrePostfixes`                                                              | `RandomUtils.random<Entity>Name()`                                                             |
| Test-specific create+verify                 | private helper in the test class                                                                      | `createAndVerify<Entity>With<Value>(value)`                                                    |
| Kafka message-sending scenarios             | private helpers in the test class (one per message type)                                              | `send<GameKind><Message>With<Condition>(session)`                                              |
| Awaitility wait logic                       | public method **on the domain flow**                                                                  | `wait<Thing>Contains(...)`, `wait<Thing>DoesNotContain(...)`                                   |

Concrete examples per row: [reference.md](reference.md).

- Flows are for shared multi-step orchestration; a create→unwrap→get sequence **is** a valid
  flow method when several tests use it: public `createAndGet<Type><Entity>(...)` wrapper +
  private `createAndGet<Entity>(request)` body.
- **Awaitility wait methods also belong in Flows** — they orchestrate step calls with polling
  logic and return the domain response. The test calls the flow and chains assertions.
- Steps keep returning `RestResponse`; if a flow exists, it returns domain values.
- Code comments in qa-tests-v2 are in **English** (repo style), 1–2 lines, explain "why".
  **No step-narration comments** in test method bodies (`// 1. Create <x>`) — see Phase D →
  step 17: group logical blocks with blank lines instead, and prefer `@DisplayName`.

---

## Random test data

- **Names/strings** — use a `RandomUtils.random<Thing>()` generator. If none fits, add:
    1. a prefix constant to `PrePostfixes` (`<THING>_PREFIX = "X_AT_<THING>_"`);
    2. a generator in `RandomUtils`: `return <THING>_PREFIX + RandomStringUtils.randomNumeric(10);`.

    - Reuse the existing generator for the entity — do not build
      `"Test X " + System.currentTimeMillis()`.
    - Check the backend max length — the generated value must fit.
    - Don't reuse an existing prefix that belongs to another domain/legacy API.
    - Boundary values stay explicit (`"a"`, `RandomStringUtils.randomAlphabetic(<N>)`).
- **Enum-typed data (e.g. game type)** — when the test doesn't depend on a specific value,
  don't hardcode one; use `RandomEnumUtils.randomValue(<Enum>.<subset>())`.
  `private static final` = one value per class/run; a plain instance field = new value per
  test (JUnit per-method lifecycle). **Preferred: declare the field and initialize it in
  `@BeforeEach`** so each test exercises a fresh value.
  When the test needs "any value except X", use
  `RandomUtils.getRandomValueFromListExcluding(<list>, X)` — do not hand-write stream filters
  with `findFirst()`/`findAny()`.
- **Fixed key lists** — when a payload takes a fixed set of keys, model them as an enum +
  `static final List<String>` on the POJO, generate values with a `random()` factory from those
  keys, and reuse the list in validation (e.g. a map missing one key) instead of hardcoding
  `Map.of(...)` in each test. Example: [reference.md](reference.md#fixed-key-list-on-a-pojo).
- **API-driven key lists** — when keys come from another API response, model those fields on
  its DTO and add small value-object factories `<Payload>.of(<config>)`. Tests call these
  factories, not duplicate stream/map creation inline except when building expected error text
  from the same live data. Example: [reference.md](reference.md#api-driven-payload-configuration).

---

## Cleanup — framework-managed (do NOT hand-roll)

- `BaseTest.cleanUp()` runs in `@AfterEach` automatically via `CleanUpHandlerService` over all
  beans that `extend CleanUpHandler` (sorted by `getPriority()`).
- **Hook into cleanup:** make the Steps class `extends CleanUpHandler`, and in the create
  method call `register(id, this::delete)` after a success. Then the test needs **no**
  `@AfterEach`.
- **Preferred style — `keepCreated<Entity>(id)` helper** (mirror an existing Steps class that
  already has one):
  `create` registers the id on 201; the helper does `register(id, ...::hardDelete(...))`.
  **Assert the delete status inside the cleanup lambda** — otherwise a silent failure leaks the
  entity. Example: [reference.md](reference.md#keepcreatedx-cleanup-helper-steps).
- **String id from a raw response body:** the body is the raw HTTP string **including quotes**
  (`"abc123"`). Do NOT use `.replace("\"","")` or `ObjectMapper` — use the repo `StringResponse`
  wrapper (`sendRequestAndWrapString(...)` + a subclass stripping quotes via
  `StringUtils.substringBetween(data(), "\"")`). See
  [reference.md](reference.md#stringresponse-id-wrapper).
- **Batch delete with a body:** create a small request DTO and a `delete(List<id>)` step;
  register each id against `delete(List.of(id))`.
- **Priority:** override `getPriority()` so the child is deleted before its parent (lower =
  first). Reuse existing `CORE_<ENTITY>_PRIORITY` constants.
- **Sites/tables created via flows already register themselves** — do not manually delete them.

---

## Tips

- **Site/table strategy — ALWAYS ask before writing** — ask the user for every test that
  needs a site or table (static vs create new). Full rules in Phase D → step 17. Never
  assume one approach over the other.
- **Error-body text patterns** — always confirm on first real run. Use the existing tests
  in the same domain as reference for exact FluentValidation message formats. Default-guess
  patterns: [reference.md](reference.md#fluentvalidation-error-body-patterns).
- **Domain-specific worked examples** (request factories, API-driven payloads, full GET
  assertion shape, exact validation messages) live in [reference.md](reference.md) — open the
  section for the domain you are extending before writing.
- **Static tables are per game type** — the static-tables bean reads
  `core.static-table.<game>-table-id` from `application-*.properties`.
- **Static sites** — `core.static-site-id` (and a second `core.mock-static-site-id`) in
  `application-*.properties`. **Caveat:** some environments lack the static site/table
  properties (e.g. certification). If a test
  depends on a static resource that does not exist on an env, drop `@Tag(CERTIFICATION)`
  from that test's env set rather than failing at context load.
- **Cleanup is automatic** for entities created via factory flows — see
  [Cleanup](#cleanup--framework-managed-do-not-hand-roll). Do not hand-roll `@AfterEach`.
- **`bootstrap.properties` is ignored** — never commit or stage it.
