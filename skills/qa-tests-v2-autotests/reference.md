# qa-tests-v2 autotests — reference

Concrete code snippets and message patterns referenced from `SKILL.md`.

This file owns **all** examples for this skill. When a rule needs a code sample, a tag
set, a message pattern or a naming list, it is added here under its own `##` heading and
`SKILL.md` links to it — examples are never inlined in `SKILL.md` (see
[Skill files](SKILL.md#skill-files--where-content-belongs)).

---

## Standard tag set

All tags are constants in `CoreTags` — package `live.winfinity.at.core.consts`
(`api/src/main/java/live/winfinity/at/core/consts/CoreTags.java`). Import them statically;
**do not hardcode tag strings in the test**. If the feature has no tag yet, add a new
constant to `CoreTags` first:

```java
import static live.winfinity.at.core.consts.CoreTags.BRANDING;
import static live.winfinity.at.core.consts.CoreTags.CORE_BACKOFFICE;
import static live.winfinity.at.core.consts.CoreTags.CORE_BACKOFFICE_V5;
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

Scope: `@SmokeTag` / `@CriticalTag` / `@ExtendedTag`. Component: `@AllureComponentCore`.

**No feature env tag** — do not add `@Tag(FEATURE_BACKOFFICE)` / `@Tag(FEATURE_*)`; remove it
(and its static import) when refactoring, unless the user explicitly asks for it.

---

## SoftAssertions pattern

More than 2 assertions in a row — always wrap in `SoftAssertions`:

```java
SoftAssertions.assertSoftly(softAssertions ->{
        softAssertions.

assertThat(created.name()).

as("name").

isEqualTo(request.name());
        softAssertions.

assertThat(created.type()).

as("type").

isEqualTo(...);
    softAssertions.

assertThat(created.assets()).

as("assets").

isEqualTo(request.assets());
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
steps.create(request)
     .

statusCodeIs400()
     .

verifyErrorBody(error);
```

Assert the error body when the message is deterministic (the `String error = ...` →
`.verifyErrorBody(error)` form above). A few merged validation tests only check
`.statusCodeIs400()` without an error body — e.g. BlueScreen `assets`/`settings` fed an
arbitrary key — match the reviewed MR rather than forcing `verifyErrorBody` everywhere.

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
