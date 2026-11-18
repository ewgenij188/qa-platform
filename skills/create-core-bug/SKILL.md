---
name: create-core-bug
description: >-
  Creates a Bug ("Баг") in the CORE Jira project via the Atlassian MCP from a
  reproduction the user describes (steps, actual, expected). Fills the required
  custom fields, writes a structured Description, and lands the issue in the CORE
  backlog (board 421). Use when the user asks to create, file, log, or raise a
  CORE bug. To only draft the ticket text without creating it, use
  create-jira-task instead.
---

# Create CORE bug

The result is a created Jira issue (key + URL) in the chat. The issue is a Bug
in project CORE and lands in the backlog of board 421 by default.

## Use when

The user describes broken behavior ("I do X, I expect Y, but I get Z") and asks
to create / file / log a bug. If they only want the ticket text drafted, use
[create-jira-task](../create-jira-task/SKILL.md).

## Inputs

Required, from the user's message:

- **Steps to reproduce** — what the user does.
- **Actual result** — what happens.
- **Expected result** — what should happen.

Ask before guessing (one question round, multiple choice):

- **Found on Environment** / **Affected Environments** — latest, develop, preprod, release, feature, prod.
- **Bug Severity** — Blocker, Critical, Major, Minor, Trivial.

Default without asking, unless the user says otherwise:

- Component: `core`.
- Found by: `QA (found Manually)`.
- Affects Platforms: `Platform-agnostic` (API/CORE-level bug).
- Reporter: the current user.

## Steps

1. Get the `cloudId` once with `getAccessibleAtlassianResources` (winfinity site:
   `7fcc6809-5d47-492d-b7ca-8fa1acdd68d2`). Reuse it for every call.
2. Ask the environment and severity questions. Keep the defaults above.
3. Write a **Summary** in English, as a statement of the problem, not a repro.
   Say what is wrong in product terms. Write endpoints in camelCase, the way the
   code names them (`enterTable`, `lastGameResults`), not the kebab URL form.
   Example: `The branding campaign does not override the configured table settings for enterTable endpoint`.
4. Write the **Description** in English, using the structure below. State facts
   once; do not name classes, methods, or files unless the user gave them.
5. Create the issue with `createJiraIssue` (not `executeWrite`). Pass
   `issueType: "Баг"` (the tool key is `issueType`, not `issueTypeName`). Put the
   custom fields under `additional_fields`.
6. Reply with the key and URL. Offer to attach real values (IDs, the actual
   response payload, a screenshot) if the user has them — it helps the dev
   reproduce. QA usually pastes a screenshot into the **Bug for game** field.

## Description format

Two fields hold the report:

- **`description`** — the main field. English, short, one text size.
- **`customfield_10674` ("Description \| Bug for game")** — the QA-facing copy.
  This is where screenshots of the actual response are pasted and where steps get
  trimmed to the essentials. Keep it in sync with `description`, but the steps
  here may be shorter (e.g. "Take finish RNG event" + "Call /lastGameResults").

Keep each field one text size. Do **not** use headings — `h3.`/`h2.` in wiki
markup and `#` at line start both render as large headings in Jira's editor
(`#` becomes an `<h1>`, not a numbered step). Use bold labels for sections and
plain lines or `1. 2. 3.` for steps:

```
*Description*
<one short paragraph: expected vs actual>

*Steps to reproduce*
1. step one
2. step two

*Actual result*
<what happens>

*Expected result*
<what should happen>
```

Write both fields in English. If the user explicitly wants a second language,
put the translation in the other field rather than mixing languages in one.

## Field map (CORE project, issue type "Баг" id 10067)

Field IDs are site-specific; these are verified for the winfinity CORE project.
Re-check with `getJiraIssueTypeMetaWithFields` (projectIdOrKey `CORE`,
issueTypeId `10067`, `requiredFieldsOnly: false`) if a create fails.

| Field | Field ID | Required | Shape | Values (id → value) |
| --- | --- | --- | --- | --- |
| Component | `components` | no | `[{ id }]` | core = `10345` |
| Labels | `labels` | no | `["..."]` | free text |
| Found on Environment | `customfield_10669` | yes | `{ id }` | feature `11274`, develop `11275`, latest `11276`, release `11277`, preprod `11278`, prod `11279` |
| Found by | `customfield_10670` | yes | `{ id }` | DEV `11280`, QA Manually `11281`, QA Auto Tests `11282`, T2 `11283`, UAT `11284`, Monitoring `18028`, Another Team `11396` |
| Affected Environments | `customfield_10676` | yes | `[{ id }]` | All `11395`, feature `11389`, develop `11390`, latest `11391`, release `11392`, preprod `11393`, prod `11394` |
| Bug Severity | `customfield_10748` | yes | `{ id }` | Blocker `11516`, Critical `11517`, Major `11518`, Minor `11519`, Trivial `11520` |
| Affects Platforms | `customfield_10763` | yes | `[{ id }]` | Linux `11547`, Windows `11548`, Macos `11549`, iOS `11550`, Android `11551`, Platform-agnostic `11621` |
| Description \| Bug for game | `customfield_10674` | no | string | QA-facing copy: trimmed steps + screenshots |
| Product | `customfield_11275` | no | `{ id }` | Blackjack `14734`, Money Wheel `14735`, RNG Blackjack `14736`, Money Race `21390`, Neo Blackjack `21599` |

## Create call shape

```js
const cloudId = "7fcc6809-5d47-492d-b7ca-8fa1acdd68d2";
await tools.atlassian.createJiraIssue({
  cloudId,
  projectKey: "CORE",
  issueType: "Баг",
  summary: "<English problem statement, camelCase endpoint>",
  description: "<English, no headings, see Description format>",
  additional_fields: {
    components: [{ id: "10345" }],          // core
    labels: ["<label>"],
    customfield_10669: { id: "11276" },     // Found on Environment: latest
    customfield_10670: { id: "11281" },     // Found by: QA (found Manually)
    customfield_10676: [{ id: "11391" }],   // Affected Environments: latest
    customfield_10748: { id: "11518" },     // Bug Severity: Major
    customfield_10763: [{ id: "11621" }],   // Affects Platforms: Platform-agnostic
    customfield_10674: "<QA copy: trimmed steps>", // paste screenshot via UI
  },
});
```

To edit an existing bug (translate, reformat, fill a field), use `editJiraIssue`
with `issueIdOrKey` and a `fields` object using the same IDs.

## Output contract

Reply with the created key and `https://winfinity.atlassian.net/browse/<KEY>`,
a short list of the fields set, and a note that the bug is in the CORE backlog
(board 421). No implementation plan.
