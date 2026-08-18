# Java Coding Standards

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

Only business meaningful assertions.

Bad:

assertTrue(true)

Good:

assertEquals("ACTIVE", user.getStatus())

---

# Test Data

Avoid hardcoded data.

Prefer:

- Builders
- Factories
- Data providers

---

# Page Objects

Responsibilities:

- Find elements
- Perform actions

Do not place business assertions in page objects.

Assertions belong in tests.