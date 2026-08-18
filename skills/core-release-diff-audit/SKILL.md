---
name: core-release-diff-audit
description: Audits CORE release readiness by comparing develop vs master across GitLab services, extracting develop-only CORE tickets, checking Jira statuses, detecting missed READY FOR RELEASE tasks, flagging Avro schema and DB migration changes, new Featbit feature flags, and reporting open GitLab MRs that block READY FOR RELEASE tickets. Use when the user asks to validate release scope, verify release, find service differences, reconcile code with Jira, or detect READY FOR RELEASE tickets missing from code changes.
---

# CORE Release Diff Audit

## Purpose

Run a strict, repeatable workflow to:
- find services with real file diffs between `develop` and `master`
- extract only `CORE-xxxx` tickets that are truly develop-only
- fetch Jira statuses for those tickets
- detect `CORE` tickets in `READY FOR RELEASE` that are missing from code changes
- **identify develop-only tickets that change Avro schemas or DB migrations** (release-impacting)
- **identify develop-only tickets that add new Featbit feature flags** (release-impacting)
- **detect open GitLab MRs linked to READY FOR RELEASE tickets** (release blockers)

## Data sources (mandatory)

- **GitLab:** all branch compares, commit history, and MR lookups MUST use the **GitLab MCP** server (`user-gitlab`: `list_group_projects`, `get_branch_diffs`, `list_commits`, `list_merge_requests`, etc.).
- **Jira:** statuses and READY FOR RELEASE queries use **Atlassian MCP** (`user-atlassian`: `jira_search`).
- **Do not** use local git clones, `git log`, `glab`, raw GitLab HTTP/API from the shell, or conclusions from a previous audit run when GitLab MCP is required for Git data.
- **Fail fast:** before step 1, run one lightweight GitLab MCP call (e.g. `verify_namespace` with `path: wnf3/bang/core` or `list_group_projects` with `group_id: wnf3/bang/core`, `per_page: 1`). If GitLab MCP is unreachable (transport/session errors, auth failures, repeated timeouts), **stop immediately** and report that the audit cannot run; do not substitute local git or stale agent-tool files. Retry GitLab MCP once only if the error looks transient; if it still fails, stop.
- Partial GitLab success is not enough for a full audit — if compares cannot be completed for the scope, say which step failed and stop rather than inventing ticket lists.

## Required Comparison Rules

- Target GitLab group: `wnf/bang/core` (resolve full namespace if needed, e.g. `wnf3/bang/core`)
- Include subgroups: `true`
- Archived projects: `false`
- Exclude paths/folders:
  - any project under `common`
  - `betconstruct`
  - `postman`
- "Service has differences" means **file diffs exist**, not only commit graph divergence.
- For Jira extraction, keep only tickets from commits reachable from `develop` and **not** reachable from `master`.
- A ticket that is **already merged to `master`** (e.g. via `release/X.Y` → `master`) must **not** appear as develop-only, even if `master -> develop` still lists it because of different merge commit SHAs or parallel merge paths.

## Workflow

0. **GitLab MCP health check (fail fast)**
   - Confirm GitLab MCP responds (see **Data sources**).
   - If unavailable: return a short failure message only (what failed, that Jira-only steps were skipped). Do not run steps 1–9 for Git-derived data.

1. **List candidate projects**
   - Get all group projects with `include_subgroups=true` and `archived=false`.
   - Apply exclude filters (`common`, `betconstruct`, `postman`).

2. **Validate branches per project**
   - Verify both `master` and `develop` refs exist.
   - If ref is missing, track project in "ref not found" (if requested).

3. **Detect real code differences**
   - Compare `master -> develop` and read `diffs`.
   - Keep project as "service with changes" only if `diffs` is non-empty.

4. **Extract strict develop-only CORE tickets per service**
   - For **every** service from step 3, run **both** GitLab compares in the same run:
     - `master -> develop` (`get_branch_diffs`, `from: master`, `to: develop`) → `m2d_commits`, `m2d_diffs`
     - `develop -> master` (`get_branch_diffs`, `from: develop`, `to: master`) → `d2m_commits`
   - Collect ticket sets from commit titles/messages:
     - `m2d_tickets` = all `CORE-\d+` in `m2d_commits`
     - `master_side_tickets` = all `CORE-\d+` in `d2m_commits` (work already on `master` in this compare)
   - Initial develop-only set per service:
     - `develop_only = m2d_tickets - master_side_tickets`
   - **Mandatory master verification** (do not skip): for each `CORE-xxxx` still in `develop_only`, confirm it is **not** already on `master`:
     - `list_commits` with `ref_name: master` and `search: CORE-xxxx` (preferred), **or**
     - scan recent `master` commit titles/messages if search is unavailable.
     - **Exact key match required:** count a commit as “on `master`” for ticket `CORE-xxxx` only when that key appears in the commit **title or message** (case-insensitive), e.g. `CORE-3905` or `feature/CORE-3905-...` in the merge title.
     - **Do not** treat `list_commits` results as proof the ticket is on `master` when the returned commits mention **other** keys only — GitLab commit search is fuzzy and often returns unrelated history (e.g. searching `CORE-3905` may return `release/76.0` or `CORE-3976` with no `CORE-3905` in title/message). If no returned commit contains the key, the ticket is **not** on `master` for that service → **keep** it in `develop_only`.
     - If **at least one** returned commit’s title or message contains the exact `CORE-xxxx` key, remove that key from `develop_only` (typical after `release/X.Y` → `master` while `develop` still has a direct merge with a different SHA).
   - When `d2m_commits` is very large (long release history on `develop -> master`), **do not** skip subtraction or drop verification — rely on per-ticket `list_commits` on `master` for each candidate in `m2d_tickets`.
   - Keep mapping `service -> develop_only tickets` (sorted, deduplicated).
   - Build global deduplicated `develop_only` set across all services for Jira checks (sections 3, 6, 9).
   - **Do not** list a ticket in section 2 if it was excluded as already on `master`, even when `m2d_diffs` is non-empty for that service.
   - Example (exclude): `CORE-3960` appears in `master -> develop` commits on backoffice and `list_commits` on `master` returns a commit whose title/message contains `CORE-3960` (e.g. via `release/76.0`) → exclude from develop-only; service may still appear in section 1 if file diffs remain.
   - Example (keep): `CORE-3905` is in `master -> develop` on `integration/public-api-v1` and `integration/wagercraft-adapter`, but `list_commits` on `master` for `CORE-3905` returns only unrelated commits (e.g. `CORE-3976`, release merges) with **no** `CORE-3905` in title/message → **keep** `CORE-3905` develop-only on those services; only `CORE-3976` is excluded there.

5. **Fetch Jira statuses and names**
   - Query Jira for collected keys and return `ticket -> summary -> status`.

6. **Find missed READY FOR RELEASE tickets**
   - Query Jira: `project = CORE AND status = "READY FOR RELEASE"`.
   - Compute set difference:
     - `missed = READY_FOR_RELEASE - develop_only_code_tickets`
   - Return missed list (sorted).

7. **Check Avro schemas and migrations (services with changes only)**
   - For every service from step 3, inspect `diffs` paths (and diff content when path alone is ambiguous).
   - Map each changed file to the `CORE-xxxx` ticket(s) from that service’s develop-only commits (use commit messages; if unclear, attribute to the ticket that introduced the flag/schema/migration).
   - **Avro schema change** — count only when the diff includes at least one of:
     - files under `*AvroContracts*`, `*.avsc`, or `avro-schemas`
     - generated/specific Avro record `.cs` under an Avro contracts project (not only `AvroProfile` / mapping code)
   - **Migration change** — count only when the diff includes at least one of:
     - EF migration classes under `Migrations/` (e.g. `*_Migration.cs`, `*ModelSnapshot.cs` tied to a new/changed migration)
     - SQL migration files (`.sql` under `migration(s)/`, Flyway, DbUp, etc.)
   - **Do not list** a ticket for Avro/migrations when the diff only adds scaffolding (empty `AvroContracts` csproj, `generate_avro_model` scripts, `Migrations` project csproj, `add_migration` scripts) with **no** schema or migration class files.
   - Fetch Jira `summary` for each ticket that has Avro and/or migration changes.

8. **Check new Featbit feature flags (services with changes only)**
   - Inspect `diffs` for Featbit-related changes on services from step 3.
   - **New Featbit flag** — a ticket qualifies when the diff **adds** at least one of:
     - a new `public const string` in `FeatureFlags.cs` (or equivalent flags class)
     - a new property in `FeatureDefaults.cs` wired to a new flag
     - a new method on `IFbManager` / `FbManager` that calls `BoolVariation` (or similar) with a **new** flag constant
     - new `FeatbitExtensions` / FeatBit SDK registration **together with** new `FeatureFlags` entries (first-time Featbit integration for a service counts if new flag names are added)
   - Extract the **flag name(s)** added (e.g. `ShouldBlockInvalidCountry`, `ShouldHideGameMetadata`).
   - Map each flag to the **develop-only** `CORE-xxxx` ticket whose commits introduced it (not a later ticket that only consumes the flag).
   - **Do not list** tickets that only reference an existing flag, change default values without new flag names, or add tests for flags introduced in another ticket.
   - **Do not list** services with no new flag constants in the diff.
   - Fetch Jira `summary` for each qualifying ticket.

9. **Check open MRs for READY FOR RELEASE tickets**
   - Use the ticket set from step 6 (`project = CORE AND status = "READY FOR RELEASE"`).
   - For each `CORE-xxxx`, find open merge requests (`state = opened`) that **belong to that ticket**:
     - `source_branch` contains the ticket key (e.g. `feature/CORE-3918-...`), **or**
     - MR title/description contains the ticket key or `Closes CORE-xxxx`.
   - Search in GitLab projects tied to the ticket (from step 4 service mapping, commit web URLs, or Jira component hints). Prefer **per-project** `list_merge_requests` (with `source_branch` or `search`) over group-wide search (avoids timeouts).
   - **Blocker** = any **open** MR for that ticket.
   - **Do not** list open MRs for unrelated tickets.
   - Fetch Jira `summary` for blocker tickets.

## Output Format

Always return these **6 sections** in this order:

1. **Services with changes (`develop` vs `master`)**
   - list of `path_with_namespace`

2. **Jira tickets from code changes (grouped by service)**
   - for each service, list:
     - `CORE-xxxx - TICKET_NAME - STATUS`
   - if a service has no develop-only CORE tickets, show `none`

3. **READY FOR RELEASE tickets missed in code**
   - list of `CORE-xxxx - TICKET_NAME`
   - if empty, explicitly state: `none`

4. **Avro and migration changes (release-impacting)**
   - List **only** develop-only tickets that have **actual** Avro schema or migration file changes (per step 7).
   - **Do not** list tickets with neither Avro nor migration changes.
   - Format each line exactly:
     - `service_short_name - CORE-xxxx - TICKET_DESCRIPTION`
   - Group under optional subheadings:
     - **Avro schema changes**
     - **Migrations**
   - If no tickets qualify, state: `none`

5. **Featbit feature flags (release-impacting)**
   - List **only** develop-only tickets that **add new Featbit flag name(s)** (per step 8).
   - Format each line exactly:
     - `service_short_name - CORE-xxxx - TICKET_DESCRIPTION — {FlagName}` (one line per ticket; comma-separate multiple new flags on the same line if one ticket added several)
   - If no tickets qualify, state: `none`

6. **Open MRs blocking READY FOR RELEASE**
   - Scope: only tickets from step 6 (Jira `READY FOR RELEASE`), per step 9.
   - If **no** READY FOR RELEASE ticket has an open linked MR, state exactly: `none`
   - If blockers exist, list one line per ticket:
     - `CORE-xxxx - TICKET_DESCRIPTION - BLOCKER: [project!iid](MR_WEB_URL) — MR_TITLE`

### Example (section 4)

**Avro schema changes**
- backoffice - CORE-3918 - [Backoffice] Add GUID messageId to tableSettingsMessage

**Migrations**
- partners - CORE-3916 - Two records are created in refunds table with the same betId and different refund_type
- replays - CORE-3860 - [Replays] Create persistent storage

### Example (section 5)

**Featbit feature flags**
- partners - CORE-3911 - [Partners] Add country validation on start master session — ShouldBlockInvalidCountry
- playerstats - CORE-3891 - [Playerstats] Hide game metadata in game results flow — ShouldHideGameMetadata

### Example (section 6)

**Open MRs blocking READY FOR RELEASE**

none

## Guardrails

- GitLab branch/commit/MR facts MUST come from GitLab MCP in the current run; fail fast if GitLab MCP is down (see **Data sources**).
- Do not treat "ref exists" as evidence of code changes.
- Do not include archived projects.
- Do not include excluded folders/projects.
- If a ticket is already in `master`, exclude it from develop-only results (step 4 subtraction **and** `list_commits` on `master` verification with **exact** `CORE-xxxx` in commit title/message — never fuzzy search hits alone).
- Jira status **On prod** / **Done** does **not** replace Git checks; always use branch compares + `master` commit search for develop-only.
- `master -> develop` showing a ticket does **not** mean it is missing from `develop` — it often means `master` has not absorbed that merge path yet, or the ticket is already on both branches under different commits.
- If API output is partial or ambiguous, re-run targeted checks for affected projects (`get_branch_diffs` both directions + `list_commits` on `master` for disputed keys).
- Never reuse ticket key lists from previous runs/chats/files.
- For every run, rebuild ticket keys only from fresh `master -> develop`, `develop -> master`, and per-ticket `master` commit searches gathered in that same run.
- For section 4, never list scaffolding-only Avro/migration setup without schema or migration class files in the diff.
- For section 5, only **new** flag constants count; do not list Featbit wiring-only changes with no new flag name.
- For section 6, only MRs explicitly linked to a READY FOR RELEASE ticket key count as blockers; never list unrelated open MRs in this section.
