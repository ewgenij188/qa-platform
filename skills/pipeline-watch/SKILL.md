---
name: pipeline-watch
description: "OpenClaw-native background watcher for GitLab tag pipelines and deploy jobs. Runs as an every-60-second agent-turn automation bound to the requesting Slack thread (session: current), reports only status changes, and removes itself when every service is terminal. Launched by branch-release / deploy-services; not invoked on its own."
disable-model-invocation: true
---

# Pipeline Watch

Shared watcher used by `branch-release` and `deploy-services`. The requesting
conversation starts an every-60-second **agent-turn** automation; this file is the run
procedure that automation follows. There is no helper script — the scheduled
agent reads this file and does the work, so every update can be committed back
into the Slack thread that asked for the deploy.

> **Hard rule — cron automation only.** Pipeline/deploy watching is **always** done
> through the cron agent-turn automation described below. **Never** substitute an
> inline polling script, a `while`/`sleep` loop, a detached `exec` background
> process, or any ad-hoc poller — even if it produces the same status output.
>
> **`cron` is part of OpenClaw and is always available to the agent.** It is a
> core tool, present in every agent's toolset — there is no "cron tool may be
> missing" state and nothing to check. Do **not** reach for the `openclaw cron ...`
> CLI, `exec`, or any other path to launch or remove the watch job; that is a
> procedure violation. Use the `cron` tool, unconditionally.

## Watch config

The launcher writes one JSON config and gives the automation its path:

```json
{
  "gitlab_url": "https://gitlab.com",
  "mode": "deploy",
  "state_file": "/home/node/.openclaw/workspace/.pipeline-watch/deploy-release-76.0.json",
  "services": [
    {"name": "partners", "project": "wnf3/bang/core/partners", "ref": "v9.78.0",
     "deploy_job": "deploy:release", "migration_job": "migration:release: [migrate]"},
    {"name": "audit", "project": "wnf3/bang/core/audit", "ref": "v2.50.0",
     "deploy_job": "deploy:release"}
  ]
}
```

- `mode`: `pipeline` watches tag pipelines; `deploy` runs the migrate → deploy gate.
- `state_file`: last-seen status per service; keep it stable so change detection
  survives. Create its directory if missing.
- `migration_job` is present only for services with DB migrations.

## Launch (agent-turn, replies in the requesting thread)

Ask the user first. If yes, create the automation **from the requesting
conversation** with the `cron` tool and `session: "current"` so every run's
result is committed back into the same Slack thread. The `cron` tool is a core
OpenClaw capability and is always available — **never** launch or manage the
job through the `openclaw cron ...` CLI, `exec`, or a `--session-key` when
`session: "current"` is what carries the thread context. Launching through the
CLI drops the thread binding (the job becomes detached/isolated) and is the
single most common way this procedure goes wrong.

| Field | Value |
|-------|-------|
| schedule | `*/60 * * * * *` |
| session | `current` |
| model | `dsflash` — alias for `custom-api-waibee-com/deepseek/deepseek-v4-flash-0731` (cheap watcher default). Fall back to `kimi`. Pass an alias, never prose. |
| tools | `exec`, `read`, `write`, `cron` — `cron` is always present and always included, so the job can remove itself at the end |
| message | `Follow the run procedure in <workspace>/skills/pipeline-watch/SKILL.md for watch config <config-path>.` |

If the user declines: `branch-release` starts no automation; `deploy-services`
still runs the gate (it is mandatory) and reports once at the end.

## Run procedure

Every run:

1. Read the watch config and the state file (a missing state file is `{}`).
2. Read every service in **one** `exec` call with the bundled parallel fetcher
   (stdlib-only — no `requests`/`httpx`/`aiohttp`, no `jq`):

   ```
   GITLAB_MCP_TOKEN="$GITLAB_MCP_TOKEN" python3 \
     <workspace>/skills/pipeline-watch/scripts/pipeline_watch_fetch.py \
     --config <config-path>
   ```

   It resolves, in parallel across services, each service's latest pipeline for
   its tag ref plus its jobs, then prints one JSON array — one entry per service:
   `{name, project, ref, pipeline_id, pipeline_url, pipeline_status, jobs, error?}`
   where `jobs` maps `{<job-name>: {id, status}}`. A per-service GitLab failure comes
   back as `{"error": ...}` and never aborts the run. This collapses 2 sequential
   `curl` calls per service (~12+ API round-trips) into ~1 wall-clock round-trip
   (measured ~2 s for 6 services, 2026-10-08). Use this script — do **not** loop
   `curl`/`jq` per service.
3. `deploy` mode — enforce the gate for each service, in this order:
   - `migration_job` is `manual`/`created` → play it
     (`curl -s -X POST -H "PRIVATE-TOKEN: $GITLAB_MCP_TOKEN" ".../jobs/<id>/play"`);
     state `migrating`.
   - `migration_job` is configured but not in the job list → state `waiting`; do
     **not** look at the deploy job yet.
   - `migration_job` is `failed`/`canceled`/`skipped` → state `failed`; never play
     the deploy job.
   - `migration_job` is `success`, or the service has no `migration_job` → if
     `deploy_job` is `manual`/`created`, play it; state `deploying`.
   - `deploy_job` is `failed`/`canceled`/`skipped` → `failed`; `success` → `deployed`.
4. Compare each service to the state file. Emit one line **only** when the state
   changed: `<name>: <from> -> <to> (<pipeline-url>)`.
5. Write the updated state file.
6. If every service is terminal: output the summary table below **and, in this
   same run**, remove the job with the `cron` tool (`remove` action). Do this
   **before** the no-change shortcut, even when nothing changed this run. If
   removal fails, report the error explicitly — never silently fall through to
   another run. Removing the job is done **with the `cron` tool**, never via
   `openclaw cron rm` or `exec`.
7. Otherwise, if nothing changed, reply exactly `NO_REPLY`.

Terminal states: pipeline mode `success`/`failed`/`canceled`/`skipped`; deploy
mode `deployed`/`failed`.

## Summary

When every service is terminal, print a table (then remove the job). Pipeline
mode:

```
Pipeline watch complete:

| Service | Pipeline | Status |
|---------|----------|--------|
| backoffice | <https://gitlab.com/.../pipelines/101\|pipeline> | ✅ success |
| partners | <https://gitlab.com/.../pipelines/202\|pipeline> | ❌ failed |
```

Deploy mode adds the migration result:

```
Deploy watch complete:

| Service | Pipeline | Migration | Status |
|---------|----------|-----------|--------|
| partners | <https://gitlab.com/.../pipelines/303\|pipeline> | ✅ success | ✅ deployed |
| audit | <https://gitlab.com/.../pipelines/404\|pipeline> | — | ✅ deployed |
```

Status emoji: `✅` for `success`/`deployed`, `❌` for `failed`/`canceled`/`skipped`.
Migration column: `✅ success`, `❌ failed`, or `—` when the service has no
migration job.

The summary lands in a Slack thread, so the Pipeline column **MUST** use Slack
mrkdwn links — `<https://gitlab.com/.../pipelines/123|pipeline>` — never Markdown
`[pipeline](url)`, which Slack renders as plain, non-clickable text.

## Guardrails

- Parse all GitLab JSON with `python3`, never `jq` (absent from the runtime image).
- Run `curl` without `-f`/`--fail` (or handle non-2xx explicitly) so a transient
  non-2xx doesn't abort the script via `set -e`; report the failure and let the
  next run retry.
- Keep the watch schedule at `*/60 * * * * *` by default. With the parallel
  fetcher the network slice is ~2 s for 6 services; the rest of a turn is model
  round-trips + inference (cheap on the flash watcher model). A faster cadence is
  fine if requested — `*/15`–`*/30` is safe with batching — but sub-`*/15` can
  still overlap in-flight turns and make the watcher appear to "skip".
- Never play `deploy:{env}` before `migration:{env}: [migrate]` reaches `success`.
- Never deploy to `preprod`, `prod`, or `certification`.
- Change-only in non-terminal runs: one line per changed service; `NO_REPLY`
  when nothing changed.
- Terminal summary takes precedence over the no-change shortcut: once every
  service is terminal, print the summary table and remove the job in the same
  run (even if nothing changed that run).
- Unattended run: never ask a question; the final reply is the deliverable.
- If a GitLab call fails, do not guess a status — report the failure plainly and
  let the next run retry.
- The job's tool allow-list MUST include `cron` — it is a core OpenClaw tool
  and always available, so there is no excuse to omit it. Without it the watcher
  cannot remove itself and will post the final summary every run forever.
