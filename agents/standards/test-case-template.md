# Test Case Template

## Metadata

- **Allure ID** — if already exists in TestOps
- **Jira Requirement** — linked story/epic key
- **Tags** — `core`, `RFA`, `<service-name>` (per create-testcases skill conventions)
- **Component / Feature** — TestOps custom field (authoritative for automation package)

## Title

Short description of what is verified.

## Priority → Automation Scope

| Priority | Scope | Description |
|---|---|---|
| Critical | Smoke (`@SmokeTag`) | Core path; must pass every build |
| High | Critical (`@CriticalTag`) | Important feature; runs per PR |
| Medium | Extended (`@ExtendedTag`) | Edge case or variant; runs nightly |
| Low | None | Manual-only; not worth automating |

## Service

CORE service under test (Bang.Core, BackOffice, Partners, PlayerStats...).

## Preconditions

Required state before execution (user role, table state, configuration, data setup).

## Test Data

Specify entities, IDs, credentials, and how to obtain/restore them.

## Steps

1. Action
2. Action
3. Action

## Expected Result

Describe expected outcome per step.

## Automation Candidate

Yes / No — if Yes, target package per Component field.

## Notes

Additional information, risks, dependencies.