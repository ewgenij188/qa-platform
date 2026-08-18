---
name: add-new-slot-game
description: >-
  Registers a new Gambit or Winspinity slot in qa-tests-v2 autotests (enum, GamesConstants,
  per-environment static table IDs). Use when adding a new slots game, mirroring MRs like
  https://gitlab.com/wnf3/qa/qa-tests-v2/-/merge_requests/4209, or when the user mentions
  QA-1255, static table IDs, SlotsGambitGameData, SlotsWinspinityGameData, or GamesConstants.
disable-model-invocation: true
---

# Add new slot game (qa-tests-v2)

## Context (read only)

At the start of the task, read the **platform-ai knowledge map** — canonical qa-tests-v2 agent guide:

- **`knowledge-map/testing/qa-tests-v2-core.md`** — branch/MR conventions (**§5**), repo layout, Java/test patterns.
- Overview link: `knowledge-map/overview.md` → QA Tests V2 — CORE API.

Slot registration only edits the enum, `GamesConstants`, and the two properties files below.

## Mandatory questions when the user omits data

**Stop and ask the user in the chat** before editing enums or properties. **Do not guess** the provider, **do not invent** static table ids, and **do not copy** a table id from one Spring profile into another.

1. **Provider:** Is the slot **Gambit** or **Winspinity**? Wrong enum file breaks tests and metadata (`"Gambit"` vs `"Winspinity"` in the enum constructor). **Always ask** if the prompt does not state it clearly.
2. **Core-qa static table id** for `application-core-qa.properties` (core-qa / staging). **Always ask** if it is not given in the prompt. Do not proceed without this value when updating that file.
3. **Release static table id** for `application-release.properties`. **Always ask** if it is not given in the prompt. **Release and core-qa use different table ids** (different Backoffice / env table records, same pattern as [MR 4209](https://gitlab.com/wnf3/qa/qa-tests-v2/-/merge_requests/4209)). **Never** reuse the core-qa id as the release id unless the user explicitly pastes the same id for both and confirms that is intentional.

If the user later supplies missing ids, add or correct the corresponding `slots.static-table.data.<game-id>=...` entries.

## Git workflow (before and after edits)

Do this **before** changing enums or properties:

1. **Update `master`:** On `master`, run `git pull origin master` (stash or commit any unrelated local work first so the pull is clean).
2. **Create a feature branch** from the updated `master` using the slot-registration naming pattern:
   - Format: `zhuk/QA-1255-add-{game-id}-slots` (replace `{game-id}` with the API game id, e.g. `hit-the-jackpot` → `zhuk/QA-1255-add-hit-the-jackpot-slots`).
   - Same ticket prefix as other slot work: `zhuk/QA-1255-*` (see [MR 4209](https://gitlab.com/wnf3/qa/qa-tests-v2/-/merge_requests/4209) / `zhuk/QA-1255-add-sugar-stacks-1000-slots`).
3. **Make code changes** on that branch only (enum, `GamesConstants`, properties).

After edits:

4. **Ask the user before commit** — summarize the diff and proposed commit message; **do not** `git commit` or `git push` until they explicitly approve.
5. After approval: stage only the four slot-registration files, commit, and push only if the user also asks to push.

## Jira / branch baseline

- Routine slot-registration work is tracked under base ticket **`QA-1255`** (template: stabilize/fix Core tests); use **`QA-1255`** in the branch name and MR title per **`qa-tests-v2-core.md` §5** unless the user specifies another key.
- Branch format: `zhuk/QA-1255-add-{game-id}-slots` unless the user gives another username or ticket.
- MR title format: `[QA-1255] Add {display title} slot` (example: `[QA-1255] Add Hit The Jackpot slot`).

## Reference MR (mechanical template)

Use [MR 4209](https://gitlab.com/wnf3/qa/qa-tests-v2/-/merge_requests/4209) as the pattern: small, focused diff touching enum, `GamesConstants`, and **both** `application-core-qa.properties` and `application-release.properties` for static tables — **always with a different id per file** (core-qa vs release) unless the user explicitly confirms otherwise.

## Provider: Gambit vs Winspinity

| Provider   | Enum file | GamesConstants method |
|-----------|-----------|------------------------|
| Gambit    | `api/src/main/java/live/winfinity/at/core/enums/slots/SlotsGambitGameData.java` | `getGambitGamesWithoutLimits()` |
| Winspinity | `api/src/main/java/live/winfinity/at/core/enums/slots/SlotsWinspinityGameData.java` | `getWinspinityGamesWithoutLimits()` |

- **Gambit:** add the new constant **immediately before** `INVALID`.
- **Winspinity:** add the new constant **immediately before** `INVALID` (same pattern as Gambit).
- Constructor args: **game id** (API string, usually kebab-case), **display title**, provider label (`"Gambit"` / `"Winspinity"`), `new ArrayList<>()` for limits unless limits are required from day one.

## GamesConstants

- File: `api/src/main/java/live/winfinity/at/core/consts/slots/games/GamesConstants.java`.
- Declare `Game {name} = Game.of(Slots{Gambit|Winspinity}GameData.{CONST});` next to the other locals in the matching `get*GamesWithoutLimits()` method.
- Append that variable to the `List.of(...)` for that provider. `getGamesWithoutLimits()` / switch cases pick up changes automatically.

## Static table IDs (per Spring profile)

- Property prefix: `slots.static-table.data.`
- Property **suffix** must match the **game id** string from the enum (e.g. game id `sugar-stacks-1000` → `slots.static-table.data.sugar-stacks-1000=<tableId>`).
- Spring bean: `SlotsStaticTablesProperties` (`slots.static-table.data` map). Keys are the game ids; values are environment-specific table IDs from Backoffice. **Core-qa and release values for the same game id are normally different** — obtain each from the correct environment.
- Files in this repo that carry the full slot static-table maps today:
  - `api/src/main/resources/application-core-qa.properties` — place Winspinity keys in the **“Static Winspinity tables”** block (before the Gambit block); Gambit keys in the **“Static Gambit tables”** block.
  - `api/src/main/resources/application-release.properties` — same grouping.
- Suites such as `PartnerSiteWithSlotsSettingsTests` assert lobby table ids are in `getAllTableIds()` for the active profile; missing or wrong ids fail tests once the game is live on that environment.

## Validation

- Prefer compiling the `api` module (`mvn -pl api -am compile` or project wrapper) after edits.

## Checklist

1. Read `knowledge-map/testing/qa-tests-v2-core.md` (§5 for branch/MR).
2. `git pull origin master` on `master`; create branch `zhuk/QA-1255-add-{game-id}-slots`.
3. Confirm provider (ask if missing); edit the correct enum only.
4. `GamesConstants` local + `List.of` in the matching `getWinspinityGamesWithoutLimits()` or `getGambitGamesWithoutLimits()`.
5. `slots.static-table.data.<game-id>=...` in `application-core-qa.properties` and `application-release.properties` (Winspinity vs Gambit section per provider). **Ask for both ids if missing**; never substitute one profile’s id for the other without explicit user confirmation.
6. **Ask the user** whether to commit (and push); do not commit without explicit approval.
