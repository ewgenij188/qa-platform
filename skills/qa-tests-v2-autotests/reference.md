# qa-tests-v2 autotests — reference

Code templates and message patterns referenced from `SKILL.md`.

This file owns **all** code for this skill. When a rule needs a code sample, a tag set, a
message pattern or a naming list, it is added here under its own `##` heading and `SKILL.md`
links to it — code is never inlined in `SKILL.md` (see
[Skill files](SKILL.md#skill-files--where-content-belongs)).

**How to read it.** Each section gives a **template** with placeholders; concrete names come
from the domain you are working in — find them in the repo, never copy them from here.
Placeholders:

| Placeholder | Meaning | Placeholder | Meaning |
|---|---|---|---|
| `<Service>` / `<service>` | service (class / package casing) | `<Entity>` / `<entity>` | main entity of the domain |
| `<Domain>` / `<domain>` | feature package | `<Type>` | entity subtype |
| `<Operation>` | create / update / delete / get | `<State>` / `<STATE>` | entity status (wrapper / enum constant) |
| `<Transition>` | status transition verb (e.g. activate) | `<Nested>` | nested DTO (item of a list field) |
| `<Payload>` | map-like payload object | `<version>` / `<N>` | API version (`v5` / `5`) |
| `<endpoint>` | URL path of the call | `<Field>` | field name as the backend prints it |

Blocks marked **Example** are verbatim data from merged code (message texts, formats) — they
show the shape, the names in them are not to be reused for another domain.

---

## Standard tag set

Common area tags are constants in `live.winfinity.at.core.consts.CoreTags`; service/entity tags
live in `live.winfinity.at.core.consts.tags.<service>.Core<Service>Tags`. Import constants
statically; **do not hardcode tag strings in the test**. If the feature has no tag yet, add a
new constant to the matching tag class first:

```java
// Core<Service>Tags
public static final String <TYPE>_<DOMAIN> = "<type><Domain>";

// test
import static live.winfinity.at.core.consts.CoreTags.<AREA>;
import static live.winfinity.at.core.consts.CoreTags.<COMPONENT>;
import static live.winfinity.at.core.consts.CoreTags.<COMPONENT>_<VERSION>;
import static live.winfinity.at.core.consts.tags.<service>.Core<Service>Tags.<TYPE>_<DOMAIN>;
```

Env tags — always a column, one `@Tag` per line:

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
        @Tag(<COMPONENT>),
        @Tag(<COMPONENT>_<VERSION>),
        @Tag(<AREA>),
        @Tag(<TYPE>_<DOMAIN>)
})
@AllureComponentCore
@Feature("API | <Service> | <version> | <Feature>[ | <Type> <entity>[ | <Operation> | <State>]]")
class <Operation><Type><Entity>sTests extends BaseApiTest {
```

Scope: `@SmokeTag` / `@CriticalTag` / `@ExtendedTag`. Component: `@AllureComponentCore`.

**No feature env tag** — do not add `@Tag(FEATURE_*)`; remove it (and its static import) when
refactoring, unless the user explicitly asks for it.

---

## Test method annotation order

Env tags → `@Test` → scope → `@AllureId` → `@DisplayName` → method:

```java
@Tags({
        @Tag(CERTIFICATION),
        @Tag(PREPROD),
        @Tag(RELEASE),
        @Tag(LATEST),
        @Tag(CORE_QA)
})
@Test
@CriticalTag
@AllureId("<id>")
@DisplayName("<Operation> <Type> <entity> <condition> and check error")
void <operation><Type><Entity><Condition>AndCheckError() {
    ...
}
```

Env set: if the folder convention is "everything runs certification", every method (positive
and `@CriticalTag` validation) keeps `@Tag(CERTIFICATION)` first. Otherwise `@CriticalTag`
validation methods drop it and keep `{PREPROD, RELEASE, LATEST, CORE_QA}`.

`@TestTemplate` methods carry only the template annotation and provider extension; the provider
owns display name, Allure id, scope and environments:

```java
@TestTemplate
@ExtendWith(<Field>LengthContextProvider.class)
void <operation><Type><Entity>With<Field>Length(Integer length) {
    ...
}
```

---

## SoftAssertions pattern

More than 2 assertions in a row — always wrap in `SoftAssertions`:

```java
SoftAssertions.assertSoftly(softAssertions -> {
    softAssertions.assertThat(actual.<fieldA>()).as("<fieldA>").isEqualTo(<expectedA>);
    softAssertions.assertThat(actual.<fieldB>()).as("<fieldB>").isEqualTo(<expectedB>);
    softAssertions.assertThat(actual.<fieldC>()).as("<fieldC>").isEqualTo(<expectedC>);
});
```

Import `org.assertj.core.api.SoftAssertions` (not the static `assertSoftly`).
In test classes and flows, 1–2 assertions stay `Assertions.assertThat`; import
`org.assertj.core.api.Assertions` and do not static-import `assertThat`.

**Hard structural preconditions come BEFORE the soft block** when the block indexes a
collection (REVIEW.md). Assert the size, read the element into a local variable, then keep
field checks inside `assertSoftly`:

```java
Assertions.assertThat(actual.<items>()).as("<items>").hasSize(1);
<Nested> actualItem = actual.<items>().getFirst();
SoftAssertions.assertSoftly(softAssertions -> {
    softAssertions.assertThat(actualItem.<id>()).as("<id>").isEqualTo(expected.<id>());
    ...
});
```

Without the size precondition, `getFirst()` on an empty list throws `NoSuchElementException`
instead of a readable assertion report. If no indexing is needed, prefer collection-style
assertions inside the block (`extracting(...).containsExactly(...)`, `hasSize`, `first()`).
One soft scope per verify method, never inside `forEach`.

---

## Validation assertion pattern

Each validation test targets one rule and asserts both status and the error body. The
expected body goes to a **local variable first** (`error` / `expectedError`) — never inline
the string literal in the call chain:

```java
String error = "\"/<endpoint> -> '<Field>' must not be empty.\"";
<entity>Steps.<operation>(request).statusCodeIs400().verifyErrorBody(error);
```

Message built from variables — `.formatted(...)`, still in a local variable:

```java
String error = ("\"/<endpoint> -> <message part with %s> " +
        "<message part with %s>.\"")
        .formatted(<argA>, <argB>);
```

Assert the error body when the message is deterministic. Some merged validation tests only
check `.statusCodeIs400()` (e.g. a payload fed an arbitrary key) — match the neighbouring tests
rather than forcing `verifyErrorBody` everywhere.

---

## Multiline formatted strings

Java applies `.formatted(...)` to the expression immediately before it. With concatenation,
wrap the whole string expression in parentheses; otherwise the first `%s` stays literal and
arguments shift.

Correct:

```java
String error = ("\"/<endpoint> -> <text with %s> " +
        "<text with %s>.\"")
        .formatted(<argA>, <argB>);
```

Wrong:

```java
String error = "\"/<endpoint> -> <text with %s> " +
        "<text with %s>.\"".formatted(<argA>, <argB>);
```

---

## FluentValidation error-body patterns

Always confirm on the first real run; default guesses seen across the repo:

- NotEmpty → `'<Field>' must not be empty.`
- Null / Empty rule on a non-empty value → `'<Field>' must be empty.` /
  `<Type> <entity> '<Field>' must be null.`
- MaxLength → `The length of '<Field>' must be <N> characters or fewer. You entered <M> characters.`
- Length range → `'<Field>' must be between <min> and <max> characters. You entered <M> characters.`
- Duplicates → `'{<Field>}' contains duplicate values` (no trailing dot)
- Required nested id → `The <Field> field is required.`
- The full message is prefixed with the endpoint path: `"/<service>/<version>/<endpoint> -> ..."`,
  and the response body keeps the surrounding quotes (`"\"...\""`).

---

## DisplayName (naming)

Plain natural-language names, **no** `[BVA]`/`[DT]`/`[EP]` prefixes:

- `<Operation> <Type> <entity> with <field> -> 400`
- `<Operation> <Type> <entity> with <field> <N> chars -> 400`
- `<Operation> <Type> <entity> without <items> -> 400`
- `<Operation> <State> <Type> <entity>: <scenario>[ and check error]` (state-dependent classes)

The name states the field under test and the expected result; the exact offending value goes
in the method name.

---

## Boundary naming

Describe the exact offending value in the method name:

- `...<Field><N>CharsReturns400`
- `...WithEmpty<Field>Returns400`

---

## Parameterized positive cases (@TestTemplate)

Merge BVA pairs into one `@TestTemplate`. The test method takes a **plain value** — no testcase
record; the provider passes the raw value via `.value(...)`:

```java
// test
@TestTemplate
@ExtendWith(<Field>LengthContextProvider.class)
void <operation><Type><Entity>With<Field>(Integer length) {
    createAndVerify<Type><Entity>With<Field>(RandomStringUtils.randomAlphabetic(length));
}
```

```java
// provider — api/src/test/java/.../core/providers/<service>/<domain>/
public class <Field>LengthContextProvider implements BaseTestTemplateInvocationProvider {

    private static final String TEMPLATE = "<Operation> <Type> <entity> with <field> %s";

    @Override
    public Stream<TestTemplateInvocationContext> provideTestTemplateInvocationContexts(ExtensionContext context) {
        return Stream.of(
                create(<min>, "<min> char", "<allureIdMin>", context),
                create(<max>, "<max> chars", "<allureIdMax>", context)
        );
    }

    private TestTemplateInvocationContext create(Integer length, String testCaseName, String allureId,
                                                 ExtensionContext context) {
        return buildTestContext(context)
                .displayName(TEMPLATE, testCaseName)
                .allureId(allureId)
                .value(length)
                .scopes(<smokeTag()|criticalTag()>)
                .environments(List.of(CERTIFICATION, PREPROD, RELEASE, LATEST, CORE_QA))
                .build();
    }
}
```

Do NOT put `@Tag`/`@AllureId`/`@DisplayName`/scope on the `@TestTemplate` method. Scope is per
provider (positives may be `smokeTag()`); each case has its own Allure id.

---

## Bean-name collision check

Spring names beans from the simple class name, so a new `@Component` must not reuse an existing
class name anywhere in the repo. This fails at context load:

```
ConflictingBeanDefinitionException: Annotation-specified bean name '<entity>sSteps'
for bean class [...core...<Entity>sSteps] conflicts with existing, non-compatible
bean definition ... [...<other package>.<Entity>sSteps]
```

Check first: `find api/src -name "<ClassName>.java"`. On collision, add a version suffix:
`<Entity>sSteps` → `<Entity>sV<N>Steps`. POJO records/enums are not beans.

---

## REST client overloads

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
Do NOT use `.replace("\"", "")` and do NOT parse with `ObjectMapper`. Mirror an existing
`*IdResponseWrapper` under `core/dto/`:

```java
// core/dto/<service>/<Entity>IdResponseWrapper.java
public class <Entity>IdResponseWrapper extends StringResponse {

    public <Entity>IdResponseWrapper(String data) {
        super(data);
    }

    public String <entity>Id() {
        return StringUtils.substringBetween(data(), "\"");
    }
}
```

```java
// Steps
@Step("Core V<N>: Create <entity>")
public RestResponse<<Entity>IdResponseWrapper, String> create(Create<Entity>Request request) {
    ...
    RestResponse<<Entity>IdResponseWrapper, String> response =
            haproxyClient.sendRequestAndWrapString(httpRequest, <Entity>IdResponseWrapper.class, String.class);
    if (response.code() == HttpStatus.CREATED) {
        keepCreated<Entity>(response.body().<entity>Id());
    }
    return response;
}
```

```java
// Flow — create+get orchestration shared by tests
@Step("Core: Create <Type> <entity> and get it")
public <Entity>Response createAndGet<Type><Entity>(<inputs>) {
    Create<Entity>Request request = Create<Entity>Request.<type>(<inputs>);
    return createAndGet<Entity>(request);
}

private <Entity>Response createAndGet<Entity>(Create<Entity>Request request) {
    String id = <entity>Steps.create(request).statusCodeIs201().body().<entity>Id();
    Assertions.assertThat(id).as("<entity>Id").isNotNull();
    return <entity>Steps.get<Entity>(id).statusCodeIs200().body();
}
```

---

## keepCreatedX cleanup helper (Steps)

`create` registers the id for cleanup via a `keepCreated<Entity>` helper. **Assert the delete
status inside the cleanup lambda** — otherwise a failed delete is silently treated as success
and the entity leaks on the env:

```java
private void keepCreated<Entity>(String id) {
    register(id, entityId -> hardDelete(List.of(entityId)).statusCodeIs204());
}
```

---

## Valid-request factory for negative tests

Two complementary factory shapes on the request POJO:

```java
// full factory — returns the built request (positive tests, flows)
public static Create<Entity>Request <type>(String name, <type-specific inputs>) {
    return Create<Entity>Request.builder()
                                .name(name)
                                .type(<Entity>Type.<TYPE>)
                                .<field>(<input>)
                                .build();
}

// builder factory — valid defaults, the test overrides exactly one field
public static Create<Entity>RequestBuilder valid<Type>Builder(<minimal ids>) {
    return Create<Entity>Request.builder()
                                .name(RandomUtils.random<Entity>Name())
                                .type(<Entity>Type.<TYPE>)
                                .<field>(<valid default>);
}
```

```java
// negative test — override only the field under test
Create<Entity>Request request = Create<Entity>Request.valid<Type>Builder(<ids>)
                                                     .<field>(<invalid value>)
                                                     .build();
```

**Type-specific builders bake the type contract** — a type without some field simply never
sets it; a type that requires a nested attribute always sets a valid one.

**"Requires an item" — ONE item with a null id**, not an empty list:

```java
Create<Entity>Request request = Create<Entity>Request.valid<Type>Builder(null).build();
String error = "\"/<endpoint> -> The <Field> field is required.\"";
<entity>Steps.create(request).statusCodeIs400().verifyErrorBody(error);
```

**Count rule — two DISTINCT valid items**, each fully valid, so only the count rule fires:

```java
String firstId = <create first valid item>;
String secondId = <create second valid item>;
Create<Entity>Request request = Create<Entity>Request.valid<Type>Builder(firstId)
                                                     .<items>(List.of(<Nested>.of(firstId),
                                                                      <Nested>.of(secondId)))
                                                     .build();
```

Do not reuse one static id for two elements and do not leave a nested required field null —
the duplicate-value / NotEmpty rules then fire instead.

---

## Enum constants

CAPS constants; if the backend serializes by value, add `value` + `@JsonValue`:

```java
@Getter
@AllArgsConstructor
public enum <Entity>Status {
    <STATE_A>("<StateA>"),
    <STATE_B>("<StateB>");

    @JsonValue
    private final String value;
}
```

---

## Response assertions interface

Verification lives in an `<Entity>Assertions` interface next to the response: it
`extends ObjectAssertions<T>`, the response record `implements` it and returns `this` from
`getSelf()`, each verify is a `default` method on `getSelf()`. Tests call the verify on the
response instance; flows stay thin and never verify.

```java
// .../get/assertions/<Entity>Assertions.java
public interface <Entity>Assertions extends ObjectAssertions<<Entity>Response> {

    default <Entity>Response verify<Type><Entity>(<expected fields>) {
        <Entity>Response actual = getSelf();
        SoftAssertions.assertSoftly(softAssertions -> {
            softAssertions.assertThat(actual.type()).as("type").isEqualTo(<Entity>Type.<TYPE>);
            ...
        });
        return actual;
    }
}
```

```java
// .../get/<Entity>Response.java — reuses nested DTOs from create.nested
public record <Entity>Response(String id, String name, ..., List<<Nested>> <items>)
        implements <Entity>Assertions {

    @Override
    public <Entity>Response getSelf() {
        return this;
    }
}
```

```java
// test — fluent call on the response
<entity>Flows.createAndGet<Type><Entity>(<inputs>)
             .verify<Type><Entity>(<expected fields>);
```

Status-aware verify (same entity verified in several states):
[State-dependent operation tests](#state-dependent-operation-tests).

For simple response types a verify may hold a single `assertThat` — see
[Simple verify methods](#simple-verify-methods-no-step).

---

## Verify full shape

Each `verify<Type><Entity>` asserts the **whole** GET response in one soft block — every field
of the response, including the ones that must be empty/null for this type. The structural
precondition (list size → `getFirst()`) is asserted **before** the block.

```java
default <Entity>Response verify<Type><Entity>(String name, <Nested> expectedItem) {
    <Entity>Response actual = getSelf();
    Assertions.assertThat(actual.<items>()).as("<items>").hasSize(1);
    <Nested> actualItem = actual.<items>().getFirst();
    SoftAssertions.assertSoftly(softAssertions -> {
        softAssertions.assertThat(actual.name()).as("name").isEqualTo(name);
        softAssertions.assertThat(actual.type()).as("type").isEqualTo(<Entity>Type.<TYPE>);
        softAssertions.assertThat(actual.status()).as("status").isEqualTo(<Entity>Status.<STATE>);
        softAssertions.assertThat(actual.<unusedForType>()).as("<unusedForType>").isEmpty();
        softAssertions.assertThat(actualItem.<id>()).as("<id>").isEqualTo(expectedItem.<id>());
        ...
    });
    return actual;
}
```

Multi-item lists — compare as tuples, no indexing:

```java
softAssertions.assertThat(actual.<items>()).as("<items>")
              .extracting(<Nested>::<id>, <Nested>::<attr>)
              .containsExactlyInAnyOrderElementsOf(expected.stream()
                                                           .map(i -> tuple(i.<id>(), i.<attr>()))
                                                           .toList());
```

Id lists of nested info objects — `extracting(<Info>::id).containsExactlyInAnyOrderElementsOf(ids)`.

---

## Fixed key list on a POJO

Fixed key sets are an **enum** under `core/enums/<domain>/`; the POJO builds its key list from
`.getValue()` and generates values from it — never inline string literals:

```java
// core/enums/<domain>/<Payload>Keys.java
@Getter
@AllArgsConstructor
public enum <Payload>Keys {

    <KEY_A>("<KeyA>"),
    <KEY_B>("<KeyB>");

    @JsonValue
    private final String value;
}
```

```java
// .../create/nested/<Payload>.java
public record <Payload>(Map<String, String> values) {

    public static final List<String> <PAYLOAD>_KEYS = List.of(<Payload>Keys.<KEY_A>.getValue(),
                                                              <Payload>Keys.<KEY_B>.getValue());

    public static <Payload> random() {
        Map<String, String> map = <PAYLOAD>_KEYS.stream()
                                               .collect(Collectors.toMap(key -> key,
                                                                         key -> RandomUtils.random<Value>()));
        return new <Payload>(map);
    }

    public Map<String, String> toMap() {
        return values;
    }
}
```

The key list is reused when a validation payload must miss one key.

---

## API-driven payload configuration

When the valid keys of a request payload come from **another API response** (configuration per
game/type), do not hardcode them.

### Lookup with a useful error

```java
@Step("Core: Get <config> by <key>")
public <Config> get<Config>(<Key> key) {
    String error = "There is no %s <config>.".formatted(key.getValue());
    return <x>Steps.get<Configs>(<version>).statusCodeIs200().body().data().stream()
                   .filter(c -> c.<key>() == key)
                   .findFirst()
                   .orElseThrow(() -> new QaWinfinityException(error));
}
```

### Payload built from the live configuration

```java
// .../create/nested/<Payload>.java
public record <Payload>(Map<String, String> values) {

    public static <Payload> of(<Config> config) {
        Map<String, String> map = config.<configItems>()
                                        .stream()
                                        .collect(Collectors.toMap(<ConfigItem>::key,
                                                                  item -> RandomUtils.random<Value>()));
        return new <Payload>(map);
    }

    public Map<String, String> toMap() {
        return values;
    }
}
```

Tests call `<Payload>.of(config).toMap()`. The expected error text for "payload must contain
exactly ..." is built from the same live data:

```java
String expectedKeys = config.<configItems>().stream()
                            .map(<ConfigItem>::key)
                            .collect(Collectors.joining(", "));
String error = ("\"/<endpoint> -> <Type> <entity> <payload> must contain exactly: %s.\"")
        .formatted(expectedKeys);
```

"Not configured" case — pick a config where the lists are empty; if none exists, fail setup
with a `QaWinfinityException`. When `error` is already used by setup, name the API message
`expectedError`.

### Prerequisite with a specific attribute

When the entity requires a table/site attribute static data does not cover, create a fresh
relation through the existing site/table flow passing that attribute; for "different value"
negatives create a matching prerequisite for the other value, so the request reaches the rule
under test. Call the flow directly — no private wrapper for a single call.

### Example — exact messages (branding campaigns, create)

```
"/backoffice/v5/createBrandingCampaign -> 'GameType' must not be empty."
"/backoffice/v5/createBrandingCampaign -> Dedicated campaign 'Assets' must not be empty."
"/backoffice/v5/createBrandingCampaign -> Dedicated campaign 'Settings' must not be empty."
"/backoffice/v5/createBrandingCampaign -> 'StreamId' must be empty."
"/backoffice/v5/createBrandingCampaign -> 'Tables' must not be empty."
"/backoffice/v5/createBrandingCampaign -> 'SiteIds' must not be empty."
"/backoffice/v5/createBrandingCampaign -> '{SiteIds}' contains duplicate values"
"/backoffice/v5/createBrandingCampaign -> '{Tables}' contains duplicate values"
"/backoffice/v5/createBrandingCampaign -> Tables with id(s) %s do not match the Dedicated campaign game type %s."
"/backoffice/v5/createBrandingCampaign -> Dedicated campaign assets must contain exactly: %s. Dedicated campaign settings must contain exactly: %s."
"/backoffice/v5/createBrandingCampaign -> %s does not have configured dedicated assets and settings."
"/backoffice/v5/createBrandingCampaign -> The TableId field is required."
```

### Example — exact messages (branding campaigns, update Draft)

```
"/backoffice/v5/updateBrandingCampaign -> Campaign type cannot be changed."
"/backoffice/v5/updateBrandingCampaign -> 'SiteIds' must not be empty."
"/backoffice/v5/updateBrandingCampaign -> 'GameType' must be empty."
"/backoffice/v5/updateBrandingCampaign -> 'Tables' must not be empty."
"/backoffice/v5/updateBrandingCampaign -> 'StreamId' must be empty."
"/backoffice/v5/updateBrandingCampaign -> '{Tables}' contains duplicate values"
"/backoffice/v5/updateBrandingCampaign -> '{SiteIds}' contains duplicate values"
"/backoffice/v5/updateBrandingCampaign -> Generic campaign 'Settings' must be null."
"/backoffice/v5/updateBrandingCampaign -> 'Name' must not be empty."
"/backoffice/v5/updateBrandingCampaign -> 'BrandedTableName' must be between 1 and 40 characters. You entered %s characters."
"/backoffice/v5/updateBrandingCampaign -> The length of 'Name' must be 200 characters or fewer. You entered 201 characters."
```

A length error depending on a provider value is built from the value
(`.formatted(invalidValue.length())`); a fixed-length test keeps a static message.

---

## State-dependent operation tests

Testing an operation on an entity first moved to a non-initial state (e.g. update of an
Active entity).

### Class header

```java
@Tags({
        @Tag(<COMPONENT>),
        @Tag(<COMPONENT>_<VERSION>),
        @Tag(<AREA>),
        @Tag(<OPERATION>_<STATE>_<TYPE>_<DOMAIN>)
})
@AllureComponentCore
@Feature("API | <Service> | <version> | <Feature> | <Type> <entity> | <Operation> | <State>")
class <Operation><State><Type><Entity>sTests extends BaseApiTest {
```

```java
// Core<Service>Tags
public static final String <OPERATION>_<STATE>_<TYPE>_<DOMAIN> = "<operation><State><Type><Domain>";
```

### Flow — create in the target state

```java
@Step("Core: Create, <transition> and get <Type> <entity>")
public <Entity>Response create<Transition>AndGet<Type><Entity>(<prerequisites>) {
    Create<Entity>Request request = Create<Entity>Request.<type>(RandomUtils.random<Entity>Name(),
                                                                 <prerequisites>, <random payload>);
    return create<Transition>AndGet<Entity>(request);
}

private <Entity>Response create<Transition>AndGet<Entity>(Create<Entity>Request request) {
    String id = <entity>Steps.create(request).statusCodeIs201().body().<entity>Id();
    Assertions.assertThat(id).as("<entity>Id").isNotNull();
    <entity>Steps.updateStatus(id, <Entity>Status.<STATE>).statusCodeIs204();
    return <entity>Steps.get<Entity>(id).statusCodeIs200().body();
}
```

### Status-aware verify

```java
default <Entity>Response verify<State><Type><Entity>(<expected fields>) {
    return verify<Type><Entity>(<expected fields>, <Entity>Status.<STATE>);
}

private <Entity>Response verify<Type><Entity>(<expected fields>, <Entity>Status status) {
    <Entity>Response actual = getSelf();
    SoftAssertions.assertSoftly(softAssertions -> {
        ...
        softAssertions.assertThat(actual.status()).as("status").isEqualTo(status);
    });
    return actual;
}
```

The private method carries no state in its name — every state wrapper calls it. Rename existing
callers in the same MR.

### Test bodies

Positive — arrange the entity in the state, blank line, then build the request from the
response values, changing only what the scenario allows:

```java
<prerequisites>
<Entity>Response entity = <entity>Flows.create<Transition>AndGet<Type><Entity>(<prerequisites>);

<new values for the scenario>
Update<Entity>Request request = Update<Entity>Request.<type>(entity.id(), entity.name(),
                                                             <changed fields>, <unchanged fields from entity>);
<entity>Flows.updateAndGet<Entity>(request)
             .verify<State><Type><Entity>(entity.name(), <expected fields>);
```

Negative — same arrange, change exactly one field, everything else from the response:

```java
Update<Entity>Request request = Update<Entity>Request.<type>(entity.id(), <changed field>,
                                                             <all other fields from entity>);
String error = "\"/<endpoint> -> <message>\"";
<entity>Steps.update(request).statusCodeIs400().verifyErrorBody(error);
```

Wrong: a `<type>Builder(...)` that randomizes name/payload/nested values — the request breaks
several state rules at once and the test depends on validation order. If a builder is
unavoidable, override every non-target field back to the entity's values.

Count rule — existing items unchanged + one fully valid extra item. Duplicate rule — the same
id twice (`List.of(id, id)`).

### Naming

| Kind     | Method                                                    | DisplayName                                                        |
|----------|-----------------------------------------------------------|--------------------------------------------------------------------|
| Positive | `<operation><State><Type><Entity><Scenario>`              | `<Operation> <State> <Type> <entity>: <scenario>`                  |
| Negative | `<operation><State><Type><Entity><Scenario>CheckError`    | `<Operation> <State> <Type> <entity>: <scenario> and check error`  |

### Example — exact messages (branding campaigns, update Active)

```
"/backoffice/v5/updateBrandingCampaign -> Table %s cannot be updated while the campaign is Active. Only adding new tables or removing existing ones is allowed."
"/backoffice/v5/updateBrandingCampaign -> Campaign name cannot be changed while it is Active."
"/backoffice/v5/updateBrandingCampaign -> Assets and Settings cannot be changed while the campaign is Active."
"/backoffice/v5/updateBrandingCampaign -> BlueScreen campaign requires exactly one table."
"/backoffice/v5/updateBrandingCampaign -> BlueScreen campaign 'Assets' must be null."
"/backoffice/v5/updateBrandingCampaign -> BlueScreen campaign 'Settings' must be null."
"/backoffice/v5/updateBrandingCampaign -> 'StreamId' must not be empty."
```

"Table %s cannot be updated" fires for any change of an existing item's attributes (set,
change, remove); adding/removing whole items is allowed in that state.

---

## Awaitility patterns

Async results (Kafka consumption, cache invalidation) are polled with **Awaitility** in a
**Flow method**, not in the test. Imports: `org.awaitility.Awaitility`, `org.awaitility.Durations`.
Decide first whether a poll is needed at all —
[Wait for service consumption](SKILL.md#wait-for-service-consumption).

### Wait until condition becomes true (`until`)

```java
@Step("Core: Wait until <thing> contains {expected}")
public <Thing>Response wait<Thing>Contains(String <ownerId>, List<String> expected) {
    return Awaitility.with()
                     .pollInterval(Durations.ONE_SECOND)
                     .await()
                     .alias("<thing> contains " + expected)
                     .pollInSameThread()
                     .ignoreExceptions()
                     .atMost(Durations.TEN_SECONDS)
                     .until(() -> get<Thing>(<ownerId>),
                            r -> r.statusCodeIs200().body().<items>().containsAll(expected))
                     .body();
}

private RestResponse<<Thing>Response, String> get<Thing>(String <ownerId>) {
    return <x>Steps.<call>(<Thing>Params.of(<ownerId>));
}
```

`.ignoreExceptions()` is mandatory whenever the condition asserts (`statusCodeIs200()` throws
on a bad status) — `REVIEW.md` rejects pollers without it. A permanent failure still ends as a
timeout with the last error as the cause.

### Prove consumption, then assert absence

Preferred for "must NOT appear": first wait for something that **does** change after the
message is consumed (response message on the listener, another field, a history read by
`gameId`), then read once and assert absence:

```java
String gameId = send<GameKind><Message>With<Condition>(session);
<history>Flows.waitUntil<Details>NotEmpty(session.<msid>(), gameId);

<x>Flows.get<Thing>(<ownerId>)
        .verify<Items>DoesNotContain(<unexpected>);
```

The same pattern proves the **second send on the same entity**: the presence wait is already
true after the first send, so wait for the second round's `gameId` before the read under test.

### Settle-window wait (`during`) — only when the user picks it

Weaker than proving consumption (known limitation). Use **only** when nothing can prove
consumption **and** the user chose this option. Never on a presence wait. Comment why:

```java
@Step("Core: Wait until <thing> does not contain {unexpected}")
public <Thing>Response wait<Thing>DoesNotContain(String <ownerId>, String unexpected) {
    // <why an empty snapshot is ambiguous and why the settle window is accepted here>
    Awaitility.with()
              .pollInterval(Durations.ONE_SECOND)
              .await()
              .pollInSameThread()
              .ignoreExceptions()
              .during(Durations.FIVE_SECONDS)
              .atMost(Durations.TEN_SECONDS)
              .until(() -> get<Thing>(<ownerId>),
                     r -> !r.statusCodeIs200().body().<items>().contains(unexpected));
    return get<Thing>(<ownerId>).statusCodeIs200().body();
}
```

Rules:
- **Keep `until()` lambdas inline** — no `Predicate` variables, no `AtomicReference`.
- **`pollInSameThread()`** — always (RestClient thread-safety).
- **Fixed bounds** — 1 s interval, 10 s limit; no custom durations without a reason.
- **One wait method with a `List` parameter** instead of single/multi overloads.
- No `Thread.sleep` / `Waiter.wait()`.

---

## Kafka listener pattern

Listener created **before** the send, topic from the enum, condition named `condition`,
`TEN_SECONDS` timeout, field checks after `waitUntilReceived()`:

```java
@LazyAutowired
private KafkaListenersManager kafkaListenersManager;

@Test
@KafkaTag
...
void <scenario>() {
    KafkaMessagesListener<<Message>> listener =
            kafkaListenersManager.startListen<Format>(<Topic>.<TOPIC_CONSTANT>);

    <send the message / call the API that produces it>

    ConditionBuilder<<Message>> condition = new ConditionBuilder<<Message>>()
            .fieldEquals(<Message>::<key>, <expectedKey>);
    <Message> message = listener.options(Durations.TEN_SECONDS, <Message>.class)
                                .conditionBuilder(condition)
                                .waitUntilReceived();
    message.verify<Fields>(<expected fields>);

    listener.clear();
    <next send + wait on the same listener>
}
```

- `@KafkaTag` on the methods that touch Kafka; on the class only when all of them do.
- `startListenAvro` vs JSON variant — as `REVIEW.md` / the neighbouring tests decide for that
  topic.
- Absence: `.waitUntilNotReceived()` with the same condition shape.
- Do not check new fields via `fieldNotNull()` inside the condition — the condition only
  identifies the message; field checks go on the assertion interface.

---

## QueryParamsConverter pattern

GET query parameters go to a `<Query>Params` class under `core/params/<service>/<domain>/`:

```java
@Getter
@Builder
@AllArgsConstructor
public class <Query>Params implements QueryParamsConverter {

    private String <param>;

    public static <Query>Params of(String <param>) {
        return <Query>Params.builder().<param>(<param>).build();
    }

    @Override
    public List<QueryParam> convert() {
        List<QueryParam> result = new ArrayList<>();
        Optional.ofNullable(<param>).ifPresent(value -> result.add(new QueryParam(Param.<PARAM>, value)));
        return result;
    }

    @NoArgsConstructor(access = AccessLevel.PRIVATE)
    static class Param {

        static final String <PARAM> = "<param>";
    }
}
```

```java
// Steps
@Step("Core V<N>: Get <thing>")
public RestResponse<<Thing>Response, String> get<Thing>(<Query>Params params) {
    HttpRequest request = HttpRequest.builder()
                                     .method(Method.GET)
                                     .baseUrl(haproxyUrl)
                                     .path(BASE_PATH, <ENDPOINT>)
                                     .objectQueryParams(params)
                                     .build();
    return haproxyClient.sendRequest(request, <Thing>Response.class, String.class);
}
```

---

## Simple verify methods (no `@Step`)

Single-check verifies on a simple response — **no `@Step`** (TestOps already shows a step per
interface method):

```java
public interface <Thing>ResponseAssertions extends ObjectAssertions<<Thing>Response> {

    default <Thing>Response verify<Items>Contains(String item) {
        assertThat(getSelf().<items>()).as("<items>").contains(item);
        return getSelf();
    }

    default <Thing>Response verify<Items>Empty() {
        assertThat(getSelf().<items>()).as("<items>").isEmpty();
        return getSelf();
    }
}
```

Rules:
- Each verify returns `getSelf()` for chaining.
- Inside assertions interfaces a static import of `assertThat` is allowed.
- Single-assertion verifies do not need `SoftAssertions`.
- `hasSize(n)` not `size().isEqualTo(n)`; `isZero()` not `isEqualTo(0)`.

---

## Session-based tests (Kafka / game rounds)

Game-round processing tests start a player session through the existing player flow; it picks
a static table for the game type — no site/table creation needed:

```java
private static final GameType <KIND>_GAME_TYPE = GameType.<GAME>;

Session session = <player>Flows.startSession(<KIND>_GAME_TYPE);
String tableId = session.tableId();
String playerId = session.internalUserId();
```

Cross-session (same user, another game type/table):

```java
Session firstSession = <player>Flows.startSession(<KIND_A>_GAME_TYPE);
User user = firstSession.user();
String secondTableId = <staticTables>.getStaticTableIdByGameType(<KIND_B>_GAME_TYPE);
Session secondSession = Session.of(secondTableId, <KIND_B>_GAME_TYPE, user);
```

### Kafka message helpers in tests

One private helper per message type; live-game rounds need a start message before
finish/cancel:

```java
private String send<GameKind>FinishWith<Condition>(Session session) {
    String gameId = RandomUtils.randomGameId();
    <statistic>Flows.sendStartMessage(session.tableId(), gameId, <KIND>_GAME_TYPE);
    <statistic>Flows.sendFinishMessage(session, gameId);
    return gameId;
}
```

Return the `gameId` — a later step may need it to prove that this round was consumed.

### Versioned Steps class for non-BackOffice services

`@RequiredArgsConstructor` + `private final` injection (field named like the bean), `@Value`
for config; the version lives in `BASE_PATH`, no separate `V_<N>` constant:

```java
@Component
@RequiredArgsConstructor
public class <Service>V<N>Steps {

    private static final String BASE_PATH = "/<service>/v<N>";
    private static final String <ENDPOINT> = "/<endpoint>";

    private final RestClient haproxyClient;

    @Value("${haproxy.url}")
    private String haproxyUrl;
}
```

### Two coexisting versions of one endpoint

One Steps class per version, version in `BASE_PATH`, versioned test **package**:

```
api/src/main/java/live/winfinity/at/core/gateway/steps/<service>/
├── v1/<Service>V1Steps.java   // BASE_PATH = "/<service>/api/v1"; keeps shared read endpoints
└── v2/<Service>V2Steps.java   // BASE_PATH = "/<service>/api/v2"

api/src/test/java/live/winfinity/at/core/<service>/
├── v1/<Feature>Tests.java     // @Feature("API | <Service> | v1 | <Feature>")
└── v2/<Feature>Tests.java     // @Feature("API | <Service> | v2 | <Feature>") — no V2 in class name
```

Rules:

- **Do NOT** keep both versions in one class with a `version` parameter or `*V2` method
  suffixes — split classes.
- A v2 test needing a shared read step autowires the v1 Steps class; the read method is not
  duplicated into v2.
- **Authorized/internal endpoints** use a dedicated RestClient bean fed by a `*TokenProvider` +
  `BearerTokenInterceptor`. A 403 usually means the wrong (unauthorized) client or an
  interceptor bean wired by the wrong name — bean params resolve by name.

---

## Project structure examples

Two merged domains that follow the [canonical layout](SKILL.md#project-structure-canonical-core-feature-layout):

- BackOffice branding campaigns — `core/enums/brandingcampaigns/`,
  `core/gateway/pojo/backoffice/brandingcampaigns/{create,get,update,harddelete}/`,
  `core/gateway/steps/backoffice/brandingcampaigns/`, `core/gateway/flows/backOffice/brandingcampaigns/`,
  tests in `core/backoffice/brandingcampaigns/{create,update}/`.
- PlayerStats v6 — `core/gateway/pojo/playerstats/`, `core/gateway/steps/playerstats/v6/`,
  `core/gateway/flows/playerstats/v6/`, `core/params/playerstats/`, tests in `core/playerstats/`.

Open them to see a full working implementation of the templates above.

---

## TODO — team data to fill incrementally

Scratchpad (kept out of `SKILL.md` so it is not loaded on every invocation).

- [ ] Roster / roles / reviewers (if any besides the owner).
- [ ] Who assigns Allure ID ranges and the process.
- [ ] `knowledge-map` local path and service repo local paths.
- [ ] Team-specific environment matrix.
