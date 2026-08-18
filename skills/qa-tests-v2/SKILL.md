# qa-tests-v2 

> **Actual project path:** `/Users/yauhenizhuk/IdeaProjects/qa-tests-v2`
> (This workspace at `Documents/OpenCode/qa-tests-v2` is a config mirror only)

# qa-tests-v2 Agent Guide

> Cross-module architectural facts that are hard to discover by reading a single file.
> For module-specific coding conventions, see `AGENTS.md` files in individual modules (`api/`, `ui/`, `mr/`, `testcase-info/`).

---

## Build & Run Commands

```bash
# Full build (required before testcase-info or mr can run)
mvn clean install --no-transfer-progress

# API tests by tag
mvn clean test -pl api --no-transfer-progress -Dgroups="your_tag_expression"

# UI tests by tag
mvn clean test -pl ui --no-transfer-progress -Dgroups="your_tag_expression"

# MR/regression tests (skipped by default; must enable explicitly)
mvn clean test -pl mr -Dskip.mr.tests=false --no-transfer-progress -Dgroups="your_tags"

# Local run with Vault secret
mvn -DVAULT_SECRET=<value> clean test -pl api -Dgroups=debug

# Allure report
mvn allure:serve
```

- **Java version gotcha:** `pom.xml` targets **25**, but `docs/run_tests.md` says "Use JAVA 17". CI images are JDK 17/21. Local builds need Java 25 to compile; CI may differ.
- Default Maven tag filter is `groups=unit` — most test tags require overriding `-Dgroups`.
- Parallelism: API tests run 10 threads (`api.threads=10`), UI tests run 4 threads (`ui.threads=4`). Configured in `pom.xml` properties.

---

## Module Dependency Graph & Test-Jar Boundaries

```
common
  └── api (produces test-jar)
        ├── ui (depends on api regular jar ONLY; cannot see api/src/test)
        │     └── mr (consumes ui + api test-jars)
        └── testcase-info (consumes api + ui regular jars;
                           test-jars added manually at runtime)
```

- **`ui` cannot see `api/src/test`** — no access to `BaseApiTest`, `BaseTest`, `BaseWsTest`, or API test providers. `ui` defines its own `BaseUITest` with identical `@SpringBootTest(TestConfiguration)` setup.
- **`mr` is the only module that consumes test-jars via Maven** — declares `api` and `ui` with `<classifier>tests</classifier>`.
- **`testcase-info` requires api + ui test-jars on classpath** — `maven-antrun-plugin` manually adds them. **Must `mvn install` api and ui first** or it fails. Running from IDE fails unless test-jars already exist on disk.
- **UI bootstrap differs from API:** UI sets `spring.aop.auto=false` and `local.run=false` by default; API sets `local.run=true`. Both use `spring.config.import=classpath:vault.properties`.

---

## Cross-Cutting Test Conventions

- **`@TestTemplate` rule:** Never put `@Tag`, `@AllureId`, `@DisplayName`, or scope annotations on `@TestTemplate` methods. Tags go in the `BaseTestTemplateInvocationProvider` implementation only. Enforced by `mr/.../MRTest.java`.
- **Parameterized tests:** Only `@TestTemplate` + provider pattern is approved. `@ValueSource` and `@MethodSource` are forbidden (Surefire re-run workaround — see `docs/paramterized_hack.md`).
- **Every test needs:** `@AllureId("digits")`, `@DisplayName`, a component tag (`@AllureComponent*`), exactly one scope tag (`@SmokeTag`/`@CriticalTag`/`@ExtendedTag`), and environment tags on methods.
- **Tag constants:** `CERTIFICATION`, `PREPROD`, `RELEASE`, `LATEST`, `FEATURE_*` (from `Environments.java`). Scopes: `@SmokeTag`, `@CriticalTag`, `@ExtendedTag`. `@KafkaTag` required for Kafka tests.
- **MRTest meta-test:** Scans all compiled tests to enforce conventions — missing annotations, duplicate AllureIds, `@Autowired` on fields, uncapitalized step names, `/` in UI display names. Fix violations or the `mr` build fails.

---

## Parallel-Safe Code

- JUnit 5 parallel execution is enabled globally in `common/src/main/resources/junit-platform.properties` (concurrent mode, fixed thread pool).
- **Default bean scope is singleton.** Instance fields in step/page classes leak state across tests. Use `ThreadLocal` for per-test state.
- **`@Scope(SCOPE_PROTOTYPE)` leak risk.** `CleanUpHandlerService` retains every prototype via `BeanPostProcessor` — causes memory leaks. Avoid unless truly necessary.

---

## Resource Cleanup

- `CleanUpHandler` + `CleanUpHandlerService` manage automatic cleanup in `@AfterEach` on both `BaseTest` and `BaseUITest`.
- **Every created resource must register for cleanup** with `CleanUpPriority`. Mock expectations must be deleted or registered.
- WebSocket connections: never manually `close()` — `CleanUpHandler` handles it.

---

## UI Gotchas

- Never use raw `SelenideElement` / `$()` in tests — always `UiElement` wrapper.
- Never `Selenide.open(url)` — use `getDriver().open(url)`.
- Never `WebDriverRunner.closeWebDriver()` — breaks screenshot/video on failure.
- Sub-components must NOT have `@Component` — breaks `ByChained` locator scoping.
- Pages are `@Component` beans; sub-components are plain classes.
- Moon (Selenoid) is the default remote browser; local requires `use.local.browser=true`.

---

## Kafka Gotchas

- **Start listener BEFORE producing messages.**
- Autowire `KafkaListenersManager` interface, never implementations.
- Use topic enums implementing `WinfinityTopic`, never raw strings.
- Avro DTOs must have `getSchemaSubject()` and `getSchemaVersion()`.

---

## WebSocket Gotchas

- Always connect via `WSSteps.connect()` — never `new StandardWebSocketClient()` directly.
- SignalR: use `sendObject()`, NOT `send()` (appends `\u001E`).
- Reuse requires `handler.clear()` between phases.

---

## Local Development

- **Vault secret required:** Set `VAULT_SECRET` env var (from `vault.mon.int.wnf.rocks` → `application/qa/vault`).
- **Profile activation:** `spring.profiles.active=common,${environment},local` (add `local-develop` for develop env).
- **Properties override:** `application-local.properties` and `application-local-develop.properties` in test resources.
- **Selenide:** defaults in `ui/src/test/resources/selenide.properties` (Moon remote, 10s timeout, Chrome).
- **Feature environments:** Use profile groups like `feature-backoffice`, `feature-demo`, `feature-promo` (defined in `bootstrap.properties`).

---

## CI

- GitLab CI pipeline is **externalized** — `.gitlab-ci.yml` only includes `wnf3/qa/ci` template. Local `.gitlab-ci.yml` is 4 lines.
- CI uses AWS CodeArtifact mirror via `ci_settings.xml` (requires `CODEARTIFACT_AUTH_TOKEN` env var).

---

## Style

- Always `@Slf4j`, never `System.out.println()`.
- Assertions: always AssertJ, always `.as()` descriptions, prefer soft assertions for multiple checks.
- Code style XML importable from `docs/xml/java_code_style_v5.xml`.
- Lombok with `@LombokGenerated` and `@ConstructorProperties` (see `lombok.config`).

---

## Game Domain

- **payIn** = Player pays money into game (DECREASES balance)
- **payOut** = Casino pays money to player (INCREASES balance)
