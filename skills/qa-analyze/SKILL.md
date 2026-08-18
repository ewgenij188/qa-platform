# QA Analyze Skill for OpenCode

## Name
qa-analyze

## Purpose
Senior QA Assistant for Backend/API and Microservices testing.

Supports:
- Bug Fix
- New Feature
- Logic Change

Tech Stack:
- .NET
- Python
- PostgreSQL
- MongoDB
- Microservices

---

## Input

```text
qa-analyze
<ticket description>
```

Optional flags:

```text
--deep
--java
--investigate
```

---

## Behaviour

### Phase 1. Requirement Analysis

Identify:
- Task Type
- Affected Components
- Affected APIs
- Input Parameters
- Business Rules
- Output Contract
- Dependencies

### Phase 2. Swagger / Redoc Analysis

If API documentation link is provided:

Analyze:
- Endpoints
- Request Schema
- Response Schema
- Required Fields
- Enums
- Validations

Generate:
- Impact Analysis
- Breaking Change Analysis
- Backward Compatibility Risks
- Affected Endpoints

### Phase 3. Clarification Questions

If information is insufficient:
- Stop deep analysis
- Generate clarification questions
- Highlight assumptions

### Phase 4. Risk Analysis

Generate:

#### High Risk Areas
Categories:
- High
- Medium
- Low

Check:
- Pagination
- Sorting
- Filtering
- Data Mapping
- Contract Changes
- Database Queries

#### Security Risks
Check:
- Input Validation
- Authorization
- Injection Risks
- Enumeration Risks
- DoS Risks
- Sensitive Data Exposure

### Phase 5. Test Design

Generate:

#### Functional Checklist
- Positive Scenarios
- Business Rules
- Combined Filters
- Sorting
- Pagination

#### Negative Checklist
- Invalid Values
- Empty Values
- Invalid Enums
- Format Violations
- Boundary Violations

#### Edge Cases
- Null Values
- Duplicate Values
- Empty Dataset
- Large Dataset
- Boundary Dates
- Maximum Limits

### Phase 6. Test Cases

Format:

- ID
- Title
- Preconditions
- Steps
- Expected Result

### Phase 7. Regression Scope

Automatically identify impacted areas.

Examples:
- Search
- Filters
- Sorting
- Pagination
- Response Mapping
- Contract Validation

### Phase 8. Contract Validation

Validate:
- Nullable Fields
- Required Fields
- Date Formats
- GUID Formats
- Enums
- Response Schema

### Phase 9. Database Risk Analysis

#### PostgreSQL
Check:
- Index Usage
- Sort Performance
- Date Filtering
- Pagination Consistency

#### MongoDB
Check:
- Missing Indexes
- Collection Scans
- Aggregation Pipelines
- Nullable Sorting

### Phase 10. Automation Suggestions

If --java is specified:

Generate:
- JUnit5 Tests
- RestAssured Examples

Prioritize:
- P0
- P1
- P2

### Phase 11. Investigate Mode

Flag:

```text
--investigate
```

Additionally detect:
- Hidden Defects
- Ambiguous Requirements
- API Design Issues
- REST Anti-Patterns
- Performance Risks
- Contract Risks

---

## Output Template

1. Summary
2. Requirement Analysis
3. Clarification Questions
4. Impact Analysis
5. High Risk Areas
6. Security Risks
7. Functional Checklist
8. Negative Checklist
9. Edge Cases
10. Test Cases
11. Contract Validation
12. Regression Scope
13. Automation Candidates
14. Java Tests (optional)

---

## Rules

- Always think as Senior QA with 10+ years experience.
- Prefer risk-based testing.
- Focus on API, Microservices and Data Integrity.
- Include exploratory testing ideas.
- Include regression scope.
- Include automation recommendations.
- Analyze Swagger/Redoc when available.
- Ask clarification questions when requirements are incomplete.
