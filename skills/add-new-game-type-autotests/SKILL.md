---
name: add-new-game-type-autotests
description: >-
  Adds CORE API autotests for a new live game type in qa-tests-v2 (GameType enum,
  Kafka topics, bet enums, session factory, assertion switches, dedicated table
  settings tests, provider matrix rows). Requires user-supplied Allure IDs — never
  generate them. Use when adding qa-tests for a new game type, newGameType matrix,
  CORE-3980 Bac Bo-style API coverage, or SpecificTableFieldsTests / ContextProvider
  rows. Pairs with add-new-game-type for CORE service rollout.
disable-model-invocation: true
---

# Add new game type autotests (qa-tests-v2)

## Use when

The user adds **API autotest coverage** for a new **live** CORE game type in **qa-tests-v2** (not slots — see `add-new-slot-game`).

Coordinate with **`add-new-game-type`** when CORE services (backoffice, partners, kafka-topics) are part of the same ticket.

## Context (read first)

- **`knowledge-map/testing/qa-tests-v2-core.md`** — branch/MR conventions, CORE test patterns, CI.
- **Reference game** in qa-tests-v2 — grep `GameType.{REFERENCE}` and mirror file-by-file (e.g. Sic Bo for Bac Bo).
- **Bac Bo reference MR pattern:** CORE-3980 / branch `khamitski/CORE-3980-bacbo-game-type`.

**Repo:** `wnf3/qa/qa-tests-v2` → local `qa-tests-v2`, branch **`master`**.

## Required inputs — ask before coding

**Stop and ask** if any row is missing. **Do not guess** Allure IDs, static table ids, or bet names.

| Input | Example | Notes |
|-------|---------|-------|
| **Jira ticket** | `CORE-3980` | Branch + commit prefix |
| **Game id** (kebab-case) | `bac-bo` | Kafka topic suffix, properties key |
| **`GameType` enum** | `BAC_BO` / `BacBo` | Must match Bang.Core / backoffice |
| **Reference game** | Sic Bo | Closest existing qa-tests pattern |
| **Game-specific table fields** | `oppositeBetsDisabled` | If none, skip dedicated table-settings tests |
| **Bet enum values** | Player, Banker, Tie, … | From product / reference game |
| **Lobby category** | `BANKER_GAMES` | `Category.byGameType()` mapping |
| **core-qa static table id** | `6a217a461a7cda619bb59e39` | Ask user after table exists in core-qa |
| **Allure IDs** | see below | **User must provide every new ID** |

### Allure IDs — mandatory user input

**Never invent, randomize, or auto-increment Allure IDs.** TestOps assigns IDs; the user (or QA lead) provides them.

Before editing tests or providers, collect IDs in a table and **confirm with the user**:

| Test / provider | Allure ID (user provides) |
|-----------------|---------------------------|
| `{Game}TableGameSettingsTests` — create | |
| `{Game}TableGameSettingsTests` — update | |
| `SpecificTableFieldsTests` — create (+ Kafka) | |
| `SpecificTableFieldsTests` — update (+ Kafka) | |
| Each `*ContextProvider` explicit row | one ID per provider (see [reference.md](reference.md)) |

**Do not change** existing Allure IDs on shared **`newGameType`** rows (`@Tag(NEW_GAME_TYPE)`). Those rows keep IDs like `85939`, `90619`, `66430` and run with `-DgameType={NewGame}`.

If the user gives a **range** (e.g. `95879–95914`), map each ID to a specific test/provider before implementing — gaps in the range are allowed if QA reserved them.

## Global rules

- **Git:** `git fetch` + `git pull origin master` before feature branch.
- **Branch:** `khamitski/{TICKET}-{game-kebab}-game-type` (or user’s username/ticket convention).
- **Commits:** `{TICKET}: Short message` (e.g. `CORE-3980: Add Bac Bo API tests`).
- **No commit or push** unless the user explicitly approves in the **current** message.
- **Grep-driven coverage:** after edits, grep for reference game provider rows and ensure every matching file has a row for the new game.
- **Backoffice dependency:** specific-field update/Kafka tests need backoffice `TableSettingsComparer` + `TableSettingsExtensions` cases (see `add-new-game-type` reference).

## Phase checklist

Copy and track:

```
- [ ] 0. User confirmed Allure ID mapping (no placeholders left)
- [ ] 1. GameType + infrastructure (CoreTopic, CoreStaticTables, Category, bets)
- [ ] 2. Session ({Game}TableEntity + session factory bean)
- [ ] 3. Assertion switches (6 assertion classes)
- [ ] 4. Dedicated table settings tests (if game has specific fields)
- [ ] 5. SpecificTableFieldsTests rows (+ Kafka)
- [ ] 6. Provider matrix — all *ContextProvider files
- [ ] 7. newGameType rows — explicit game row above shared row; keep shared Allure IDs
- [ ] 8. application-core-qa.properties static table id
- [ ] 9. Grep verification + list any tests that only run with -DgameType=
```

## Phase 1 — Enum and infrastructure

**Module `common`:**

- `GameType` — `@JsonProperty`, string value, int id; add to helper lists (`getGameTypesWithMultiplier()`, etc.) only when reference game does.

**Module `api`:**

- `CoreTopic` — payment, refund, balance, site table settings topics + switch cases (`*.{gameTopicSuffix}`).
- `CoreStaticTables` — field + `switch` case; bind in `application-core-qa.properties` as `core.static-table.{game-kebab}-table-id=`.
- `Category.byGameType()` — lobby category.
- `BacBoBet` / `{Game}Bet` in `core/enums/bet/game/` and `core/enums/bet/limit/` + `GameBet.byGameType()` switches.

## Phase 2 — Session layer

- `api/.../sessions/dto/{game}/{Game}TableEntity.java` — extends `TableEntity`, `super(GameType.{GAME})`.
- `SessionFactoryConfiguration` — `@Bean {game}SessionFactory()` mirroring reference game factory.

## Phase 3 — Assertion switches

Add `case {GAME} -> verify{Game}SpecificFields(...)` in **all** assertion classes the reference game uses:

- `CreateTableAssertions`
- `TableEntityAssertions`
- `TableGameSettingsAssertions`
- `TableGameSettingAssertions` (lobby)
- `BatchLobbyTableAssertions`
- `TableSettingsAssertions` (v5)

Implement `verify{Game}SpecificFields` asserting each game-specific request/response field.

## Phase 4 — Dedicated table game settings tests

Only when the game has **specific table fields** (mirror `{Reference}TableGameSettingsTests`):

**File:** `api/src/test/java/.../tablegamesettings/{Game}TableGameSettingsTests.java`

| Test | Pattern | Allure ID |
|------|---------|-----------|
| **Create** | Set specific field **on create request** → create → `getTableGameSettings` → verify | user-provided |
| **Update** | Create **without** field (default) → `getTable` → set field → `update` → verify | user-provided |

Tags: `@Tag(CORE_BACKOFFICE)`, `@Tag(TABLE_GAME_SETTINGS)`, env tags (CERTIFICATION, PREPROD, RELEASE, LATEST, CORE_QA), `@CriticalTag`.

## Phase 5 — SpecificTableFieldsTests (+ Kafka)

**File:** `api/.../tables/SpecificTableFieldsTests.java`

Add create + update methods mirroring reference game:

- Start Kafka listener: `CoreTopic.getExpectedSiteTableSettingsTopic(gameType)`.
- **Create:** set field on request, create, verify API + Kafka predicates on field.
- **Update:** create → activate on site → get table → set field → update → verify API + Kafka.

Use user-provided `@AllureId` on each method.

## Phase 6 — Provider matrix

Grep reference game in providers:

```bash
rg 'create\(GameType\.{REFERENCE}' qa-tests-v2/api/src/test/java/live/winfinity/at/core/providers
```

For **each** file found, add **above** any generic/`newGameType` row:

```java
create(GameType.{GAME}, "{user-allure-id}", context),
```

Full provider list: [reference.md](reference.md#context-provider-matrix).

Providers that **only** use `PropertiesProvider.getGameTypeOrRandom()` + `@Tag(NEW_GAME_TYPE)` need **no** explicit row — document that they require `-DgameType={NewGame}`.

## Phase 7 — newGameType shared rows

Where a provider has both explicit games and a generic row:

```java
create(GameType.{GAME}, "{new-explicit-id}", context),
create(PropertiesProvider.getGameTypeOrRandom(), "new", extendedTag(), Set.of(NEW_GAME_TYPE), "{existing-id}", context)
```

- **`getGameTypeOrRandom()`** must be used on the generic row (not hardcoded game).
- **Keep** `{existing-id}` unchanged (e.g. `85939`, `90619`).
- Add explicit `{GAME}` row **before** the generic row.

## Phase 8 — Config and verification

1. `application-core-qa.properties` — `core.static-table.{game-kebab}-table-id={id from user}`.
2. Grep `{GAME}|{GamePascal}` — no missing switch cases / `Unexpected game type`.
3. Summarize for user:
   - IDs used vs provided
   - Providers covered explicitly vs `newGameType` + `-DgameType=`
   - Backoffice deploy dependency for specific-field tests

## MCP

Use **TestOps MCP** (read-only) to look up existing cases if the user gives an ID or name — **do not** create or update test cases via MCP (global read-only rule).

## Additional resources

- Provider matrix, shared newGameType IDs, Bac Bo ID map: [reference.md](reference.md)
- CORE service rollout: `add-new-game-type` skill
