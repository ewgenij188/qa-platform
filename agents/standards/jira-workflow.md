# Jira Workflow Standard

## Story Analysis

For every story:

1. Read requirements
2. Identify gaps
3. Identify risks
4. Identify dependencies
5. Identify test scenarios

---

# QA Checklist

Before testing:

- Requirements reviewed
- Acceptance criteria reviewed
- Test data prepared

During testing:

- Positive testing
- Negative testing
- Edge cases
- Exploratory testing
- Localization checks (all supported locales)
- Cross-browser verification (see UI Testing Standard)

After testing:

- Evidence collected (screenshots, Allure reports, logs)
- Defects reported with proper Component/Labels
- Regression impact assessed
- Automation candidates flagged

---

# Definition of Ready

Story contains:

- Description
- Acceptance criteria
- Scope
- Dependencies
- Avro/migration impact assessed
- Feature flag strategy documented (if applicable)

---

# Definition of Done

### Generic
- Acceptance criteria passed
- Critical defects resolved
- Regression completed
- Test evidence attached in Jira

### CORE-specific gates
- Automation added if required (mapped in qa-tests-v2, linked via Allure ID)
- Avro schema changes merged to avro-schemas repository (if applicable)
- DB migration tested on target environment (if applicable)
- Featbit feature flags configured and verified (if applicable)
- No "READY FOR RELEASE" blockers remain

---

# Jira Mechanics

### Linking test evidence
- Attach Allure report links, screenshots, or log excerpts directly to the story/bug
- Link test cases via "relates to" or "tests" issue link type

### Bug creation
- Component = affected CORE service (Bang.Core, BackOffice, Partners...)
- Labels = `core`, `qa`, `bug`
- Set Fix Version/s to target release
- Link to parent story/epic

### Status transitions
- Bug workflow: Open → In Progress → Resolved → Closed
- Story verification: attach test evidence before moving to Done
- Release ticket: verify all linked stories are Done before "READY FOR RELEASE"