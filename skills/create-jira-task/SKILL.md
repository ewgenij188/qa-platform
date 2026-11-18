---
name: create-jira-task
description: >-
  Writes a CORE Jira description in one shared template. Use when the user
  asks for a Jira ticket, description, user story, change request, or bug.
  A task is a user story or change request. A bug uses the usual bug report:
  environment, preconditions, steps, actual result, expected result.
  Knowledge map plus source code are the source of truth. Ask before guessing
  scope.
---

# Create Jira task

The result is the ticket text in the chat.

## Source of truth

1. Read the platform-ai knowledge map first: `indexes/features-index.md`, the service `index.md`, the feature file, and `<service>.md`. The map lives in this repo (`knowledge-map/`). If the workspace is another repo, use the local `platform-ai` checkout, or GitLab `wnf3/bang/core/tools/platform-ai` on `main`.
2. Confirm the current behavior in source code. Use `develop` unless the user names another branch.
3. If the map and the code disagree, the code is what the system does now. Follow the code. Do not mention the knowledge map in the ticket. Ask the user only when the code and their request disagree.
4. Confluence counts only when the knowledge map links it. Any other page is not a source.

Skip `wnf3/bang/core/integration/wearecasino` and `wnf3/bang/core/integration/betconstruct` unless the user names that project as the target.

## Ask first

Stop and ask when any of these is missing or unclear. Do not fill the gap yourself.

- Task or bug. A user story or change request is a task. Broken current behavior is a bug.
- What must change.
- What must keep working. Example: writes reject a legacy value, while reads and delete of existing rows still succeed.
- Which services or flows are in scope. Name a service only after the map or the code shows it participates.
- For a bug: environment, preconditions, steps to reproduce, actual result, and expected result.

When the user corrects the scope, rewrite the whole ticket in the same template.

## How to write

Common phrases, with a few examples. Describe the behavior a person can recognize: create a table, register a payment, delete a table.

Do not name classes, methods, files, or validators. Do not paste implementation steps. A ticket with no technical detail is not done. A ticket that restates one rule in several sections is too long.

Name every service and HTTP endpoint whose behavior must change, and what must change on it. Name an unchanged endpoint only when the new rule would otherwise apply to it. `GET /v5/lobbyTables` stays without the new games, while `GET /v5/lobbyTablesWithLimits` must append them. Do not list a service that is simply outside the flow.

Say each fact once. Scope holds the rule. An acceptance criterion checks it. Do not add the same rule again as a negative.

State the new behavior directly. Do not introduce it by describing the current behavior it replaces.

If a contract field or a stored column must change, name it, its current limit, and the new limit. When the same value is stored in more than one column, say each column and whether that column must change. When no existing contract changes, one line is enough.

When the caller resends and the response decides whether it resends again, say which calls are resent and which response keeps them or stops them.

An acceptance criterion is one observable result. The reader must not need a second explanation of that bullet. Do not put a column that must change and a column that stays in the same bullet.

Write a new field or a new case as a change. "Add `additionalCurrencies` to the request." "Arisen must be added to the same map." Do not write "the request has" or "Arisen uses" for something that is not implemented yet.

When values move from an external payload onto an existing model, include the field map: source field, target field, and the source fields that are not copied.

When the change decides which calls to make, describe that algorithm: the input, which call, for which items, and what happens when the input is null or empty. Use the words already used in the product and the code, such as limits, bets, or chips. Do not invent a synonym.

When one rule covers many cases, state the rule and give the current examples. Do not turn the examples into a closed list. A later case that matches the rule follows it with no extra ticket text.

When create and update share one check, say both. Ask if the user might want only one of them.

When the behavior lives in a shared package, describe it once. Say to publish the package and update every service that uses that behavior. Do not repeat the rule at each call site.

## Templates

Use these headings, in this order. Leave a heading out only when it would be empty, and say why.

### Task (user story or change request)

```markdown
**Title:** …

## Context

One short paragraph: why the change is needed, and what must stay true for existing data.

## Scope

Services and endpoints that must change. Field map, call algorithm, and a contract or column change when the change has them.

## Out of scope

Work a reader could think this ticket includes.

## Acceptance criteria

* Observable results. One result per bullet.
```

### Bug

Same title, context, scope, out of scope, and acceptance criteria as a task. Between context and scope, use the usual bug report.

```markdown
**Title:** …

## Context

One short paragraph: where this shows up, and who is affected.

## Environment

Stage, version, or client. Example: core-qa, backoffice.

## Preconditions

What is already true before the steps. Example: a table of this game type exists.

## Steps to reproduce

1. …
2. …

## Actual result

What happens when the steps are followed.

## Expected result

What should happen instead.

## Scope

Services and endpoints that must change. Field map, call algorithm, and a contract or column change when the change has them.

## Out of scope

Work a reader could think this ticket includes.

## Acceptance criteria

* Observable results. One result per bullet.
```

## Example

Too vague:

> Return the new provider's games to the partner, with limits. Skip the lobby.

Use this instead:

> `GET /v5/lobbyTablesWithLimits` must append the new games. Add optional `additionalCurrencies` to `GET /v1/slots/games` and forward the tables-request currencies there. When that request has no currencies, send null. The new provider requests bets only for `additionalCurrencies`, and requests EUR only when that array is null or empty. Existing providers ignore `additionalCurrencies` and still return every limit they already return. `absoluteName` maps to `Game.Id`. The new game id must be added to the existing game-id to table-id map. `GET /v5/lobbyTables` stays without these games.

Still too specific:

> Extend `RuleFor(r => r.GameType)` on `TableSettingsRequestValidator` so obsolete members fail.

Use this instead:

> Reject an obsolete game type when creating or updating a table. Delete of an existing table with that type still succeeds.

## Output

Reply with the ticket only, in the template above. No implementation plan before it.

Implementing the ticket is [implement-feature](../implement-feature/SKILL.md), not this skill.
