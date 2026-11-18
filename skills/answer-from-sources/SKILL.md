---
name: answer-from-sources
description: >-
  Answers CORE questions from the platform-ai knowledge map first, then the
  codebase, and from the shared repos in knowledge-map/common.md for contracts,
  Avro schemas, helm config, and Kafka topics. CORE is GitLab group
  wnf3/bang/core only. A local clone of another project is not CORE. Use when
  the user asks how a CORE feature works, whether something is true, or for a
  factual answer about a CORE service, endpoint, contract, config, schema, or
  topic. Also use it when the user asks what is wrong with a specific bet,
  session, round, or other CORE id. That path needs ids, a stage from
  knowledge-map/common.md, a timeframe, and OpenSearch logs before the
  knowledge map. If the question is about a project outside that group, say it
  is out of scope and use confidence 1-2. Confluence pages linked from the
  knowledge map are current. Other Confluence pages are not a source of truth.
  Always return the same short answer shape with confidence 1-10 and sources.
---

# Answer from sources

Factual answers about CORE. This skill answers. It does not edit the knowledge map unless the user asks.

The knowledge map is in platform-ai: `indexes/features-index.md`, `knowledge-map/`. If this workspace is not that repo, use the local `platform-ai` checkout, or GitLab `wnf3/bang/core/tools/platform-ai` on its default branch. Read code on `develop` unless the user names another branch. Skip the excluded projects in [Scope](#scope).

## Scope

Answer only CORE domain logic. A service is in scope when its GitLab project is under [wnf3/bang/core](https://gitlab.com/wnf3/bang/core). A checkout on this machine does not make a repo CORE. Lobby, baccarat, and other game or studio projects are out of scope.

Two projects under that group are **excluded and out of scope** unless the user names one as the target of the current message:

| GitLab path | Path hints |
|-------------|-----------|
| `wnf3/bang/core/integration/wearecasino` | `wearecasino`, `WeAreCasino` |
| `wnf3/bang/core/integration/betconstruct` | `betconstruct`, `Betconstruct`, `BetConstruct` |

Do not open, search, or describe these projects. This is the same list as the shared `ignore-projects` rule (`cursor/rules/ignore-projects.mdc` in platform-ai), copied here so the skill works where that rule is not synced (opencode, this agent). If the two lists ever differ, treat this copy as authoritative for answer questions.

Also in scope, only for the question types in `knowledge-map/common.md`: contracts, helm-values, avro-schemas, kafka-topics, and CORE stages.

If the question is about a non-CORE project, do not open that repo. Say you cannot answer that part. You may still describe the CORE API the question names. Confidence for that question is 1–2.

If the question is about one of the excluded projects above, treat it the same as any non-CORE project: do not open it. Unless the user names it as the target of the current message.

## Where to look

1. **Knowledge map first.** Search `indexes/features-index.md` (id and keywords), then that service's `index.md`, the feature file, and `<service>.md`.
2. **Confluence only when the knowledge map links it.** Those pages are current. Believe them. Read the linked page for the flow. Do not copy it into the answer.
3. **Any other Confluence page is unsafe.** It may be legacy. Do not answer from it. If the user pasted one, say it is not a knowledge-map reference and keep looking.
4. **Code next.** Open the handler or type named in the map, in the local repo or from GitLab. File: `GET https://gitlab.com/api/v4/projects/{urlencoded}/repository/files/{urlencoded_path}/raw?ref=develop`. Tree: `GET .../repository/tree?path={path}&ref=develop&per_page=100`. Header `PRIVATE-TOKEN: $GITLAB_MCP_TOKEN`. Do not use the GitLab MCP server. Use code to confirm the map, or to answer when the map has no page for that service.
5. **Shared repos in `knowledge-map/common.md`** for these questions. They are reliable. Prefer them over a guess from service code:
   - Contracts → [wnf3/bang/core/contracts](https://gitlab.com/wnf3/bang/core/contracts) (`api-docs/<service>/`)
   - Avro schemas → [wnf3/shared-infra/avro-schemas](https://gitlab.com/wnf3/shared-infra/avro-schemas)
   - Config → [wnf3/shared-infra/helm-values](https://gitlab.com/wnf3/shared-infra/helm-values)
   - Topic existence → [kafka-topics](https://gitlab.com/wnf3/shared-infra/kafka-topics) `preprod/` and `prod/` on `main` only
   - Stage, namespace, cluster, or where autotests run → `knowledge-map/common.md` Environments

Follow the path through the last CORE hop. A topic name is not delivery to another system. Open the consumer only when that service is under `wnf3/bang/core`. If the next hop is outside CORE, stop. Do not scan unrelated code.

Always confirm the answer in code before you reply. Reading the map and any linked Confluence page is not enough — even when they clearly answer the question. Open the handler or type named in the map and check it against the code. If you cannot open it, answer only what the map says and set the confidence accordingly.

For a specific case ("what is wrong with this bet / session / round"), use [Case investigation](#case-investigation) first. Do not start from the knowledge map.

## Case investigation

A question about one bet, session, round, or other id. This is not a question about normal behavior.

Ask before searching when any of these is missing:

- **Ids.** At least one id is required (bet, session, master session, game, user). Ask for another id when the one you have cannot identify the log line.
- **Stage.** Use [Environments](../../knowledge-map/common.md). Ask when the question does not name one. `prod` uses `win-prod-core-*`. Every other stage uses `win-dev-core-*` and that stage's namespace. `feature` has no fixed namespace here; ask which one.
- **Timeframe.** Use the window the user names. If they do not name one, ask. A recent problem is usually the last 6–12 hours. If that search finds no related logs, ask for the window. Do not widen it on your own.

Then search OpenSearch.

OpenSearch and Grafana may be a direct MCP or wnf-developer. Use whichever is configured. If both are configured, either is valid. Direct OpenSearch (`user-opensearch` or `opensearch`) uses `search_documents`. On wnf-developer (`user-wnf-developer`) the same call is `opensearch_search_documents`, and Grafana tools are prefixed `grafana_`. Direct Grafana is `user-grafana` or `grafana`.

1. ERROR logs that contain the given ids.
2. All log levels that contain those ids.

When a log line explains the case, continue with [Where to look](#where-to-look): knowledge map, its linked Confluence page, then code. The reason has to match both the log and that material.

When no log line answers the case, answer from the knowledge map only as a possible cause. Confidence is 1–2. Say which index, namespace, and window you searched.

Add this source line:

- logs: `<index>, namespace, window, ids` — or `none`

## Confidence

Integer from 1 to 10. Never invent a fact to raise it. A matching snippet in one service is not enough for a high score when the question continues past that service.

| Score | When |
|-------|------|
| 9–10 | Knowledge map (and its linked Confluence page, when the question is about that flow) matches the code you opened for every service on that path |
| 7–8 | The knowledge map (and its linked Confluence page) answers the question, but confirming it in code was hard. You checked the code as required, found the answer in the doc, and could only partially verify it in code. Say what was hard to confirm |
| 5–6 | No knowledge-map page. You opened the code that fully answers the question |
| 3–4 | You only saw part of the path. Say which hop you did not open |
| 1–2 | Not found, sources disagree, the question is outside CORE, or a case has no log line that explains it |

9–10 requires a knowledge-map page (and its linked Confluence page, when the question is about that flow) that matches the code. If there is no knowledge-map page for the service, the ceiling is 6 — never 9–10, no matter how fully the code answers the question.

A producer, a topic, or one service is a partial path. Publishing `core.*.message` is not "sent to" the external system. Open the consumer and the outbound call. Until that code is open, the score stays 3–4, and the answer says the next hop was not checked.

If the map and the code disagree, do not pick one. Show both, use 1–2, and ask which to follow.

If nothing answers it, say what you checked and ask for a service, endpoint, or branch. Do not fill the gap.

## Answer shape

Use this shape every time. Keep **Answer** short. A longer **Answer** is only for "how does this work" when the mechanism needs it. Still do not paste the Confluence page or a code tour. Code confirmation stays out of the **Answer** — put the handler or type name on the `codebase:` line in **Sources**, and mention exact code lines or fields only when the user asks. End by offering details.

```markdown
## Answer
<one short paragraph, or the mechanism when they asked how it works>

## Confidence
<N>/10 — <one line: what you matched, or what is missing>

## Sources
- knowledge-map: <path, or none>
- confluence: <url linked from the knowledge map, or none>
- codebase: <gitlab project or local repo, and the type, or none>
- shared: <contracts, avro-schemas, helm-values, or kafka-topics — omit this line when unused>

Ask if you want <one concrete detail>.
```

## Example

Question: Does Partners store the player balance?

```markdown
## Answer
The partner is the source of truth. Partners keeps the current amount in cache, one record per user and currency.

## Confidence
9/10 — knowledge-map balance flow matches `BalanceService`.

## Sources
- knowledge-map: `knowledge-map/systems/wnf3/bang/core/partners/features/balance-management.md`
- confluence: https://winfinity.atlassian.net/wiki/spaces/PD/pages/3299639329/Balance+Management+Flow
- codebase: `wnf3/bang/core/partners` (`BalanceService`)

Ask if you want cache lifetime, refresh, or the synchronous slot-open call.
```
