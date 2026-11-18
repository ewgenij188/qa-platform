---
name: autotests-run
description: Runs CORE backend autotests (qa-tests-v2) by creating a pipeline in wnf3/qa/qa-pipelines. Defaults to the release-regression preset (BRANCH_NAME_V2=master, ENVIRONMENT=release, TAGS=core, SERVICE=all, ALLURE_IDS empty). Asks for the environment if it is not clear from context. Supports overriding any variable. Use when the user asks to run autotests, run regression, run qa-tests-v2, or launch backend tests on some environment.
disable-model-invocation: true
---

# Autotests Run

## Purpose

Trigger a CORE backend autotests pipeline (qa-tests-v2) via the
`wnf3/qa/qa-pipelines` repo, which forwards variables to `wnf3/qa/qa-tests-v2`.

## Where it runs

- Project: `wnf3/qa/qa-pipelines`
- Ref: `core-regression` (the regression trigger branch)
- API: `POST /projects/{project_id}/pipeline` with `ref` + `variables` (GitLab REST API, `GITLAB_MCP_TOKEN`).

## Variables

| Variable | Default (regression on release) | Notes |
|----------|----------------------------------|-------|
| `BRANCH_NAME_V2` | `master` | qa-tests-v2 branch to run. |
| `ENVIRONMENT` | `release` | Target env: `core-qa`, `latest`, `release`, `preprod`, `certification`. **Always confirm if not clear from context.** |
| `TAGS` | `core` | JUnit tag filter. |
| `SERVICE` | `all` | `all`, `backoffice`, `currency`, `domains`, `partners`, `playerstats`, `replays`, `slots`, `topWins`, `wagercraft`. |
| `ALLURE_IDS` | `""` (empty) | Optional; empty is valid for full regression. |

**Always ask for `ENVIRONMENT` if it is not obvious** from the request (e.g. "run
regression on release" → `release`; "run autotests" with no env → ask). The user may
also request any other variable override — apply it as given.

## Trigger mechanics

The `qa-pipelines` trigger job (`qa-tests-v2:trigger:general`) has a `rules` gate on
pipeline source (`web` or `schedule`). An API-created pipeline defaults to `source=api`,
which produces an **empty pipeline** ("The resulting pipeline would have been empty").
To satisfy the gate, pass `CI_PIPELINE_SOURCE=web` as an extra variable.

Pipeline body (JSON):

```json
{
  "ref": "core-regression",
  "variables": [
    {"key": "BRANCH_NAME_V2", "value": "master"},
    {"key": "ENVIRONMENT", "value": "release"},
    {"key": "TAGS", "value": "core"},
    {"key": "SERVICE", "value": "all"},
    {"key": "ALLURE_IDS", "value": ""},
    {"key": "CI_PIPELINE_SOURCE", "value": "web"}
  ]
}
```

## Workflow

1. **Resolve inputs** — confirm `ENVIRONMENT` (ask if unclear); apply any user variable overrides.
2. **Create the pipeline** — `POST /projects/{project_id}/pipeline` with `ref=core-regression` and the variables above.
3. **Verify it is non-empty** — after a short wait, list the pipeline's jobs; confirm the
   `qa-tests-v2:trigger:general` bridge is present (not an empty/errored pipeline). Report the pipeline link.
4. **Report** the pipeline `web_url` and status. Note the downstream `qa-tests-v2` pipeline
   (branch `ENVIRONMENT`-aginst `BRANCH_NAME_V2`) does the actual test execution.

## Output

```
Pipeline: https://gitlab.com/wnf3/qa/qa-pipelines/-/pipelines/{id}
Ref: core-regression
ENVIRONMENT: release | TAGS: core | SERVICE: all | ALLURE_IDS: (empty)
Status: running
```

## Guardrails

- **Always confirm `ENVIRONMENT` when unclear** — do not silently assume `release`.
- Apply user variable overrides verbatim; do not drop or "correct" them.
- Pass `CI_PIPELINE_SOURCE=web` so the trigger job's `rules` match (avoids the empty-pipeline error).
- If the created pipeline has zero jobs, do not report success — surface the empty-pipeline error and re-check the rules/variables.