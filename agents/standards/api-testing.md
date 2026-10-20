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
429 Too Many Requests
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

Per endpoint NFR (check project SLA). Default expectations:

| Endpoint type | Target (p95) |
|---|---|
| Betting / transaction | < 500 ms |
| Read / info | < 1000 ms |
| Admin / backoffice | < 2000 ms |

Flag slower responses as risk; log actual p95 and p99.

---

# Idempotency

Verify:

- Duplicate request with same idempotency key → same result, no duplicate side effects
- Duplicate request without idempotency key → appropriate error (409 Conflict or 4xx)
- Idempotency survives service restart (key persists)

---

# Pagination, Filtering, Sorting

Pagination:
- Default page size matches API spec
- Boundary: page=0, page=-1, page beyond total pages
- Empty result set handled gracefully

Filtering:
- Each filter parameter: valid value returns filtered results
- Invalid filter value → appropriate error or empty result
- Multiple filters combined (AND logic)

Sorting:
- Sort by each sortable field: ascending and descending
- Sort by multiple fields
- Invalid sort field → appropriate error

---

# Rate Limiting

Verify:

- 429 Too Many Requests with Retry-After header when limit exceeded
- Rate limit resets correctly after window elapses
- Rate limit keyed per user/IP/token (per API spec)

---

# WebSocket & Messaging

Connection lifecycle:
- Connect → subscribe → receive → unsubscribe → disconnect
- Authentication and token refresh over WebSocket
- Reconnection after network interruption

Message integrity:
- Message ordering guarantees (if applicable)
- Payload matches equivalent REST endpoint response for the same entity

Kafka (if applicable):
- Event published after API state change
- Event payload consistency with API response
- Avro schema compatibility: producer → consumer round-trip
- Schema subject matches record name (RecordNameStrategy)