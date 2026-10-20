# Automation Framework Standard

> For project-specific module graph, base test classes, reject rules, and conventions,
> consult `AGENTS.md` and `REVIEW.md` in the target repository (qa-tests-v2). This
> document defines general principles; project docs take precedence on concrete rules.

## Purpose

The automation framework must provide:

- Fast feedback
- High maintainability
- Low flakiness
- Easy onboarding
- CI/CD compatibility
- Parallel execution support

---

# Technology Stack

## Language

- Java 25

## Build Tool

- Maven

## Test Framework

- JUnit 5
- Spring Boot 3.5

## UI Automation

Preferred order:

1. Selenide
2. Playwright Java
3. Selenium WebDriver

Desktop: MoonDriver (Chrome, Firefox, Edge, Safari)
Mobile: MoonDriver + BrowserStack (Android, iOS)

## API Automation

- RestAssured
- Jackson
- Lombok

## WebSocket

- StandardWebSocketClient (JSON)
- SignalRWsClient (SignalR protocol)
- StompClient (STOMP)
- SocketIOWebSocketClient (Socket.IO)

## Messaging

- Kafka (Avro + Schema Registry, JSON)
- AvroKafkaMessageSender / JsonKafkaMessageSender

## Async & Assertions

- AssertJ (fluent assertions)
- Awaitility (async waits)

## Configuration

- Vault (secrets)
- Spring `@Value` properties

## Reporting

- Allure Report

---

# Project Structure

Refer to project AGENTS.md for the actual module graph. Reference layout:

```
common/                  # Shared utilities, DTOs, enums
api/                     # BaseApiTest, BaseWsTest, steps, factories
  └── produces test-jar
ui/                      # BaseUITest, WebBaseTest, page objects
  └── cannot see api/src/test
mr/                      # Multi-service integration tests
  └── consumes api + ui test-jars
testcase-info/           # Test case metadata
```

Base test classes by test type:

```
HTTP-only       -> BaseApiTest
WebSocket       -> BaseWsTest       (inherits from BaseApiTest)
Desktop UI      -> WebBaseTest      -> game-specific base
Mobile (Moon)   -> MobileBaseTest
BrowserStack    -> BrowserStackBaseTest
```

---

# Design Principles

- SOLID
- DRY
- KISS
- YAGNI

---

# Test Design

Every test must follow:

Arrange
Act
Assert

Example:

1. Prepare data (SessionFactory, test data builders)
2. Perform action (Step methods, page objects)
3. Verify outcome (Assertions interface, Awaitility)

---

# Test Data & Cleanup

- Register every created resource via `CleanUpHandler` with explicit `CleanUpPriority`
- Mock expectations must have a teardown path (delete or CleanUpHandler registration)
- No shared mutable test data — use `ThreadLocal` for per-test state
- Singleton beans are shared across parallel tests — instance fields leak state
- Use `@Value` properties or SessionFactory; never hardcode IDs, credentials, or URLs
- Prefer builders, factories, and data providers over hardcoded test data

---

# Flakiness & Retry

- Do NOT add retries for flaky tests — quarantine and fix
- Use Awaitility for async waits, Selenide conditions for UI
- Explicit waits only; zero tolerance for `Thread.sleep()` in new code
- Tests must be independent — no `@Order` unless absolutely essential

---

# Naming Conventions

- Test class: `*Tests.java`
- Test method: descriptive, preferably start with `check...`
- `@DisplayName` says what test **verifies**, not what it does
- `@Step` text prefixed with component name: `"<Component>: <action description>"`
- `.as()` descriptions are human-readable labels (`"Currency rate"`), not camelCase

---

# Logging

Required:

- API requests and responses (debug level)
- WebSocket connection lifecycle
- Important business actions
- Failures with full exception object

Use `@Slf4j` (project standard). Never `System.out.println()`.
Pass exception object: `log.error("msg", e)`, never `log.error("msg", e.getMessage())`.

Do not log:

- Passwords
- Secrets
- Tokens

---

# Stability Rules

Avoid:

- Thread.sleep()
- Hardcoded waits
- Shared test data

Prefer:

- Awaitility or Selenide conditions
- Dynamic test data
- Independent tests

---

# CI Requirements

Tests must:

- Run in parallel
- Run headless
- Be independent
- Produce Allure results