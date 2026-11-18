---
name: deploy-services
description: "Deploys CORE services to a target environment by playing the manual deploy/migration jobs on their tag pipelines. Runs migrations first (migration:{env}:[migrate] → wait success → deploy:{env}), then deploys. Optionally watches pipelines in a background task and notifies on status changes. Use when the user asks to deploy services to a dev/QA environment (release, develop, latest, etc.), run a release deploy, or ship a release. Restricted: never deploys to preprod, prod, or certification."
disable-model-invocation: true
---

# Deploy Services

## Purpose

Deploy a set of CORE services to a target environment by triggering the manual
`deploy:{env}` (and, where present, `migration:{env}: [migrate]`) jobs on each
service's tag pipeline, then optionally watch them to completion.

## Required inputs

Before running, confirm (ask if missing):

| Input | Default / how to resolve |
|-------|--------------------------|
| **Services to deploy** | In a release session, the services with `develop` vs `master` changes from the **core-release-diff-audit** (minus ignored). In general, may differ — always confirm the exact list. |
| **Environment** | Usually `release`; may be another **dev/QA** env. Drives the **job names** (see below). Do not assume `release`. |
| **Tag / ref** | The release tag per service (e.g. `v3.76.0`). If not given, resolve from the release branch / latest tag. |
| **Services to ignore** | e.g. already-deployed services, `promo-balance-service`, `replays`. |

**Do not assume** the service list or environment — if anything is unclear, ask.

## How deploy works (GitLab manual jobs)

Deploy is **not** a `git push`. Each service's tag pipeline contains manual
jobs that must be "played" via the GitLab API. Job names follow an env-driven
convention — **derive them from the target environment, never hardcode `release`**:

- `deploy:{env}` — the deploy job (manual). E.g. `deploy:release`, `deploy:develop`, `deploy:latest`.
- `migration:{env}: [migrate]` — migration job (manual), present **only** on services
  that have DB migrations for this release. E.g. `migration:release: [migrate]`, `migration:develop: [migrate]`.

If the exact deploy/migration job names are uncertain, **list the pipeline's jobs
first** (`per_page=100`) and match by the observed naming pattern for that env;
ask the user if the convention is ambiguous.

To trigger a manual job, `POST /projects/{project}/jobs/{job_id}/play` (or `/retry`
if the job previously failed). Use the GitLab REST API with header
`PRIVATE-TOKEN: $GITLAB_MCP_TOKEN`. Do not use the GitLab MCP server.

## Per-service workflow

For each service `S`, with `{env}` = the confirmed target environment:

1. Find the tag pipeline:
   - `GET /projects/{project}/pipelines?ref={tag}&per_page=1` → most recent pipeline.
2. List its jobs: `GET /projects/{project}/pipelines/{pipeline_id}/jobs?per_page=100`
   (use `per_page=100` — the default 20 silently truncates and can hide `test:unit`/migration jobs).
3. Build a job map by `name`; resolve `deploy:{env}` and `migration:{env}: [migrate]` from it.
4. **If `migration:{env}: [migrate]` exists:**
   - Play it first (`/play`, fall back to `/retry` if it was `failed`/`canceled`/`skipped`).
   - **Wait for it to reach `success`** before deploying.
   - If it `failed`/`canceled`/`skipped` → mark the service `failed`, do **not** deploy.
5. **Play `deploy:{env}`** (after migration success, or immediately if no migration job).
6. Track state per service: `pending → migrating → deploying → deployed | failed`.

## Deploy loop and tracking (background)

The migrate → wait-success → deploy gate always runs; the only choice is whether
the user gets live updates. Watching is **always** done through the
`pipeline-watch` cron automation — never an inline polling script or a detached
`exec` loop. Ask **first, before triggering any job** — unless the
context already explicitly says to watch (+notify) or to skip tracking, never
silently assume either branch:

> "Do you want me to watch the deploys and notify you of updates?"

Do **not** run a second inline wait loop beyond the branch below.

- **No (skip tracking)** → run the gate in the foreground with the per-service
  workflow above and report once at the end; create no automation.
- **Yes** → start the `pipeline-watch` agent-turn automation from this
  conversation. `session: "current"` makes every update and the final summary
  land back in this Slack thread. Do **not** substitute an inline poller.

Write one config for the whole deploy:

```json
{
  "gitlab_url": "https://gitlab.com",
  "mode": "deploy",
  "state_file": "<workspace>/.pipeline-watch/deploy-{env}-{RELEASE}.json",
  "services": [
    {"name": "partners", "project": "wnf3/bang/core/partners", "ref": "v9.78.0",
     "deploy_job": "deploy:release", "migration_job": "migration:release: [migrate]"},
    {"name": "audit", "project": "wnf3/bang/core/audit", "ref": "v2.50.0",
     "deploy_job": "deploy:release"}
  ]
}
```

Derive `deploy_job` / `migration_job` from the confirmed environment; omit
`migration_job` for services with no DB migrations. Launch details are in the
`pipeline-watch` skill. A failed migration is reported and the service is never
deployed.

## Output format

### 1. Deploy plan (before triggering)

| Service | Env | Tag | Has migration |
|---------|-----|-----|---------------|
| partners | release | v9.78.0 | yes |
| audit | release | v2.50.0 | no |

### 2. Final status (after completion)

| Service | Pipeline | Migration | Status |
|---------|----------|-----------|--------|
| partners | [pipeline](url) | success | deployed |

Use markdown links for pipeline URLs.

## Guardrails

- **NEVER deploy to `preprod`, `prod`, or `certification`** — this skill is restricted to dev/QA environments (e.g. `release`, `develop`, `latest`). If the user asks for one of these, **refuse and stop**.
- **Migrations first, always** — never play `deploy:{env}` before `migration:{env}: [migrate]` succeeds.
- **Derive job names from the environment** — never assume `deploy:release`; the deploy/migration job names follow `deploy:{env}` / `migration:{env}: [migrate]`.
- Do **not** deploy a service whose migration failed.
- Confirm the service list and environment before triggering any real deploy (external action).
- Use `per_page=100` when listing jobs to avoid silent truncation.
- Do not treat a missing migration job as an error — most services have none.
- If a deploy fails, report the job's failure reason / trace tail rather than blindly retrying.
