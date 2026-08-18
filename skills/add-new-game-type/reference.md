# Add new game type — reference

## GitLab projects

| Phase | GitLab path | Local repo (under `~/repos/`) | Default branch |
|-------|-------------|----------------------------------|----------------|
| 1 | `wnf3/bang/core/core` | `core` | `develop` |
| 2 | `wnf3/bang/core/common/messages` | `common/messages` (or `messages`) | `develop` |
| 3 | `wnf3/bang/core/backoffice` | `backoffice` | `develop` |
| 4 | `wnf3/bang/core/partners` | `partners` | `develop` |
| 5 | `wnf3/bang/core/playerstats` | `playerstats` | `develop` |
| 6 | `wnf3/shared-infra/kafka-topics` | `kafka-topics` | `main` |
| 7 | `wnf3/bang/core/contracts` | `contracts` | `master` |
| 8 | see consumer table below | various | `develop` |

Adjust local folder names if the user’s clone layout differs.

## NuGet packages (phase order)

| Package | Produced in | Consumed from phase |
|---------|-------------|---------------------|
| `Bang.Core` | **core** (phase 1) | 2+ |
| `Bang.Common.Messages` | **common/messages** (phase 2) | 3+ |
| `Bang.BackOffice.ApiResources` | **backoffice** ApiResources project (phase 3) | 4, 8 |
| `Bang.Partners.ApiResources` | **partners** ApiResources project (phase 4) | 5, 8 |

## Snapshot lifecycle

When **ApiResources** (or Partners ApiResources) **source files** change during the feature:

1. Bump `<Version>` in the `.csproj` that **generates** the package (not only consumers).
2. Use a **snapshot** until the feature MR merges: `{next-semver}-snapshot-core-{TICKET}-{n}`.
3. Increment `{n}` whenever ApiResources **code** changes again before merge.
4. **Before merge:** remove `-snapshot-core-{TICKET}-{n}` → publish and merge at plain `{next-semver}`.
5. Update all consumers from snapshot refs to that **same stable** version before their MRs merge.

### CORE-3980 (Bac Bo) — reference versions

| Package | `develop` before feature | Snapshot during feature | **Released (merge)** |
|---------|------------------------|-------------------------|----------------------|
| `Bang.Core` | `6.5.4` (playerstats) / earlier | `6.5.9` → `6.5.10` | **`6.5.10`** |
| `Bang.Common.Messages` | varies | — | **`3.0.2`** |
| `Bang.BackOffice.ApiResources` | `7.12.3` | `7.12.4-snapshot-core-3980-1` | **`7.12.4`** |
| `Bang.Partners.ApiResources` | `18.16.8` | `18.16.9-snapshot-core-3980-1` | **`18.16.9`** |

Consumer snapshot refs during integration often lagged producing packages (e.g. `7.12.2-snapshot-core-3980-1` while backoffice was already `7.12.4-snapshot-…`). **Pre-merge sweep** must align every consumer to the **final stable** versions above.

### Who sets what

| Repo | Sets `<Version>` on | Sets `PackageReference` on |
|------|---------------------|----------------------------|
| backoffice | `Bang.BackOffice.ApiResources` | `Bang.Core` (in ApiResources csproj) |
| partners | `Bang.Partners.ApiResources` | `Bang.BackOffice.ApiResources`, `Bang.Core` (in ApiResources) |
| playerstats | — | `Bang.BackOffice.ApiResources`, `Bang.Partners.ApiResources`, `Bang.Core` |
| consumers | — | whichever of the four packages the service already references |

### Pre-merge grep

```bash
rg 'snapshot-core-{TICKET}' ~/repos --glob '*.csproj'
```

Must return **no matches** before the final consumer merge wave.

## MR merge order (summary)

Same as [SKILL.md merge order](../add-new-game-type/SKILL.md#mr-merge-order): **core → messages → backoffice (release) → partners (release) → playerstats → kafka-topics / contracts → consumers (stable only)**.

Playerstats and consumers: **rebase `develop`** first; resolve `.csproj` conflicts toward **stable** package versions.

## Playerstats (phase 5)

Often **NuGet-only** for live games (no `appsettings` changes). Minimum package refs after partners merge:

- `Bang.Partners.ApiResources` — stable from phase 4
- `Bang.BackOffice.ApiResources` — stable from phase 3
- `Bang.Core` — stable from phase 1

Optional `appsettings.json` only if the game needs custom limits, notifications exclusion, or participant APIs — see ticket / reference game.

## Phase 8 — consumer services (fixed list)

Do **not** scan all of `~/repos/` unless the user explicitly asks. Bump **only** the packages each service already references (see table — do not add new package references).

| Local repo | GitLab path | Packages to bump | Typical branch |
|------------|-------------|------------------|----------------|
| `integraion/parimatch` | `wnf3/bang/core/integration/parimatch` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `integration/hub88` | `wnf3/bang/core/integration/hub88` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `integration/softswiss` | `wnf3/bang/core/integration/softswiss` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `promo-balance-service` | `wnf3/bang/core/promo-balance-service` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `public-api-v1` | `wnf3/bang/core/integration/public-api-v1` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `slots-adapter` | `wnf3/bang/core/integration/slots-adapter` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `wagercraft-adapter` | `wnf3/bang/core/integration/wagercraft-adapter` | Core, BackOffice.ApiResources, Messages, Partners.ApiResources | `feature/CORE-{ticket}-bump-nugets` |
| `preferences` | `wnf3/bang/core/preferences` | **Partners.ApiResources only** (no `Bang.Common.Messages`, no `Bang.Core`, no `Bang.BackOffice.ApiResources`) | `feature/CORE-{ticket}-bump-nugets` |

**Out of default scope** (only if the user names them):

- `integration/fusemedia`
- `integration/betconstruct`, `integration/wearecasino` (ignored projects rule)
- `tables` (archived)

`partners` and `playerstats` are updated in phases 4–5 (feature branches with game code), not only in the generic bump branch.

## Kafka topics (phase 6)

- Repo: `wnf3/shared-infra/kafka-topics`, target **`main`**.
- Add **core** topics only — **do not** add lobby topics unless the user explicitly requests lobby.

## Backoffice implementation hints (phase 3)

Mirror the closest existing game (e.g. Sic Bo for dice-style games):

- `GameType` already in **Bang.Core** (phase 1).
- Table settings model, ApiResources DTOs, MessagePack `[Union]` indices, dedicated `*Fields` in `TableSettingsRequest` (do not reuse another game’s fields).
- MessagePack `[Key(n)]` on derived DTOs must not collide with base `TableSettingsResponse` / `TableGameSettingsResponse` keys.
- `UpdateTableSettings` switch: `{` aligned under `case` (same style as Roulette).
- `DefaultLimitSettingsProvider`, AutoMapper profiles, Mongo maps, `appsettings.json` game entry.

## Contracts & core repo

- **contracts** MR often targets **`master`** (confirm with user if unsure).
- **core** MR targets **`develop`**.
