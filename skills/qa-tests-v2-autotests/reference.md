# qa-tests-v2 autotests — reference

Concrete code snippets and message patterns referenced from `SKILL.md`.

This file owns **all** examples for this skill. When a rule needs a code sample, a tag
set, a message pattern or a naming list, it is added here under its own `##` heading and
`SKILL.md` links to it — examples are never inlined in `SKILL.md` (see
[Skill files](SKILL.md#skill-files--where-content-belongs)).

---

## Standard tag set

Common area tags are constants in `CoreTags` — package `live.winfinity.at.core.consts`
(`api/src/main/java/live/winfinity/at/core/consts/CoreTags.java`). Feature/subtype tags may
live in a domain-specific tag class, e.g. BackOffice branding subtype tags in
`live.winfinity.at.core.consts.tags.backoffice.CoreBackofficeTags`. Import constants
statically; **do not hardcode tag strings in the test**. If the feature has no tag yet, add a
new constant to the matching tag class first:

```java
import static live.winfinity.at.core.consts.CoreTags.BRANDING;
import static live.winfinity.at.core.consts.CoreTags.CORE_BACKOFFICE;
import static live.winfinity.at.core.consts.CoreTags.CORE_BACKOFFICE_V5;
import static live.winfinity.at.core.consts.tags.backoffice.CoreBackofficeTags.DEDICATED_BRANDING;
```

Standard CORE `@Tag` set:

Always formatted as a column — one `@Tag` per line:

```java
@Tags({
        @Tag(CERTIFICATION),
        @Tag(PREPROD),
        @Tag(RELEASE),
        @Tag(LATEST),
        @Tag(CORE_QA)
})
```

Class-level component tags — same column format:

```java

@Tags({
        @Tag(CORE_BACKOFFICE),
        @Tag(CORE_BACKOFFICE_V5),
        @Tag(BRANDING),
        @Tag(GENERIC_BRANDING)
})
@AllureComponentCore
@Feature("API | BackOffice | v5 | Branding campaigns")
class CreateGenericBrandingCampaignsTests extends BaseApiTest {
```

Dedicated branding campaign class-level tags (MR 6094):

```java
@Tags({
        @Tag(CORE_BACKOFFICE),
        @Tag(CORE_BACKOFFICE_V5),
        @Tag(BRANDING),
        @Tag(DEDICATED_BRANDING)
})
@AllureComponentCore
@Feature("API | BackOffice | v5 | Branding campaigns | Dedicated campaigns")
class CreateDedicatedBrandingCampaignsTests extends BaseApiTest {
```

Scope: `@SmokeTag` / `@CriticalTag` / `@ExtendedTag`. Component: `@AllureComponentCore`.

**No feature env tag** — do not add `@Tag(FEATURE_BACKOFFICE)` / `@Tag(FEATURE_*)`; remove it
(and its static import) when refactoring, unless the user explicitly asks for it.

---

## Test method annotation order

Normal `@Test` method order (MR 6094): env tags, JUnit test annotation, scope, Allure id,
display name, then method.

```java
@Tags({
        @Tag(PREPROD),
        @Tag(RELEASE),
        @Tag(LATEST),
        @Tag(CORE_QA)
})
@Test
@CriticalTag
@AllureId("105300")
@DisplayName("Create Dedicated campaign without assets and check error")
void createDedicatedCampaignWithoutAssetsAndCheckError() {
    ...
}
```

Positive methods that should run certification add `@Tag(CERTIFICATION)` as the first env tag:

```java
@Tags({
        @Tag(CERTIFICATION),
        @Tag(PREPROD),
        @Tag(RELEASE),
        @Tag(LATEST),
        @Tag(CORE_QA)
})
```

`@TestTemplate` methods carry only the template annotation and provider extension; the provider
owns display name, Allure id, scope and environments:

```java
@TestTemplate
@ExtendWith(CampaignNameLengthContextProvider.class)
void createDedicatedCampaignWithNameLength(Integer length) {
    ...
}
```

---

## SoftAssertions pattern

More than 2 assertions in a row — always wrap in `SoftAssertions`:

```java
SoftAssertions.assertSoftly(softAssertions -> {
    softAssertions.assertThat(created.name()).as("name").isEqualTo(request.name());
    softAssertions.assertThat(created.type()).as("type").isEqualTo(...);
    softAssertions.assertThat(created.assets()).as("assets").isEqualTo(request.assets());
});
```

Import `org.assertj.core.api.SoftAssertions` (not the static `assertSoftly`).
1–2 assertions stay plain `assertThat`.

**Hard structural preconditions come BEFORE the soft block** when the block indexes a
collection (REVIEW.md). Assert the size, read the element into a local variable, then keep
field checks inside `assertSoftly`:

```java
assertThat(brandingCampaign.tables()).as("tables").hasSize(1);
BrandingCampaignTable actualTable = brandingCampaign.tables().getFirst();
SoftAssertions.assertSoftly(softAssertions -> {
    softAssertions.assertThat(actualTable.tableId()).as("tableId").isEqualTo(table.tableId());
    softAssertions.assertThat(actualTable.streamId()).as("streamId").isEqualTo(table.streamId());
    // ...
});
```

Without the size precondition, `getFirst()` on an empty `tables` throws
`NoSuchElementException` instead of a readable assertion report. If no indexing is needed,
prefer collection-style assertions inside the block (`extracting(...).containsExactly(...)`,
`hasSize`, `first()`) — they never throw on an empty collection. One soft scope per verify
method, never inside `forEach`.

---

## Validation assertion pattern

Each validation test targets one rule and asserts both status and the error body. The
expected body goes to a **local variable first** (`error` / `expectedError`) — never inline
the string literal in the call chain:

```java
String error = "\"/{path} -> '<Field>' must not be empty.\"";
steps.create(request).statusCodeIs400().verifyErrorBody(error);
```

When the assertion message is built from variables, prefer `.formatted(...)` and keep the
message in a local variable first:

```java
String error = ("\"/backoffice/v5/createBrandingCampaign -> Tables with id(s) %s do not match " +
        "the Dedicated campaign game type %s.\"")
        .formatted(tableId, gameType.getValue());
```

For multiline concatenation, see [Multiline formatted strings](#multiline-formatted-strings).

Assert the error body when the message is deterministic (the `String error = ...` →
`.verifyErrorBody(error)` form above). A few merged validation tests only check
`.statusCodeIs400()` without an error body — e.g. BlueScreen `assets`/`settings` fed an
arbitrary key — match the reviewed MR rather than forcing `verifyErrorBody` everywhere.

---

## Multiline formatted strings

Java applies `.formatted(...)` to the expression immediately before it. With string
concatenation, wrap the whole string expression in parentheses; otherwise the first `%s` may
remain literal and arguments shift into the wrong placeholder.

Correct:

```java
String error = ("\"/backoffice/v5/createBrandingCampaign -> Tables with id(s) %s do not match " +
        "the Dedicated campaign game type %s.\"")
        .formatted(siteTable.tableId(), game.gameType().getValue());
```

Correct with two dynamic key lists:

```java
String error = ("\"/backoffice/v5/createBrandingCampaign -> Dedicated campaign assets must " +
        "contain exactly: %s. Dedicated campaign settings must contain exactly: %s.\"")
        .formatted(expectedDedicatedBrandingAssets, expectedDedicatedBrandingSettings);
```

Wrong:

```java
String error = "\"... Tables with id(s) %s do not match the Dedicated " +
        "campaign game type %s.\"".formatted(siteTable.tableId(), game.gameType().getValue());
```

---

## FluentValidation error-body patterns

Always confirm on first real run; these are the default guesses seen across the repo:

- NotEmpty → `'<Field>' must not be empty.`
- NotNull / forbidden value → `'<Field>' must be empty.` (when the rule is `.Null()` /
  `.Empty()` on a non-empty value).
- MaxLength → `The length of '<Field>' must be <N> characters or fewer. You entered <M> characters.`
- The full message is prefixed with the endpoint path, e.g.
  `"/backoffice/v5/<endpoint> -> ..."`.

---

## DisplayName (naming)

Merged `brandingcampaigns` tests (and the whole master package) use **plain natural-language
names** — `Create <Type> campaign with <violation> -> 400` — with **no** `[BVA]`/`[DT]`/`[EP]`
bracket prefixes:

- `Create Physical campaign with siteIds -> 400`
- `Create BlueScreen campaign with streamId 101 chars -> 400`
- `Create Generic campaign with name 201 chars -> 400`
- `Create Physical campaign without tables -> 400` (sends one table with a null `tableId`)

The name states the field under test and the expected status; the exact offending value
goes in the method name:

- `...WithStreamId101CharsReturns400`
- `...WithEmptyNameReturns400`

---

## Boundary naming

Describe the exact offending value in the method name:

- `...Name201CharsReturns400`
- `...WithEmptyNameReturns400`

---

## Parameterized positive cases (@TestTemplate)

Merge BVA pairs (1 char / 40 chars) into one `@TestTemplate`. The test method takes a **plain
value** (`Integer length`) — no testcase record (review feedback); the provider passes the raw
value via `.value(length)`:

```java
// test
@TestTemplate
@ExtendWith(BrandedTableNameLengthContextProvider.class)
void createGenericCampaignWithBrandedTableName(Integer length) {
    createAndVerifyGenericCampaignWithBrandedTableName(RandomStringUtils.randomAlphabetic(length));
}
```

```java
// provider — under api/src/test/java/.../core/providers/backoffice/<domain>/
public class BrandedTableNameLengthContextProvider implements BaseTestTemplateInvocationProvider {

    private static final String TEMPLATE = "Create Generic campaign with brandedTableName %s";

    @Override
    public Stream<TestTemplateInvocationContext> provideTestTemplateInvocationContexts(ExtensionContext context) {
        return Stream.of(
                create(1, "1 char", "104972", context),
                create(40, "40 chars", "104973", context)
        );
    }

    private TestTemplateInvocationContext create(int length, String testCaseName, String allureId,
                                                 ExtensionContext context) {
        return buildTestContext(context)
                .displayName(TEMPLATE, testCaseName)
                .allureId(allureId)
                .value(length)
                .scopes(criticalTag())
                .environments(List.of(CERTIFICATION, PREPROD, RELEASE, LATEST, CORE_QA))
                .build();
    }
}
```

Do NOT put `@Tag`/`@AllureId`/`@DisplayName`/scope annotations on the `@TestTemplate` method —
they live in the provider.

Scope is per provider, not forced to critical — the BlueScreen streamId-length positives
(1 / 100 chars) use `.scopes(smokeTag())` and keep `CERTIFICATION`; each case has its own
`@AllureId`. The provider lives under
`api/src/test/java/.../core/providers/backoffice/brandingcampaigns/`
(`BlueScreenStreamIdLengthContextProvider`, `TEMPLATE = "Create BlueScreen campaign with
streamId %s"`).

---

## Bean-name collision check

Spring names beans from the simple class name, so a new `@Component` Steps/Flows class must
not reuse an existing class name anywhere in the repo. This fails at context load:

```
ConflictingBeanDefinitionException: Annotation-specified bean name 'brandingCampaignsSteps'
for bean class [...core...BrandingCampaignsSteps] conflicts with existing, non-compatible
bean definition ... [...backoffice.tables.steps.BrandingCampaignsSteps]
```

Check first: `find api/src -name "<ClassName>.java"`. On collision, disambiguate with a
version suffix — `BrandingCampaignsSteps` → `BrandingCampaignsV5Steps`. POJO records/enums
are not beans and may share simple names across packages.

---

## REST client overloads

Choose the `RestClient` send method by response shape (from `api/src/main/AGENTS.md`):

| Response shape | Method                                               |
|----------------|------------------------------------------------------|
| Single object  | `sendRequest(req, Dto.class)`                        |
| List           | `sendRequestAndGetList(req, Dto.class)`              |
| Map            | `sendRequestAndGetMap(req, Key.class, Value.class)`  |
| Wrapped list   | `sendRequestAndWrapList(req, Dto.class)`             |
| Wrapped map    | `sendRequestAndWrapMap(req, Key.class, Value.class)` |
| Binary file    | `sendRequestAndGetFile(req)`                         |
| String wrapper | `sendRequestAndWrapString(req)`                      |
| Polling / wait | `sendRequestUntil(req, ConditionBuilder)`            |

Create endpoints returning a raw quoted id use the String-wrapper pattern below.

---

## StringResponse id wrapper

A `RestResponse<String, ...>` body is the **raw HTTP string including quotes** (`"abc123"`).
Do NOT use `.replace("\"", "")` and do NOT parse with `ObjectMapper`. The repo pattern is a
`StringResponse` subclass stripped via `StringUtils.substringBetween(data(), "\"")`, consumed
through `sendRequestAndWrapString(...)` — mirror `PartnerIdResponseWrapper` /
`FolderIdResponseWrapper`:

```java
// wrapper — under core/dto/backoffice (not the pojo package)
public class BrandingCampaignIdResponseWrapper extends StringResponse {

    public BrandingCampaignIdResponseWrapper(String data) {
        super(data);
    }

    public String campaignId() {
        return StringUtils.substringBetween(data(), "\"");
    }
}
```

```java
// Steps
public RestResponse<BrandingCampaignIdResponseWrapper, String> create(CreateBrandingCampaignRequest request) {
    ...
    RestResponse<BrandingCampaignIdResponseWrapper, String> response =
            haproxyClient.sendRequestAndWrapString(httpRequest, BrandingCampaignIdResponseWrapper.class, String.class);
    if (response.code() == HttpStatus.CREATED) {
        keepCreatedCampaign(response.body().campaignId());
    }
    return response;
}
```

```java
// Flow — create+get orchestration shared by tests; unwrap the id
@Step("Core: Create generic branding campaign and get it")
public BrandingCampaignResponse createAndGetGenericCampaign(String name, List<String> siteIds,
                                                            List<BrandingCampaignTable> tables,
                                                            GenericAssets assets) {
    CreateBrandingCampaignRequest request = CreateBrandingCampaignRequest.generic(name, siteIds, tables, assets);
    return createAndGetCampaign(request);
}

private BrandingCampaignResponse createAndGetCampaign(CreateBrandingCampaignRequest request) {
    String campaignId = brandingCampaignsV5Steps.create(request).statusCodeIs201().body().campaignId();
    assertThat(campaignId).as("campaignId").isNotNull();
    return brandingCampaignsV5Steps.getCampaign(campaignId).statusCodeIs200().body();
}
```

---

## keepCreatedX cleanup helper (Steps)

Mirror `BackofficeSiteSteps.keepCreatedSite`: `create` registers the id for cleanup via a
`keepCreatedX` helper. **Assert the delete status inside the cleanup lambda** — otherwise a
failed delete is silently treated as success and the entity leaks on the env:

```java
private void keepCreatedCampaign(String campaignId) {
    register(campaignId, id -> hardDelete(List.of(id)).statusCodeIs204());
}
```

---

## Valid-request factory for negative tests

When negative tests each rebuild the same valid request, add a builder factory on the request
POJO; each test overrides only the field it targets:

```java
// request POJO in .../brandingcampaigns/create/
public static CreateBrandingCampaignRequestBuilder validGenericBuilder(String tableId, List<String> siteIds) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(RandomUtils.randomBrandingCampaignName())
                                        .type(BrandingCampaignType.GENERIC)
                                        .siteIds(siteIds)
                                        .tables(List.of(BrandingCampaignTable.of(tableId)))
                                        .assets(GenericAssets.random().toMap());
}
```

**Full factory returning the built request** — when the request is used as-is (no per-test
override), the static factory returns the finished `CreateBrandingCampaignRequest` with
`.build()`:

```java
// request POJO in .../brandingcampaigns/create/
public static CreateBrandingCampaignRequest generic(String name, List<String> siteIds,
                                                    List<BrandingCampaignTable> tables,
                                                    GenericAssets assets) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(name)
                                        .type(BrandingCampaignType.GENERIC)
                                        .siteIds(siteIds)
                                        .tables(tables)
                                        .assets(assets.toMap())
                                        .build();
}
```

The two shapes complement each other: `xxx(...)` returns the built record; `validXxxBuilder(...)`
returns the `*Builder` so a positive/negative test can override just the field it targets and
then call `.build()`.

```java
// negative test — override only the field under test
CreateBrandingCampaignRequest request =
        CreateBrandingCampaignRequest.validGenericBuilder(tableId, List.of(siteId))
                                     .name(RandomStringUtils.randomAlphabetic(201))
                                     .build();
```

**Type-specific builders bake the type contract** — a Physical builder takes only a
`tableId` (no `siteIds` param at all; the field simply is not set), a BlueScreen builder
always takes a `streamId` (merged Physical MR):

```java
// request POJO in .../brandingcampaigns/create/
public static CreateBrandingCampaignRequest physical(String name, BrandingCampaignTable table) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(name)
                                        .type(BrandingCampaignType.PHYSICAL)
                                        .tables(List.of(table))
                                        .build();
}

public static CreateBrandingCampaignRequestBuilder validPhysicalBuilder(String tableId) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(RandomUtils.randomBrandingCampaignName())
                                        .type(BrandingCampaignType.PHYSICAL)
                                        .tables(List.of(BrandingCampaignTable.of(tableId)));
}
```

**"Campaign requires a table" — ONE table with a null `tableId`**, not an empty list; the
API answers `"The TableId field is required."` (merged BlueScreen & Physical tests):

```java
CreateBrandingCampaignRequest request = CreateBrandingCampaignRequest.validPhysicalBuilder(null).build();
String error = "\"/backoffice/v5/createBrandingCampaign -> The TableId field is required.\"";
brandingCampaignsV5Steps.create(request).statusCodeIs400().verifyErrorBody(error);
```

**Count rule (two tables) — two DISTINCT active tables**, each with a valid streamId, so
only the count rule can fire; reusing one static id trips the duplicate-value rule instead:

```java
String firstTableId = coreTableFlows.createActivatedTable(gameType, siteId).getId();
String secondTableId = coreTableFlows.createActivatedTable(gameType, siteId).getId();
CreateBrandingCampaignRequest request = CreateBrandingCampaignRequest.validPhysicalBuilder(firstTableId)
                                                                     .tables(List.of(
                                                                             BrandingCampaignTable.of(firstTableId),
                                                                             BrandingCampaignTable.of(secondTableId)))
                                                                     .build();
```

Do not reuse the same static tableId (`getStaticTableIdByGameType(...)`) for two elements
and do not leave a nested required field (e.g. `streamId`) null when the target rule is the
count — the duplicate-value / NotEmpty rules then fire instead, and the expected error
starts depending on validation order.

---

## Enum constants

Enum constants are CAPS; if the backend serializes by value, add `value` + `@JsonValue`
(mirror `core.enums.topwins.OrderBy`):

```java

@Getter
@AllArgsConstructor
public enum BrandingCampaignStatus {
    DRAFT("Draft"),
    ACTIVE("Active"),
    ABORTED("Aborted");

    @JsonValue
    private final String value;
}
```

---

## Response assertions interface

Verification for a response lives in a `*Assertions` interface (mirror
`createtable/assertions/CreateTableAssertions`): the interface `extends ObjectAssertions<T>`,
the response record `implements` it and returns `this` from `getSelf()`, and each verify is a
`default` method calling `getSelf()`. Tests call the verify on the response instance.

```java
// .../brandingcampaigns/get/assertions/BrandingCampaignAssertions.java
public interface BrandingCampaignAssertions extends ObjectAssertions<BrandingCampaignResponse> {

    default BrandingCampaignResponse verifyGenericCampaign(String name, List<String> siteIds,
                                                           List<BrandingCampaignTable> tables,
                                                           GenericAssets assets) {
        BrandingCampaignResponse brandingCampaign = getSelf();
        ...
        SoftAssertions.assertSoftly(softAssertions -> {
            softAssertions.assertThat(brandingCampaign.type()).as("type")
                          .isEqualTo(BrandingCampaignType.GENERIC);
            ...
        });
        return brandingCampaign;
    }
}
```

```java
// response record in .../brandingcampaigns/get/
public record BrandingCampaignResponse(...) implements BrandingCampaignAssertions {

    @Override
    public BrandingCampaignResponse getSelf() {
        return this;
    }
}
```

The GET response **reuses the nested DTOs from `create/nested/`** — it imports
`BrandingCampaignTable`, `SiteInfo` and `PartnerInfo` from `create.nested` instead of
declaring its own copies:

```java
// .../brandingcampaigns/get/BrandingCampaignResponse.java

import live.winfinity.at.core.gateway.pojo.backoffice.brandingcampaigns.create.nested.BrandingCampaignTable;
import live.winfinity.at.core.gateway.pojo.backoffice.brandingcampaigns.create.nested.PartnerInfo;
import live.winfinity.at.core.gateway.pojo.backoffice.brandingcampaigns.create.nested.SiteInfo;

public record BrandingCampaignResponse(String id, String name,
                                       List<SiteInfo> sitesInfo, List<PartnerInfo> partnersInfo,
                                       List<BrandingCampaignTable> tables, ...) implements BrandingCampaignAssertions {
    ...
}
```

```java
// test — fluent call on the response
brandingCampaign.verifyGenericCampaign(brandingCampaignName, siteIds, tables, assets);
```

The verify methods are NOT placed on the flow — flows stay thin (create + orchestration only).

## Verify full shape (brandingcampaigns)

Each `verifyXxxCampaign` asserts the whole GET response in one soft block; the structural
precondition (`tables` size → `getFirst()`) is asserted **before** the block. Cross-cutting
(added by the Physical MR): on GET the campaign returns empty `partnersInfo` and `settings`
for every type, and empty `assets` where the type sends none.

```java
default BrandingCampaignResponse verifyPhysicalCampaign(String name, BrandingCampaignTable table) {
    BrandingCampaignResponse brandingCampaign = getSelf();
    assertThat(brandingCampaign.tables()).as("tables").hasSize(1);
    BrandingCampaignTable actualTable = brandingCampaign.tables().getFirst();
    SoftAssertions.assertSoftly(softAssertions -> {
        softAssertions.assertThat(brandingCampaign.name()).as("name").isEqualTo(name);
        softAssertions.assertThat(brandingCampaign.type()).as("type")
                      .isEqualTo(BrandingCampaignType.PHYSICAL);
        softAssertions.assertThat(brandingCampaign.status()).as("status")
                      .isEqualTo(BrandingCampaignStatus.DRAFT);
        softAssertions.assertThat(brandingCampaign.sitesInfo()).as("sitesInfo").isEmpty();
        softAssertions.assertThat(brandingCampaign.partnersInfo()).as("partnersInfo").isEmpty();
        softAssertions.assertThat(actualTable.tableId()).as("tableId").isEqualTo(table.tableId());
        softAssertions.assertThat(actualTable.brandedTableName()).as("brandedTableName")
                      .isEqualTo(table.brandedTableName());
        softAssertions.assertThat(brandingCampaign.assets()).as("assets").isEmpty();
        softAssertions.assertThat(brandingCampaign.settings()).as("settings").isEmpty();
    });
    return brandingCampaign;
}
```

Per-type shape (merged MRs):

- `verifyBlueScreenCampaign(name, siteIds, table)` — name, type, status DRAFT, `gameType`
  null, `assets` empty, `settings` empty, `sitesInfo` ids
  (`extracting(SiteInfo::id).containsExactlyInAnyOrderElementsOf(siteIds)`), `partnersInfo`
  empty, tableId, streamId, brandedTableName.
- `verifyPhysicalCampaign(name, table)` — name, type, status DRAFT, `sitesInfo` empty,
  `partnersInfo` empty, tableId, brandedTableName, `assets` empty, `settings` empty
  (no `gameType` assertion).

---

## Fixed key list on a POJO

Fixed key sets (e.g. generic campaign assets) live as a `List` on the POJO and values are
generated from them. The keys themselves are declared as an **enum** (see
[Enum constants](#enum-constants)) under `core/enums/<domain>/`, and the POJO's key list is
built from `.getValue()` — never inline string literals:

```java
// core/enums/brandingcampaigns/GenericAssetsKeys.java
@Getter
@AllArgsConstructor
public enum GenericAssetsKeys {

    LOADING("Loading"),
    DESKTOP("Desktop"),
    MOBILE("Mobile");

    @JsonValue
    private final String value;
}
```

```java
// core/gateway/pojo/backoffice/brandingcampaigns/create/nested/GenericAssets.java
public record GenericAssets(Map<String, String> assets) {

    public static final List<String> GENERIC_ASSET_KEYS = List.of(GenericAssetsKeys.LOADING.getValue(),
                                                                  GenericAssetsKeys.DESKTOP.getValue(),
                                                                  GenericAssetsKeys.MOBILE.getValue());

    public static GenericAssets random() {
        Map<String, String> randomAssets = GENERIC_ASSET_KEYS.stream()
                                                             .collect(Collectors.toMap(
                                                                     key -> key,
                                                                     key -> RandomUtils.randomWinfinityUrl()));
        return new GenericAssets(randomAssets);
    }

    public Map<String, String> toMap() {
        return assets;
    }
}
```

Same pattern applies to a builder-factory default that consumes the key set
(`GenericAssets.GENERIC_ASSET_KEYS` used when building a validation payload missing one key).

---

## Dedicated Branding campaigns

MR 6094 (`CreateDedicatedBrandingCampaignsTests`) is the reviewed pattern for Dedicated
Branding campaign autotests.

### Class shape and dependencies

```java
class CreateDedicatedBrandingCampaignsTests extends BaseApiTest {

    private static final GameType GAME_TYPE = GameType.TEEN_PATTI;

    @LazyAutowired
    private BrandingCampaignsV5Steps brandingCampaignsSteps;
    @LazyAutowired
    private BrandingCampaignsFlows brandingCampaignsFlows;
    @LazyAutowired
    private BackOfficeApiGatewayFlows backOfficeApiGatewayFlows;
    @LazyAutowired
    private CoreSiteTableRelationFlows coreSiteTableRelationFlows;
    @LazyAutowired
    private PartnersProperties partnersProperties;
    @LazyAutowired
    private BackofficeSteps backofficeSteps;

    @Value("${backoffice.test-folder-id}")
    String testFolderId;
}
```

Rules from review:

- Put `GAME_TYPE` as the first field in the class body.
- Use `@LazyAutowired`, not `@Autowired`.
- Keep `testFolderId` as the configured BackOffice folder id.
- Comments, if unavoidable, are in English and explain why, not test steps.

### Dedicated prerequisite site/table

Dedicated TEEN_PATTI campaigns need an active table created with an explicit lobby category.
Use the existing flow directly; do not wrap this one-liner in a private test helper:

```java
SiteTableRelation siteTable = coreSiteTableRelationFlows.createSiteWithActiveTable(testFolderId, GAME_TYPE,
                                                                                   Category.BANKER_GAMES);
```

If the line is too long because the local variable name is long, split arguments and align the
continuation with the surrounding file:

```java
SiteTableRelation seccondSiteTable = coreSiteTableRelationFlows.createSiteWithActiveTable(testFolderId,
                                                                                          GAME_TYPE,
                                                                                          Category.BANKER_GAMES);
```

For a different game type negative case, create a matching table for the different type so the
test reaches the API rule under test:

```java
GameType differentGameType = RandomUtils.getRandomValueFromListExcluding(GameType.getLiveCasinoGameTypes(),
                                                                         GAME_TYPE);
SiteTableRelation siteTable = coreSiteTableRelationFlows.createSiteWithActiveTable(testFolderId,
                                                                                   differentGameType);
```

### Game lookup and API-driven Dedicated keys

Dedicated `assets` and `settings` keys come from `GET /backoffice/v5/games`. The `Game` DTO
contains:

```java
public record Game(GameType gameType, String name, Integer gameTypeNumber, List<String> betNames,
                   List<DedicatedBrandingAsset> dedicatedBrandingAssets,
                   List<DedicatedBrandingSetting> dedicatedBrandingSettings) {
}
```

Lookup a configured game via `BackOfficeApiGatewayFlows`; missing lookup data must throw a
useful `QaWinfinityException`, not a bare `NoSuchElementException`:

```java
@Step("Core: Get game by game type")
public Game getGame(GameType gameType) {
    String error = "There is no %s game.".formatted(gameType.getValue());
    return backofficeSteps.getGames("v5").statusCodeIs200().body().data().stream()
                          .filter(game -> game.gameType() == gameType)
                          .findFirst()
                          .orElseThrow(() -> new QaWinfinityException(error));
}
```

Build valid payload maps from the live game configuration using small records under
`create/nested/`:

```java
public record DedicatedBrandingAssets(Map<String, String> assets) {

    public static DedicatedBrandingAssets of(Game game) {
        Map<String, String> map = game.dedicatedBrandingAssets()
                                  .stream()
                                  .collect(Collectors.toMap(DedicatedBrandingAsset::key,
                                                            asset -> RandomUtils.randomWinfinityUrl() + asset.key()));
        return new DedicatedBrandingAssets(map);
    }

    public Map<String, String> toMap() {
        return assets;
    }
}
```

`DedicatedBrandingSettings.of(game)` mirrors this pattern using
`DedicatedBrandingSetting::key`. Tests call `DedicatedBrandingAssets.of(game).toMap()` and
`DedicatedBrandingSettings.of(game).toMap()` instead of hardcoding the configured keys.

### Request factories

Dedicated request factories live on `CreateBrandingCampaignRequest` together with other
branding campaign types:

```java
public static CreateBrandingCampaignRequest dedicated(String name, List<String> siteIds, GameType gameType,
                                                       List<BrandingCampaignTable> tables,
                                                       Map<String, String> assets,
                                                       Map<String, String> settings) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(name)
                                        .type(BrandingCampaignType.DEDICATED)
                                        .siteIds(siteIds)
                                        .gameType(gameType)
                                        .tables(tables)
                                        .assets(assets)
                                        .settings(settings)
                                        .build();
}

public static CreateBrandingCampaignRequestBuilder dedicatedBuilder(String tableId, List<String> siteIds,
                                                                     Game game) {
    return CreateBrandingCampaignRequest.builder()
                                        .name(RandomUtils.randomBrandingCampaignName())
                                        .type(BrandingCampaignType.DEDICATED)
                                        .siteIds(siteIds)
                                        .gameType(game.gameType())
                                        .tables(List.of(BrandingCampaignTable.of(tableId)))
                                        .assets(DedicatedBrandingAssets.of(game).toMap())
                                        .settings(DedicatedBrandingSettings.of(game).toMap());
}
```

Use `dedicated(...)` for positive create+get flow calls. Use `dedicatedBuilder(...)` in
negative tests, overriding only the field under test.

### Flow and positive test body

The flow stays thin: it builds the request through the factory, delegates to the shared
private `createAndGetCampaign(request)`, and returns the GET response.

```java
@Step("Core: Create Dedicated branding campaign and get it")
public BrandingCampaignResponse createAndGetDedicatedCampaign(String name, List<String> siteIds, GameType gameType,
                                                               List<BrandingCampaignTable> tables,
                                                               Map<String, String> assets,
                                                               Map<String, String> settings) {
    CreateBrandingCampaignRequest request = CreateBrandingCampaignRequest.dedicated(name, siteIds, gameType, tables,
                                                                                    assets, settings);
    return createAndGetCampaign(request);
}
```

Positive test body shape:

```java
String brandingCampaignName = RandomUtils.randomBrandingCampaignName();
SiteTableRelation siteTable = coreSiteTableRelationFlows.createSiteWithActiveTable(testFolderId, GAME_TYPE,
                                                                                   Category.BANKER_GAMES);
List<String> siteIds = List.of(siteTable.siteId());
List<BrandingCampaignTable> tables = List.of(BrandingCampaignTable.of(siteTable.tableId()));
Game game = backOfficeApiGatewayFlows.getGame(GAME_TYPE);
Map<String, String> assets = DedicatedBrandingAssets.of(game).toMap();
Map<String, String> settings = DedicatedBrandingSettings.of(game).toMap();

brandingCampaignsFlows.createAndGetDedicatedCampaign(brandingCampaignName, siteIds, GAME_TYPE, tables, assets,
                                                     settings)
                      .verifyDedicatedCampaign(brandingCampaignName, siteIds, GAME_TYPE, tables, assets, settings);
```

### Full GET assertion shape

`verifyDedicatedCampaign(...)` lives on `BrandingCampaignAssertions`, not on the flow. It
checks the full response and returns the response for optional terminal checks such as
`verifyBrandedTableNames(...)`.

```java
default BrandingCampaignResponse verifyDedicatedCampaign(String name, List<String> siteIds, GameType gameType,
                                                         List<BrandingCampaignTable> tables,
                                                         Map<String, String> assets,
                                                         Map<String, String> settings) {
    BrandingCampaignResponse brandingCampaign = getSelf();
    SoftAssertions.assertSoftly(softAssertions -> {
        softAssertions.assertThat(brandingCampaign.name()).as("name").isEqualTo(name);
        softAssertions.assertThat(brandingCampaign.type()).as("type")
                      .isEqualTo(BrandingCampaignType.DEDICATED);
        softAssertions.assertThat(brandingCampaign.status()).as("status")
                      .isEqualTo(BrandingCampaignStatus.DRAFT);
        softAssertions.assertThat(brandingCampaign.gameType()).as("gameType").isEqualTo(gameType);
        softAssertions.assertThat(brandingCampaign.sitesInfo()).as("sitesInfo").extracting(SiteInfo::id)
                      .containsExactlyInAnyOrderElementsOf(siteIds);
        softAssertions.assertThat(brandingCampaign.partnersInfo()).as("partnersInfo").isEmpty();
        softAssertions.assertThat(brandingCampaign.assets()).as("assets").isEqualTo(assets);
        softAssertions.assertThat(brandingCampaign.settings()).as("settings").isEqualTo(settings);
        softAssertions.assertThat(brandingCampaign.tables()).as("tables").hasSize(tables.size());
        softAssertions.assertThat(brandingCampaign.tables()).as("tables")
                      .extracting(BrandingCampaignTable::tableId, BrandingCampaignTable::brandedTableName)
                      .containsExactlyInAnyOrderElementsOf(
                              tables.stream()
                                    .map(t -> tuple(t.tableId(), t.brandedTableName()))
                                    .toList());
    });
    return brandingCampaign;
}
```

### Dedicated validation cases and exact error messages

Validation methods in MR 6094 are `@CriticalTag` and use the env set `{PREPROD, RELEASE,
LATEST, CORE_QA}`. The request starts from `dedicatedBuilder(...)` and changes exactly one
field, then asserts `statusCodeIs400()` and the deterministic error body.

Common exact messages:

```java
String error = "\"/backoffice/v5/createBrandingCampaign -> 'GameType' must not be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> Dedicated campaign 'Assets' must not be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> Dedicated campaign 'Settings' must not be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> 'StreamId' must be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> 'Tables' must not be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> 'SiteIds' must not be empty.\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> '{SiteIds}' contains duplicate values\"";
String error = "\"/backoffice/v5/createBrandingCampaign -> '{Tables}' contains duplicate values\"";
```

Dynamic messages use `.formatted(...)` with the parenthesized multiline pattern:

```java
String error = ("\"/backoffice/v5/createBrandingCampaign -> Tables with id(s) %s do not match " +
        "the Dedicated campaign game type %s.\"")
        .formatted(siteTable.tableId(), game.gameType().getValue());
```

```java
String expectedDedicatedBrandingAssets = game.dedicatedBrandingAssets().stream()
                                             .map(DedicatedBrandingAsset::key)
                                             .collect(Collectors.joining(", "));
String expectedDedicatedBrandingSettings = game.dedicatedBrandingSettings().stream()
                                               .map(DedicatedBrandingSetting::key)
                                               .collect(Collectors.joining(", "));
String error = ("\"/backoffice/v5/createBrandingCampaign -> Dedicated campaign assets must contain exactly: %s. " +
        "Dedicated campaign settings must contain exactly: %s.\"")
        .formatted(expectedDedicatedBrandingAssets, expectedDedicatedBrandingSettings);
```

For the "not configured gameType" case, do not assume a fixed enum. Pick a game returned by
`getGames("v5")` where both Dedicated config lists are empty, create a table of that game's type,
and throw a useful setup error if none exists:

```java
String error = "There is no game without dedicated configuration for game type %s.".formatted(GAME_TYPE.getValue());
Game notConfiguredGame = backofficeSteps.getGames("v5").statusCodeIs200().body().data().stream()
                                        .filter(g -> g.gameType() != GAME_TYPE)
                                        .filter(g -> g.dedicatedBrandingAssets().isEmpty())
                                        .filter(g -> g.dedicatedBrandingSettings().isEmpty())
                                        .findFirst()
                                        .orElseThrow(() -> new QaWinfinityException(error));
```

Then assert the API error in a separate variable if `error` is already used by setup:

```java
String expectedError = "\"/backoffice/v5/createBrandingCampaign -> " + notConfiguredGameType.getValue() +
        " does not have configured dedicated assets and settings.\"";
brandingCampaignsSteps.create(request).statusCodeIs400().verifyErrorBody(expectedError);
```

### Name boundary provider

Dedicated name length positives use `@TestTemplate` with a provider; the test method has no
tags/allure/display annotations:

```java
@TestTemplate
@ExtendWith(CampaignNameLengthContextProvider.class)
void createDedicatedCampaignWithNameLength(Integer length) {
    createAndVerifyDedicatedCampaignWithNameLength(RandomStringUtils.randomAlphabetic(length));
}
```

Provider:

```java
public class CampaignNameLengthContextProvider implements BaseTestTemplateInvocationProvider {

    private static final String TEMPLATE = "Create Dedicated campaign with %s name and verify via GET";

    @Override
    public Stream<TestTemplateInvocationContext> provideTestTemplateInvocationContexts(ExtensionContext context) {
        return Stream.of(
                create("1 char", 1, "101832", context),
                create("200 chars", 200, "101833", context)
        );
    }

    private TestTemplateInvocationContext create(String name, int length, String allureId,
                                                 ExtensionContext context) {
        return buildTestContext(context)
                .displayName(TEMPLATE, name)
                .allureId(allureId)
                .value(length)
                .scopes(criticalTag())
                .environments(List.of(CERTIFICATION, PREPROD, RELEASE, LATEST, CORE_QA))
                .build();
    }
}
```

---

## TODO — team data to fill incrementally

Scratchpad (kept out of `SKILL.md` so it is not loaded on every invocation).

- [ ] Roster / roles / reviewers (if any besides the owner).
- [ ] Who assigns Allure ID ranges and the process.
- [ ] `knowledge-map` local path and service repo local paths.
- [ ] Team-specific environment matrix.
