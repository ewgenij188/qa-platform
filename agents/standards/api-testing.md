# API Testing Standard

## Mandatory Verifications

Every API test should verify:

- Status code
- Response body
- Business logic
- Response schema
- Response time

---

# Positive Testing

Verify expected behavior using valid inputs.

Examples:

- Create entity
- Update entity
- Get entity
- Delete entity

---

# Negative Testing

Verify:

- Invalid inputs
- Missing fields
- Invalid authentication
- Invalid authorization

---

# Security Checks

Validate:

- Unauthorized requests
- Forbidden access
- Token expiration
- Sensitive data exposure

---

# Status Codes

200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error

---

# API Assertions

Validate:

- Field values
- Data types
- Collections
- Error messages
- Business rules

---

# Response Time

Default expectation:

< 2000 ms

Flag slower responses as risk.