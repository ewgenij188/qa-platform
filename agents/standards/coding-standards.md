# Java Coding Standards

> This document defines general coding principles. For project-specific
> reject rules, consult `REVIEW.md` in the target repository (qa-tests-v2
> REVIEW.md has 232 lines of concrete rules per module). In case of conflict,
> `REVIEW.md` takes precedence.

## Naming

Classes:

UserPage
LoginApiClient

Methods:

loginSuccessfully()

Variables:

userName
orderId

Constants:

MAX_RETRY_COUNT

Test-specific:

- Test class: `*Tests.java`
- Test method: descriptive, preferably starts with `check...`
- `@DisplayName` says what test **verifies**, not what it does
- `@Step` text: `"<Component>: <action description>"`
- `.as()` descriptions: human-readable labels, not camelCase ("Currency rate", not "currencyRate")

---

# Clean Code

Prefer:

- Small methods
- Single responsibility
- Readable names

Avoid:

- Long methods
- Deep nesting
- Magic numbers

---

# Assertions

Use **AssertJ** fluent assertions over raw JUnit assertions:

```java
assertThat(user.getStatus()).as("User status after activation")
    .isEqualTo("ACTIVE");
```

Assertions typically live in `...Assertions` interface, not inline in tests —
unless the target package has its own convention.

Only business-meaningful assertions:

Bad:

`assertTrue(true)`

Good:

`assertThat(user.getStatus()).isEqualTo("ACTIVE")`

---

# Thread Safety & Concurrency

Default Spring bean scope is **singleton** — shared across all parallel tests.
Instance fields on `@Component` beans **leak state** between tests.

- Use `ThreadLocal` for per-test state in singleton beans
- `@Scope(SCOPE_PROTOTYPE)` causes memory leaks via `CleanUpHandlerService`.
  Use only if truly necessary and with explicit cleanup.
- No `private static` mutable fields in `@Component` — static state leaks
  across parallel tests under virtual threads.

---

# Page Objects / Steps

Responsibilities:

- Find elements
- Perform actions
- Return data (Raw `RestResponse` for API steps)

Do **not** place business assertions in page objects or step methods.
Assertions belong in test classes or `...Assertions` interfaces.

---

# Test Data

Avoid hardcoded data.

Prefer:

- Builders
- Factories
- Data providers
- SessionFactory (for session-scoped data)
- `@Value` properties for URLs, credentials, configuration

---

# Null Handling & Exceptions

- Use `Optional` for nullable returns; never return null from public methods
- Catch specific exceptions, never bare `catch (Exception e)` without justification
- Pass full exception object to logger:

```java
log.error("Failed to process request", e);  // correct
log.error("Failed to process request: " + e.getMessage());  // wrong
```

---

# Imports & Format

- No wildcard imports
- Static imports for AssertJ assertions and Awaitility conditions
- Follow project `.editorconfig`
- Non-native English writers: focus on logic correctness, not grammar