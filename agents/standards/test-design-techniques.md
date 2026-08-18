# Test Design Techniques

## Purpose

Use test design techniques to maximize coverage while minimizing redundant test cases.

---

# Equivalence Partitioning

## Definition

Equivalence Partitioning is a test design technique that divides input data into groups (equivalence classes) that are expected to produce the same behavior.

The idea is that testing one representative value from a class is usually sufficient because all values in that class should be processed identically.

## When To Use

- Text fields
- Numeric fields
- Date fields
- API parameters
- Form validation
- Import/export functionality

## Example

Requirement:

User age must be between 18 and 65.

Equivalence Classes:

Valid:
- 18-65

Invalid:
- Less than 18
- Greater than 65

Representative Test Data:

Valid:
- 30

Invalid:
- 17
- 66

## Benefits

- Reduces test count
- Improves coverage
- Eliminates redundant tests

## Risks / Limitations

- May miss boundary defects
- Should be combined with Boundary Value Analysis

---

# Boundary Value Analysis

## Definition

Boundary Value Analysis is a test design technique that focuses on values at the edges of valid and invalid ranges.

Experience shows that defects are more likely to occur near boundaries than in the middle of a range.

## When To Use

- Numeric ranges
- Date ranges
- String length validation
- File size validation
- API limits

## Example

Requirement:

Order quantity must be between 1 and 100.

Boundary Values:

Invalid:
- 0

Valid:
- 1
- 2
- 99
- 100

Invalid:
- 101

## Benefits

- High defect detection rate
- Effective for validation testing

## Risks / Limitations

- Only targets range-related issues
- Does not cover business logic combinations

---

# Decision Table Testing

## Definition

Decision Table Testing is a technique used when system behavior depends on combinations of multiple conditions.

The possible combinations of conditions and resulting actions are represented in a table.

## When To Use

- Discount calculations
- Permissions
- Access control
- Business rules
- Complex workflows

## Example

Requirement:

Only authenticated administrators can access the Admin Panel.

Conditions:

| Authenticated | Admin Role | Result |
|--------------|------------|----------|
| Yes | Yes | Access Granted |
| Yes | No | Access Denied |
| No | Yes | Access Denied |
| No | No | Access Denied |

Generated Test Cases:

- Authenticated Admin
- Authenticated Non-Admin
- Unauthenticated Admin
- Unauthenticated Non-Admin

## Benefits

- Ensures full business rule coverage
- Prevents missed condition combinations

## Risks / Limitations

- Tables become large for many conditions

---

# State Transition Testing

## Definition

State Transition Testing verifies that a system correctly changes from one state to another and prevents invalid transitions.

The result of an action depends on the current state of the application or entity.

## When To Use

- Order management
- User lifecycle
- Workflow engines
- Approval processes
- Finite state systems

## Example

Requirement:

Order statuses:

NEW → PAID → SHIPPED → DELIVERED

Possible cancellation:

NEW → CANCELLED

Valid Transitions:

- NEW → PAID
- PAID → SHIPPED
- SHIPPED → DELIVERED
- NEW → CANCELLED

Invalid Transitions:

- DELIVERED → NEW
- CANCELLED → SHIPPED

## Benefits

- Excellent workflow coverage
- Identifies invalid behavior

## Risks / Limitations

- Can become complex with many states

---

# Error Guessing

## Definition

Error Guessing is an experience-based testing technique where likely failure scenarios are identified using QA knowledge and previous project defects.

The technique relies on intuition and historical defect patterns.

## When To Use

- Exploratory testing
- Regression testing
- High-risk features
- Complex integrations

## Example

Common Error Guessing Scenarios:

- Empty values
- Null values
- SQL special characters
- Unicode characters
- Duplicate requests
- Expired session
- Large payloads
- Double-click actions
- Browser refresh during save
- Network interruption

## Benefits

- Finds defects missed by formal techniques
- Effective for exploratory testing

## Risks / Limitations

- Depends on tester experience
- Difficult to standardize

---

# Pairwise Testing

## Definition

Pairwise Testing is a combinatorial testing technique that verifies every possible pair of input parameters at least once.

It significantly reduces the number of test cases while maintaining strong coverage.

## When To Use

- Forms with many fields
- Configuration testing
- Cross-browser testing
- Feature flag validation

## Example

Parameters:

Browser:
- Chrome
- Firefox

OS:
- Windows
- Linux

Language:
- EN
- DE

Instead of testing all combinations, generate a reduced set where every pair appears at least once.

## Benefits

- Reduces test execution effort
- Covers interaction defects

## Risks / Limitations

- May miss issues caused by 3+ parameter combinations

---

# Error Guessing Checklist

Before closing testing, verify:

- Empty input
- Null input
- Maximum values
- Minimum values
- Invalid formats
- Duplicate actions
- Refresh during action
- Session expiration
- Authorization changes
- Network interruptions

---

# QA Agent Expectations

Before generating test cases:

1. Identify Equivalence Classes.
2. Identify Boundary Values.
3. Build Decision Tables if business rules exist.
4. Identify States and Transitions.
5. Add Error Guessing scenarios.
6. Consider Pairwise combinations.
7. Explain which techniques were used.
8. Generate final test cases.