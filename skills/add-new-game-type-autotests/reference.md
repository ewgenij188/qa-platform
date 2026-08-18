# Add new game type autotests — reference

## Repository

| | |
|--|--|
| **GitLab** | `wnf3/qa/qa-tests-v2` |
| **Local** | `~/repos/qa-tests-v2` |
| **Branch** | `master` → `khamitski/{TICKET}-{game}-game-type` |
| **Scope** | `api/src/test/java/live/winfinity/at/core/`, `api/src/main/java/live/winfinity/at/core/`, `common/` |

## File touchpoints (mirror reference game)

| Area | Typical paths |
|------|----------------|
| GameType | `common/.../enums/GameType.java` |
| CoreTopic | `api/.../core/enums/CoreTopic.java` |
| CoreStaticTables | `api/.../core/CoreStaticTables.java` |
| Category | `api/.../core/enums/lobbycategories/Category.java` |
| Bets | `api/.../core/enums/bet/game/{Game}Bet.java`, `.../limit/{Game}Bet.java`, `GameBet.java` |
| Session | `api/.../sessions/dto/{game}/{Game}TableEntity.java`, `SessionFactoryConfiguration.java` |
| Assertions | `api/.../gateway/pojo/backoffice/**/assertions/*.java` (6 classes) |
| Dedicated tests | `api/.../test/.../tablegamesettings/{Game}TableGameSettingsTests.java` |
| Kafka table fields | `api/.../test/.../tables/SpecificTableFieldsTests.java` |
| Providers | `api/.../test/.../core/providers/**/*.java` |
| core-qa config | `api/src/main/resources/application-core-qa.properties` |

## Context provider matrix

Grep template when adding game `{GAME}`:

```bash
rg 'create\(GameType\.(SIC_BO|BAC_BO|MISSION_TO_MARS)' ~/repos/qa-tests-v2/api/src/test/java/live/winfinity/at/core/providers -l
```

### Providers — explicit row required (Bac Bo pattern)

Each needs `create(GameType.{GAME}, "{allureId}", context)` with a **user-supplied** Allure ID.

| Provider | Bac Bo AllureId (example) |
|----------|---------------------------|
| `table/CreateTableContextProvider` | 95884 |
| `table/TableGameSettingsContextProvider` | 95885 |
| `table/CrudV4TableTestsInvocationContextProvider` | 95886 |
| `table/CreateTableAndStartTableSessionTestsInvocationContextProvider` | 95887 |
| `table/CreateTableAndAssertBetSettingsContextProvider` | 95888 |
| `playerstats/GameResultContextProvider` | 95889 |
| `partners/session/GetSessionV9ContextProvider` | 95890 |
| `partners/session/GetSessionV8ContextProvider` | 95891 |
| `partners/balance/RefreshBalanceV9ContextProvider` | 95892 |
| `partners/balance/RefreshBalanceV8ContextProvider` | 95893 |
| `kafka/tablesettings/KafkaSiteTableSettingsActivateContextProvider` | 95894 |
| `kafka/tablesettings/KafkaSiteTableSettingsCreateContextProvider` | 95895 |
| `kafka/tablesettings/KafkaSiteTableSettingsDeleteContextProvider` | 95896 |
| `kafka/tablesettings/KafkaSiteTableSettingsResetTableFromNodesContextProvider` | 95897 |
| `kafka/tablesettings/KafkaSiteTableSettingsSetTableToNodeContextProvider` | 95898 |
| `kafka/tablesettings/KafkaSiteTableSettingsUpdateContextProvider` | 95899 |
| `kafka/payments/refund/KafkaRefundContextProvider` | 95901 |
| `kafka/payments/payin/KafkaPayInMasterSessionIdContextProvider` | 95902 |
| `kafka/payments/payout/KafkaPayOutMasterSessionIdContextProvider` | 95903 |
| `kafka/payments/refund/KafkaDeclinedPayinContextProvider` | 95904 |
| `kafka/payments/refund/KafkaPayinPayoutAndRefundContextProvider` | 95905 |
| `kafka/payments/refund/KafkaRefundPayoutContextProvider` | 95906 |
| `kafka/payments/refund/KafkaSendRefundTwiceContextProvider` | 95907 |
| `kafka/payments/refund/KafkaUserBalanceAfterRefundContextProvider` | 95908 |
| `kafka/payments/payin/KafkaPayInExpiredSessionContextProvider` | 95909 |
| `kafka/payments/payin/KafkaDeactivateTableAndPayInContextProvider` | 95910 |
| `kafka/balance/KafkaBalancePayInContextProvider` | 95911 |
| `kafka/balance/KafkaBalancePayOutContextProvider` | 95912 |
| `kafka/balance/KafkaBalanceRefreshContextProvider` | 95913 |
| `StrategyContextProvider` | 95914 |

### Dedicated test classes (not ContextProvider)

| Test class / method | Bac Bo AllureId (example) |
|---------------------|---------------------------|
| `{Game}TableGameSettingsTests` — create | 95879 |
| `{Game}TableGameSettingsTests` — update | 95880 |
| `SpecificTableFieldsTests` — create + Kafka | 95881 |
| `SpecificTableFieldsTests` — update + Kafka | 95883 |

Gaps in ID ranges (e.g. 95882, 95900 unused) are fine if QA reserved them.

### Providers — shared newGameType row only

No explicit game row; run with **`-DgameType={NewGame}`** (or env property). **Do not change** the existing Allure ID on the generic row.

| Provider | Shared AllureId |
|----------|-----------------|
| `CreateTableAndAssertBetSettingsContextProvider` | 85939 |
| `CreateTableContextProvider` | 90619 |
| `TableGameSettingsContextProvider` | 66430 |
| `GameResultContextProvider` | 70056 |
| `KafkaSiteTableSettingsActivateContextProvider` | 90754 |
| `KafkaPayInMasterSessionIdContextProvider` | 90799 |
| `KafkaPayOutMasterSessionIdContextProvider` | 90800 |
| `KafkaRefundContextProvider` | 90801 |
| `UpdateTableContextProvider` | 90715 |
| `GetTableContextProvider` | 90734 |
| `DeleteTableContextProvider` | 90753 |

Generic row pattern:

```java
create(PropertiesProvider.getGameTypeOrRandom(), "new", extendedTag(), Set.of(NEW_GAME_TYPE), "85939", context)
```

Tag constant: `CoreTags.NEW_GAME_TYPE` = `"newGameType"`.

## Bac Bo — CORE-3980 example

| Item | Value |
|------|-------|
| Ticket | CORE-3980 |
| Game id | `bac-bo` |
| GameType | `BAC_BO` / `BacBo` / id `22` |
| Reference | Sic Bo |
| Specific field | `oppositeBetsDisabled` |
| Category | `BANKER_GAMES` |
| core-qa table | `core.static-table.bac-bo-table-id=6a217a461a7cda619bb59e39` |
| Allure IDs | 95879–95899, 95901–95914 (30 provider + 4 dedicated tests) |

## Create vs update table settings (important)

| Scenario | Set specific field when |
|----------|-------------------------|
| **TableGameSettingsTests — create** | On `CreateTableRequest` **before** `createTable` |
| **TableGameSettingsTests — update** | **Not** on create; after `getTable`, then `updateTable` |
| **SpecificTableFieldsTests — update** | Same as update test above; includes activate-on-site + Kafka |

## Verification commands

```bash
# Find provider files still missing the new game
cd ~/repos/qa-tests-v2
rg 'create\(GameType\.SIC_BO' api/src/test/java/live/winfinity/at/core/providers -l \
  | while read f; do rg -q 'BAC_BO|{NEW_ENUM}' "$f" || echo "MISSING: $f"; done

# Full enum coverage grep
rg '{NEW_ENUM}|{GamePascal}' api common
```

## Related

- CORE rollout + backoffice table settings checklist: `add-new-game-type` skill
- Slots (different workflow): `add-new-slot-game` skill
- Agent guide: `knowledge-map/testing/qa-tests-v2-core.md`
