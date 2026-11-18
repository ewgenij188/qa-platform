---
name: implement-feature
description: >-
  Implement a CORE feature end-to-end from a Jira ticket: clarify unknowns,
  create a feature branch, write the code, run local dotnet build + dotnet test,
  then draft the MR (title, description, commit message) and obtain developer
  approval before pushing and opening the MR. Always reads the knowledge map for
  context and delegates API-contract checks and review to existing skills. Use
  when a developer asks to implement, build, add, or fix a feature in any CORE
  service, integration, contracts, Avro schemas, kafka-topics, or helm-values.
disable-model-invocation: true
---

# Implement feature (CORE)

## Use when

A developer asks to **implement a feature** (new behavior, endpoint, setting, or
bugfix) in any CORE repository. Runs from Openclaw / the Slack bot.

This is the routine, linear path — not a multi-service rollout. For a new live
game type use `add-new-game-type`; for a new slot autotest use
`add-new-slot-game`; for release work use `branch-release`.

## Required inputs

Ask the developer for these **before** doing anything else. Do not invent them:

| Input | Notes |
|-------|-------|
| Jira ticket | e.g. `CORE-4267`. Branch, commits, and MR title are built from this. |
| Ticket context | Acceptance criteria, affected service(s), any extra notes. If not pasted, fetch the ticket (see below). |
| Repo, if ambiguous | Local folder or GitLab path. If one candidate is obvious from the ticket, state it and confirm. |

If a Jira CLI (`acli`) or the Atlassian MCP is available, read the ticket to
enrich context. If neither is available, work from what the developer provided —
never block on tooling.

## Global rules

- **No code changes before the clarification and plan gates pass** (steps 0–1).
- **Git:** branch from the repo's development branch — detect `develop`, else
  `master`, else `main`. Never branch from an unrelated feature branch.
- **No commit or push without explicit approval in the current developer
  message** (global `no-git-commit-push-without-approval` rule). Approval to
  commit is **not** approval to push, and vice versa.
- **Commits carry the ticket key:** `CORE-XXXX: Short description`.
- **No squash, no draft MRs** — one normal MR on the feature branch.
- **Respect `ignore-projects`** — never operate on an excluded repo unless the
  developer explicitly names it in the current message.
- **Output is read in Slack** — short plans, short status, links as markdown.

### Repo root

Local clones differ per host. Resolve in order, use the first that exists:

1. `$REPOS_ROOT`
2. `<workspace>/repos`
3. `~/repos`

If none contain the expected repo, **stop and ask** where the clone lives.

## Workflow

### Step 0 — Clarify (gate)

Stop and ask when any of these is true:

- Acceptance criteria are missing or ambiguous.
- It is unclear **which service(s)** the feature touches.
- The change looks like an **HTTP API contract** change.
- A **DB migration** is likely required.
- A **new feature flag** is likely required.
- The target repo is listed in `ignore-projects`.
- Two or more plausible repos/approaches exist.

Ask one concise, grouped question in Slack. Do not guess and proceed.

### Step 1 — Plan (gate)

Show the developer a **short plan** and wait for a yes:

```
CORE-XXXX — {one line}
Repo: {repo}   Branch: feature/CORE-XXXX-{kebab-slug}
- {change 1}
- {change 2}
Tests: dotnet build + dotnet test
Knowledge map: read {doc}; update needed: yes/no
```

### Step 2 — Create the branch

```bash
cd {repo}
git fetch origin
git checkout {develop|master|main}
git pull origin {branch}
git checkout -b feature/CORE-XXXX-{kebab-slug}
```

Verify the working tree is clean before branching. If dirty, stop and report.

### Step 3 — Implement

- Read the knowledge map first (see [Knowledge map](#knowledge-map)) so you match
  existing patterns instead of inventing them.
- Make the **smallest change that satisfies the ticket**. Reuse existing
  helpers/types before adding new ones.
- If the change touches the HTTP API surface, run `mr-contract-check` against the
  diff before finishing.
- Update or add unit tests for the new behavior.

### Step 4 — Build & test

For **.NET** repos:

```bash
dotnet build
dotnet test
```

Discover the `.sln` at repo root; if there is none, build/test the changed
projects. Report the actual command and result — never claim success without the
output.

For **non-.NET** repos (contracts, avro-schemas, kafka-topics, helm-values):
there is no local build step — **CI confirms the build** after push. Say so
explicitly instead of running a meaningless command.

If build or tests fail, fix and re-run. Do not proceed to commit until green.

### Step 5 — Knowledge map

See [Knowledge map](#knowledge-map). Reading it is **always** part of context.

If the capability itself changed (new endpoint, flag, downstream, behavior), the
knowledge map needs an update — but in a **separate branch and separate MR in the
`platform-ai` repo**, never mixed into the service MR. Report that as a follow-up
item; the maintainer applies it.

### Step 6 — Commit

```bash
git add {files}
git commit -m "CORE-XXXX: {short description}"
```

Ticket key in every commit message. One focused commit per logical change.
**Do not commit or push yet** — the developer must approve.

### Step 7 — Approval (gate)

Present the change set and ask explicitly to push:

```
CORE-XXXX — ready locally
Repo: {repo}   Branch: feature/CORE-XXXX-{kebab-slug}
Files: {n} changed
Build: passed   Tests: passed
Commit: CORE-XXXX: {short description}

Push and open the MR? (yes/no)
```

Only a clear yes in the **current** message authorizes the push. If the developer
only approves the commit, commit but do not push.

### Step 8 — Push & open MR

After approval:

```bash
git push -u origin feature/CORE-XXXX-{kebab-slug}
```

Open the MR with the [MR template](#mr-template). `POST https://gitlab.com/api/v4/projects/{urlencoded}/merge_requests` with header `PRIVATE-TOKEN: $GITLAB_MCP_TOKEN` and JSON `source_branch`, `target_branch`, `title`, `description`. Do not use `glab` or the GitLab MCP server.

MR title: `CORE-XXXX {short description}`. Target the detected development branch
(`develop` → `master` → `main`). **Not** a draft, **no** squash.

### Step 9 — Hand off

Post the MR link and a one-line review checklist to Slack and stop. The developer
team reviews in their own chat; the agent does not poll for approvals. Offer
`review-mr` as an optional self-review from a fresh context.

## Knowledge map

The map lives in `platform-ai`:

- `knowledge-map/systems/<gitlab-path>/<service>.md` — service context
- `.../features/<feature>.md` — one file per capability
- `.../index.md` and `indexes/features-index.md` — catalogs

Read the service doc and any related feature doc before implementing. If a
capability changed, propose the update as a **separate `platform-ai` MR** (step 5)
and link the current doc from the MR description.

## MR template

ALWAYS use this structure:

```markdown
### 🧾 Info
CORE-XXXX — {one line: what changed and why}

### 🔧 Changes
- {change point}
- {change point}

### ⚙️ Feature notes
{anything specific: flags, config, migrations, contract impact, rollout notes —
omit the section if none}

### 🔗 Links
- Jira: https://{jira}/browse/CORE-XXXX
- Knowledge map: {link to the service or feature doc}

### 🧪 How tested
- `dotnet build` — passed
- `dotnet test` — passed

Closes CORE-XXXX
```

## Delegation map

Delegate instead of re-implementing:

| Phase | Skill |
|-------|-------|
| API contract check on the diff | `mr-contract-check` |
| Independent self-review (fresh context) | `review-mr` |
| Autotests for the feature | `autotests-run` |
| Context / factual answers | `answer-from-sources` |
| Commit message shape | `commit-messages` |

## Guardrails

- Never push, commit, or open an MR without explicit current-message approval.
- Never mix the knowledge-map update into the service MR.
- Never claim build/test success without the command output.
- Never skip the clarification or plan gate to save a round-trip.
- If the working tree is dirty, a repo is missing, or the base branch cannot be
  detected, stop and ask.
