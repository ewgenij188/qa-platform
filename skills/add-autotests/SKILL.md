---
name: add-autotests
description: >-
  Writes CORE-domain API autotests in qa-tests-v2 from detailed test cases
  (Name, Description, Precondition, Scenario, Expected). One case per turn.
  On retry, continues from the first case that has no test yet. Only the
  CORE domain: live.winfinity.at.core. Asks once for every new Allure ID,
  then writes one test per turn; never invents an id. Use when the user asks to
  add, write, or automate CORE autotests from test cases. A new live game
  type uses add-new-game-type-autotests. Running a pipeline uses autotests-run.
---

# Add CORE autotests

Write or extend **CORE domain** API autotests in **qa-tests-v2** from detailed cases. One case is one `@Test`. Do not invent a path, status, field, or id.

**One case per turn.** A batch is not written in one pass. Find the first case that has no test yet, write only that case, and stop. A retry, a "continue", or "do the rest" does the same: look at the repo again and take the first case that is still not covered. Do not rely on the previous turn. If `mvn` is on the machine, compile and fix failures. If it is not, say the build was not checked locally and continue. A missing Maven is not a blocker.

**CORE only.** Tests go under `api/src/test/java/live/winfinity/at/core/`. Steps, flows, and POJOs that exist only for those tests go under `api/src/main/java/live/winfinity/at/core/`. The class has `@AllureComponentCore`. If the case is not CORE — UI, promo, or a game component (roulette, blackjack, and the rest) — stop and say this skill does not cover it. Do not add that test.

This skill does not create Allure TestOps cases.

## Read first

- `knowledge-map/testing/qa-tests-v2-core.md` — layout, tags, Kafka, steps, what to reject.
- qa-tests-v2: root `AGENTS.md`, `api/src/test/AGENTS.md`, `api/src/main/AGENTS.md`, `REVIEW.md`.
- The test class and steps you will edit. Mirror that package.

Where this skill states an order or a mapping, follow this skill.

**Repo:** `wnf3/qa/qa-tests-v2`, default branch `master`. Use the local clone. If there is no clone, stop and ask. Do not guess a checkout path.

## Inputs

Cases use the `create-testcases` detailed shape. The same shape pasted in chat is valid.

```markdown
### 1.6 SGLM finished round with zero bet

- Name: API | CORE | PlayerStats | SGLM finished round with zero bet does not appear in recently played
- Description: No description so far
- Precondition:
  - Create a player session
  - Create and activate table A
- Scenario:
  - Send SGLM finish message for table A with betAmount = 0
  - Check StatisticGameLoopMessage in topic core.statistic.game.loop.message
  - Send {{GW_API_URI}}/playerstats/v6/recentlyPlayed?playerId={{player_id}}
- Expected:
  - 200
  - tableIds is []
```

`{{placeholders}}` are values from an earlier step. Do not replace them with a real id.

## One case per turn

1. Keep the cases in the order given.
2. A case is covered when `api/src/test/java/live/winfinity/at/core/` has a `@Test` or a provider row whose `@DisplayName` is the case name's last segment, or whose `@AllureId` is the id the user assigned to that case. Search the repo. Chat history is not coverage.
3. A method that is only started — it does not assert the Expected, or `mvn` is available and the module does not compile — is not covered. Finish that case. Do not open the next one.
4. Skip a case that cannot be automated (`In DB`, a job the suite cannot run). It is not the next case.
5. Write the first case that is not covered. Shared steps or POJOs that this case needs may be added with it. Do not add the other cases' test methods.
6. If `mvn` is on `PATH`, compile from the qa-tests-v2 root (`mvn -pl api -am test-compile --no-transfer-progress -q`) and fix compile errors before you stop. If `mvn` is missing, do not install it and do not block: say the build was not checked locally and that CI will compile it. Report this case, the cases already covered, and the id of the next uncovered case. Stop. Do not start that next case in this turn.

Ask for every new Allure ID in one message before the first edit. One id per new `@Test` and per new provider row. Wait for the full list. Later turns use that list and do not ask again. A missing id for the case you are about to write stops that case until the user supplies it.

## Ask, then wait

The user's detailed cases are the input. Whenever anything about a case is unclear, ask the user and wait. Do not decide it yourself. This covers any doubt, not a fixed list: what the Expected means, which endpoint, message or data a step needs, whether the state can be reached, how to prove the service consumed a message, how to read a case that looks wrong or contradicts the code. Ask in one message, with the options you see.

Stop before any edit when any of these is missing. Ask in one message.

- Jira ticket.
- Branch. If the user already named it, that is the answer.
- Allure IDs for every new test in the batch. See below.

### Allure ID

Each new `@Test` and each new `@TestTemplate` provider row needs its own Allure ID. Ask for all of them in one message: case id, `@DisplayName`, and a blank for the Allure ID. Wait until the user fills the whole list. Then implement one case per turn, using the id from that list.

Do not write the first test until the ids are in. Do not ask again on a later turn when the list is already complete.

Keep the `@AllureId` already on a test you are only editing. Do not ask again for that id.

Never invent, copy, or increment an Allure ID. Do not use `@AllureId("0")` unless the user explicitly says to leave a placeholder.

Also ask, and do not guess, when:

- The case must change a table or site, and it is still unclear what must change. A table the test does not change stays the static one. See below.
- A scenario line matches more than one existing step or flow.
- The case and the service code disagree. Show both.
- The case says `In DB`, or it needs a job or a direct database read the suite does not have. Skip that case and say what is missing.

## Git

1. New branch or existing. New branch name: `{username}/{TICKET}-{kebab-case-description}`.
2. Before creating a branch: `git fetch`, checkout `master`, `git pull --ff-only origin master`. Do not merge `master` into an existing branch unless asked.
3. `git status --short` and re-read every file before editing.
4. No commit and no push unless the current message explicitly approves it. Commit message: `[{TICKET}] Short message`. Before every push, re-read the whole diff against `REVIEW.md` and this skill.
5. MR title: `[{TICKET}] {what the tests cover}`, for example `[CORE-4361] add recentlyPlayed autotests for RNG and SGLM rounds`.
6. Never stage `bootstrap.properties`.
7. Review comments: reply on each thread, in that thread, with what changed and the commit SHA. Do not resolve a thread; its author does. Do not write "Done" for a comment you did not change in code. A finding you decline gets a reply that says why (for example a known limitation kept to avoid overcomplicating the case).
8. Harold, the review bot, does not re-review on its own. After you push fixes and answer the threads, post a general MR note that tags Harold (`@group_14157383_bot_9660debb30f810e73bd80719a0b0fe28`) and asks for a new review, with the new head SHA and a one-line summary of what changed. Do this on every push that answers review comments.

## Case → test

| Case field | Code |
|------------|------|
| Name, last segment | `@DisplayName`. Method name is that phrase in camelCase. It says the observable result (`...DoesNotAppearInRecentlyPlayed`), not domain jargon such as "is not a bet". |
| Name, service segment | Package under `core/{area}/` from the knowledge-map service table. |
| Description `No description so far` | Omit. A Featbit flag is not set inside the test. See below. Any other description is a flag or condition to set up, not a comment. |
| Precondition | Setup before the action, through an existing flow. `No precondition` means none. Do not create a table or site the test does not change. Use the static table and the default QA partner: `corePlayerFlows.startSession(gameType)`, or `sessionAbstractFactory.builder(gameType).tableId(tableId).create()` when that static id is already known. Create a table or site only when the test must change it. |
| `Send {{GW_API_URI}}/...` | One steps method. Query and body from that line. |
| Send a message that is not `{{GW_API_URI}}` | Existing Kafka sender. Avro or JSON as `REVIEW.md` decides. |
| `Check {Message} in topic {topic}` | Listener **before** that send. Topic enum (`CoreTopic` or another `WinfinityTopic`), never the raw topic string. |
| `In DB ...` | Do not automate. |
| Expected status | `.statusCodeIs{code}()` on the `Send {{GW_API_URI}}` line it follows. |
| Expected body | AssertJ with `.as("field")` on that same call. `[]` is empty, not null. |

A `Check ... in topic` line is asserted as the message received with the fields that line names, unless the case gives those fields their own Expected. Several Scenario/Expected pairs stay in one method, in order. Each Expected belongs to the call above it.

Before each step that depends on a message sent earlier, decide whether that message is already consumed. See [Wait for service consumption](#wait-for-service-consumption).

A case whose description is a Featbit flag is never Easy. It is Medium when a flag already configured on the environment is enough, and Hard or Impossible when that flag still cannot be set for a test run. The test does not create or flip the flag. Say so in the report, and name the flag. Do not treat the missing flag as a reason to skip the case.

Group cases that share one feature into one `{Feature}Tests` class. Do not mix features. Package-private class, `extends BaseApiTest`, `@AllureComponentCore`. `@Feature` matches the neighboring class. A new package uses `API | {Service} | {area}`. When the tests target one endpoint version, put that version in `@Feature` only, not in `@DisplayName` or the method name: `@Feature("API | Partners | v10 | Get session")`.

Do not repeat `@AllureLayerApi`. It is already on `BaseApiTest`. WebSocket tests extend `BaseWsTest`.

## Annotations

New `@Test` methods, in this order. Match the class when you add a method to an existing file.

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
@AllureId("12345")
@DisplayName("SGLM finished round with zero bet does not appear in recently played")
void sglmFinishedRoundWithZeroBetDoesNotAppearInRecentlyPlayed() { }
```

- One scope annotation. `@CriticalTag` unless the user says smoke. `@SmokeTag` already includes critical and extended. Do not stack scope annotations.
- Environment tags are the standard set above. Drop an environment when `application-{environment}.properties` has no value the test needs. Add `FEATURE_*` only when the user asks.
- Import tag constants. Do not hardcode tag strings. Area tags come from `CoreTags` or `CoreBackofficeTags`. Add a constant only when none fits.
- `@KafkaTag` on each method that produces or consumes Kafka, not on the class (`REVIEW.md`: tightest correct scope). An HTTP-only method in the same class stays untagged. Put it on the class only when every `@Test` in it touches Kafka.
- `@DisplayName` is a short sentence of what is verified. The method name is that sentence in camelCase. A negative ends with `and check error` (for example `Get not existing campaign and check error`). The provider `TEMPLATE` is that same sentence, with `%s` for the varying part.
- `@TestTemplate` carries only `@TestTemplate` and `@ExtendWith`. Display name, Allure ID, scope, and environments live in a `BaseTestTemplateInvocationProvider`. Never `@ParameterizedTest`, `@ValueSource`, or `@MethodSource`.
- A provider row with several fields uses a testcase record. A single boundary value uses `.value(theValue)`.

## Code

Search steps, flows, POJOs, and tests before adding a type. Extend the existing class for that endpoint. Add the assertion to an existing `@AllureId` when that test already performs the action. Do not add a private helper that only calls one existing flow. A new endpoint version still gets its own steps class, and a reusable wait still goes on a flow.

- **Steps** — one HTTP call, return `RestResponse`, no assertions. A new endpoint version gets its own class, not new methods on the unversioned one: `{Service}V{n}Steps` in `steps/{area}/v{n}/`, as `PartnersV10Steps` and `steps/playerstats/v6/PlayerStatsV6Steps`. `@Step("Core | {Area}: {action} {parameterName}")`, with the parameter name, not `{0}`. `RestClient` injection has `@Qualifier`. Build the path with `path(...)`, not string concatenation. Put the version in the base path (`BASE_PATH = "/playerstats/v6"`), not in a separate `V_6` constant: the class name already carries it. Pick the `RestClient` overload from `api/src/main/AGENTS.md`. When `verifyErrorBody` checks a string, the error type is `String.class`, not `Unknown` or `GatewayError`.
- **Flows** — a method another test can call goes on a flow, not a private method in the test. Pass the values that differ as parameters, so the next test reuses the same method. A versioned API uses `{Service}V{n}Flows` in `flows/{area}/v{n}/`. `@Step` on a flow uses parameter names too (`{tableIds}`), not `{0}` or `{1}`. Call an existing flow directly.
- **POJOs** — a new domain groups request and response types by operation (`create/`, `update/`, …). Nested types go in `nested/`. Assertion interfaces go in `assertions/` under that operation. An existing domain keeps its layout.
- **Beans** — `@LazyAutowired`, not `@Autowired`. A new `@Component` simple name must be unique in the repo (`find api/src -name '<Name>.java'`). Do not put per-test state in a singleton field. Do not let a new `@Component` extend another `@Component`.
- **Cleanup** — `CleanUpHandler.register` with an explicit priority. No `@AfterEach` to delete resources. No `Thread.sleep` or `Waiter.wait()`.
- **Data** — no hardcoded ids, URLs, or credentials. Use `@Value`, an existing factory, or `RandomUtils` (`randomUserId()`, `randomPromoId()`, or the generator that already exists for that value). Do not use `UUIDUtils` for a value `RandomUtils` already generates. A boundary the case names stays a literal.
- **Assertions** — every check lives on a `*Assertions` interface next to the response. The test calls those methods. Do not put `@Step` on them: TestOps shows a step for each interface method. `.as("field")` matches the field. `hasSize`, not `size().isEqualTo`. `isZero`, not `isEqualTo(0)`. More than two checks on one result go in one `SoftAssertions` block. Assert size before `getFirst()` inside that block.
- **Errors** — `String error = "..."` before the call, then `.formatted(...)`. Parentheses around a concatenated string before `.formatted()`. The same shape goes above `orElseThrow`: `String error = "There is no %s.".formatted(name)`. One validation rule per test. Setup must reach the API. Do not leave a second rule broken, and do not use a static table the environment does not have.
- **Kafka** — `KafkaListenersManager` interface. Variable name `condition`. Timeout `Durations.TEN_SECONDS`. `listener.clear()` between waits on the same listener. New field checks go on the assertion interface after `waitUntilReceived()`, not `fieldNotNull()` in the condition.
- **Style** — constants, then `@LazyAutowired`, then `@Value`, then instance fields. `@BeforeEach`, then tests, then private helpers. No `public` on the test class. No numbered step comments. A comment explains why, in English. No wildcard imports. Static imports for constants. Align a call chain under the first dot: `flows.method(args)` then `.verifyX()` on the next line, indented to that dot. Apply it to every chain in the class. Match the surrounding file.

A raw quoted id uses the existing `StringResponse` + `sendRequestAndWrapString` pattern. Mirror a wrapper already in `core/dto`. Do not strip quotes with `replace`.

## Wait for service consumption

Before the next step, decide whether the service has already consumed the message this step depends on. Do not add a wait on every read. Do not skip the question.

Consumption is already proven when an earlier step in this test received the service's response message (a listener on the topic the service produces, `waitUntilReceived()`). The next read can follow that check. No extra poll.

Poll only when nothing in the test has shown consumption yet and the next call reads state that changes only after the service consumes the message. A read straight after a sent message is this case: the body is still the old value if the call is immediate.

Put that wait on the flow and pass in what the caller expects to see. `until` returns the response, so do not keep an `AtomicReference` or a separate `Predicate`.

```java
@Step("Core: Wait until {what is consumed}")
public SomeResponse waitUntilConsumed(SomeRequest request, Expected expected) {
    return Awaitility.with()
                     .pollInterval(Durations.ONE_SECOND)
                     .await()
                     .pollInSameThread()
                     .atMost(Durations.TEN_SECONDS)
                     .until(() -> steps.call(request),
                            response -> response.statusCodeIs200().body().containsExpected(expected))
                     .body();
}
```

`containsExpected` stands for the real check on that body: the id is present, the collection contains the values, or the size is the expected one. Same bounds for any such wait: one-second interval, ten-second limit, `pollInSameThread`, re-fetch inside `until`, return the body. Do not `Thread.sleep`. Add `.ignoreExceptions()` whenever the `until` condition asserts (`statusCodeIs200()` throws on a bad status): `REVIEW.md` rejects pollers that assert inside the condition without ignoring exceptions, because one flaky response would abort an otherwise passing wait. A permanent failure still ends as a timeout with the last error as the cause. Add `.alias("...")` when a readable timeout message helps.

A validation call that fails before consumption (missing id → 400) does not wait.

A negative that expects an empty list cannot poll until empty. Empty is also the state before consumption. Prove consumption another way first — a response message, or a field that does change — then assert the absence. If nothing proves consumption, ask the user before writing that case. One option to offer: `.during(Durations.FIVE_SECONDS)` on that one wait, so the absence must hold for a window and the check does not pass on the first poll, with a comment on the method that says why. It is weaker than proving consumption, so it is a known limitation. Use it only when the user picks it. Never add `.during(...)` to a wait for presence.

A second send on the same entity (two bets on the same table) has the same weakness: the presence wait is already true from the first send. Keep the second round's gameId and prove it was processed before the next read: `externalHistoryFlows.waitUntilGameDetailsNotEmpty(session.msid(), secondGameId)` waits until history/gameDetails returns that round. Then call the read under test (for example recentlyPlayed). The send helper returns the gameId. If history cannot prove it for the case at hand, ask the user.

## Verify

Check for `mvn` on `PATH`.

- **Maven is present.** From the qa-tests-v2 root run `mvn -pl api -am test-compile --no-transfer-progress -q`. Fix compile errors and unused imports. Do not run the test suite unless the user asks. Report the compile result.
- **Maven is absent.** Do not install it. Do not treat that as a failure. Remove unused imports by reading the file. Tell the user: **Build was not checked locally.** CI will compile it.

Then report, in chat, and stop:

- this case → class, method, Allure ID
- cases already covered
- the next uncovered case id, without writing it
- files added or edited
- compile result, or that the build was not checked locally
- cases skipped, and any assumption that still needs a runtime check
