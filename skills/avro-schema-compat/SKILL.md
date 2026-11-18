---
name: avro-schema-compat
description: When a CORE service's develop branch changes AvroContracts, report the latest release, preprod, and prod avro-schemas deploy jobs and whether each job's SHA already contains the matching schema commits. Does not run a schema compatibility script. Use from core-release-diff-audit for section 4, or when asked whether a CORE schema change is in the latest deploys.
---

# AvroContracts changes and last deploy

Do not compare schema JSON, compatibility levels, or field evolution.

This block is printed under **Avro schema changes** in section 4 of `core-release-diff-audit`. It is not its own section.

If no service has a real `*AvroContracts*` change, stop. Do not look up a deploy job. Section 4 can still list migrations.

If at least one service does, list those files, report the latest CORE schema deploy for **release**, **preprod**, and **prod**, and say whether each job ran on avro-schemas code that already contains the commits for those contract changes.

## Use when

- `core-release-diff-audit` found a generated Avro record or `.avsc` change (not scaffolding, not migrations only).
- The user asks whether AvroContracts changed, when the schemas were last deployed to release, preprod, and prod, and whether those deploys include the service changes.

## Inputs

- **Services:** `path_with_namespace` plus the local clone path. One entry per service that has a real Avro change. Do not pass services that only changed migrations or Featbit flags. The audit also passes the develop-only `CORE-xxxx` keys tied to those files.
- **Namespaces:** always `release`, `preprod`, and `prod`. Check all three. Do not stop after `release`. Add `latest`, `core-qa`, or `perf` only when the caller names that namespace.

## Repos

Resolve the `avro-schemas` clone in this order. Use the first path that exists:

1. `$REPOS_ROOT/avro-schemas`
2. `<workspace>/repos/avro-schemas`
3. `~/repos/avro-schemas`
4. The sibling checkout `../avro-schemas` next to `platform-ai` (GitLab `wnf3/shared-infra/avro-schemas`)

Service clones come from the caller. If a service path or the avro-schemas path is missing, stop and ask. Do not guess it.

GitLab project for deploy history: `wnf3/shared-infra/avro-schemas`. Call `https://gitlab.com/api/v4` with header `PRIVATE-TOKEN: $GITLAB_MCP_TOKEN`. Do not use the GitLab MCP server. Do not use `glab`. URL-encode the project path (`/` → `%2F`): `wnf3%2Fshared-infra%2Favro-schemas`. Follow the `x-next-page` response header until it is empty. If the token is missing or the call returns 401/403, stop and say GitLab auth failed. Do not invent a job time, and do not mark any ticket included.

`git fetch` every repo used in this run (`git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune`) before reading history. A clone that was not fetched this run is stale.

## What counts as a change

On each given service, diff `origin/master` and `origin/develop`. A change is a generated record `.cs` under `*AvroContracts*` or an `.avsc` file. Ignore a csproj-only or script-only diff.

The commits that change those files are `git log origin/master..origin/develop -- <files>`. Keep a commit only when its own diff of those paths changes a record or `.avsc`. Read `CORE-xxxx` from the commit subject and body, and keep the keys the audit passed for those files. Exact key match: `CORE-3902` is not `CORE-39020`.

## Deployed revision

The registry contents for CORE are the **later** successful write of these two jobs. Both register `wnf3/core`. Do not use the environment's single latest deployment: every matrix project shares the environment name, so the latest row may be `internal-tools`.

| Namespace | Core job | All-projects job | Pipeline |
| --- | --- | --- | --- |
| `release`, `latest`, `core-qa`, `perf` | `deploy:project:{namespace}: [core]` | `deploy:{namespace}` | **branch** (`main` or a feature branch). Tag pipelines never create these jobs. |
| `preprod`, `prod` | `deploy:project:{namespace}: [core]` | `deploy:{namespace}` | **tag**, excluding tags that start with `generated` or `semantic` |

GitLab prints the matrix job as `deploy:project:release: [core]` (space before `[`). Also accept the same name with no space.

1. `GET /projects/wnf3%2Fshared-infra%2Favro-schemas/deployments?environment={namespace}&status=success&order_by=updated_at&sort=desc&per_page=100`.
2. Page until you have seen one success of each job name, or 20 pages, or an empty page. The list is newest first, so the first match of a job name is the latest success of that job.
3. If a row has no `deployable.name`, `GET /projects/wnf3%2Fshared-infra%2Favro-schemas/deployments/{id}`.
4. Keep a deployment only when `GET /projects/wnf3%2Fshared-infra%2Favro-schemas/pipelines/{pipeline_id}` agrees with the table above (`tag` false for branch namespaces; `tag` true and `ref` not matching `^(generated|semantic)` for `preprod` and `prod`).
5. Choose the kept deployment with the later `updated_at`. If the timestamps are equal, use `deploy:project:{namespace}: [core]`.
6. Repeat steps 1–5 for **each** required namespace (`release`, then `preprod`, then `prod`). A missing job in one namespace does not stop the others. For that namespace, say the scan did not find a successful CORE deploy and mark its inclusion `unknown`. Do not substitute `HEAD`, `main`, a local branch, or another namespace's SHA.

Fallback when deployments omit job names: `GET /projects/wnf3%2Fshared-infra%2Favro-schemas/pipelines?scope=branches` or `scope=tags` (same split as the table), newest first, up to 30 pipelines **without** requiring the pipeline itself to be `success`. For each, `GET /projects/wnf3%2Fshared-infra%2Favro-schemas/pipelines/{id}/jobs?scope[]=success&per_page=100`, and apply the same job-name and tag rules. A failed pipeline can still contain a successful deploy job.

Record, per namespace, `ref`, full `sha`, job name, timestamp, and job URL (`deployable.web_url`, or `https://gitlab.com/wnf3/shared-infra/avro-schemas/-/jobs/{id}`). That SHA is the code the job ran on. `release` is a branch SHA. `preprod` and `prod` are tag SHAs. If `git cat-file -t <sha>` fails after fetch, `git fetch origin <sha>`. Do not replace it with `HEAD`, `origin/main`, or another namespace's SHA.

## Does each job SHA include the service changes?

Run this check once per namespace, against that namespace's job SHA. A schema can be included in `release` and missing from `preprod` or `prod`.

The service commits and the job SHA are different repositories. Do not test a service SHA as an ancestor of the job SHA. It will never be one.

A contract change is in that namespace's deployed code when either of these is true:

- The avro-schemas commit for **this** ticket is an ancestor of that job SHA, or
- This ticket has no schema commit of its own, and the service is starting to use a `.avsc` that already exists at that job SHA.

Using an existing schema is enough. Do not require a new avro-schemas commit, and do not compare schema JSON. A C# namespace that does not match the Avro namespace is not a deploy failure.

1. Record name = the changed file's basename without extension (`ReplayLifetimeMessage.cs` → `ReplayLifetimeMessage`).
2. From the generated `.cs`, read the Avro `"namespace"` inside `Schema.Parse`. That is the schema identity. The C# `namespace` declaration is not. `Bang.TopWins.AvroContracts.Requests` is the topwins schema even when the file sits in the replays project.
3. In avro-schemas, schemas for CORE are under `wnf3/core/` (not `wnf3/bang/core/`). Find `wnf3/core/**/<RecordName>.avsc` whose `"namespace"` equals that Avro namespace. If the file has no `Schema.Parse` namespace, use every `wnf3/core/**/<RecordName>.avsc`. Ignore `wnf3/roulette`, `wnf3/moneywheel`, `wnf3/lobby`, `wnf3/blackjack`, and `wnf3/internal-tools`.
4. For each `CORE-xxxx`, search avro-schemas history for that exact key (`git log --all --format='%H%x09%ci%x09%s' -- wnf3/core`, then keep subjects and bodies that contain the key as a whole token). Keep a commit only when it changes a matched `.avsc`. A docs-only commit does not count.
5. For each kept commit, against **this namespace's** job SHA: `git merge-base --is-ancestor <commit> <job-sha>`.
   - Every matching commit is an ancestor: **included**.
   - A matching commit exists and is not an ancestor: **not included**. This ticket changed the schema and that job ran on older code. Name that commit's short SHA, subject, and date.
6. If this ticket has no matching avro-schemas commit, check that job's tree: `git cat-file -e <job-sha>:<path>` for the matched `.avsc`.
   - The file is in the job SHA: **included**. The service is using an existing schema. Name the path and the commit that added it (`git log --diff-filter=A --format='%h %s' <job-sha> -- <path>`), including that commit's `CORE-xxxx` when it has one.
   - The file is not in the job SHA, or no `.avsc` matches: **not included**. Say the record was not found under `wnf3/core` at that SHA.
7. A namespace with no job is **unknown** for every ticket. Do not reuse another namespace's result.
8. A service commit with no `CORE-xxxx` still follows step 6 for each changed record. Say the commit had no ticket key.

## Output contract

One block for every Avro-changed service. Three deploy lines, in this order: `release`, `preprod`, `prod`. One inclusion line per ticket per namespace.

```text
AvroContracts changes
- replays - src/Bang.Replays.AvroContracts/Requests/ReplayLifetimeMessage.cs
  - release: included in latest deploy: yes — existing schema wnf3/core/topwins/requests/ReplayLifetimeMessage.avsc (CORE-4051, a1b2c3d4) is in 25bc2912
  - preprod: included in latest deploy: yes — existing schema wnf3/core/topwins/requests/ReplayLifetimeMessage.avsc (CORE-4051, a1b2c3d4) is in abcdef01
  - prod: included in latest deploy: no — ReplayLifetimeMessage.avsc is not in 1111aaaa

Latest deploys:
- release @ main 25bc2912 job deploy:release at 2026-10-05T10:18:31Z (https://gitlab.com/wnf3/shared-infra/avro-schemas/-/jobs/1)
- preprod @ v1.2.3 abcdef01 job deploy:preprod at 2026-10-01T08:00:00Z (https://gitlab.com/wnf3/shared-infra/avro-schemas/-/jobs/2)
- prod @ v1.2.0 1111aaaa job deploy:prod at 2026-09-20T08:00:00Z (https://gitlab.com/wnf3/shared-infra/avro-schemas/-/jobs/3)
```

Use the later of the two job successes in that namespace. Include ref, 8-character SHA, job name, `updated_at`, and job URL. If a namespace has no job, print `{namespace}: not found — no successful CORE deploy` and mark that namespace's inclusion lines `unknown`. Do not invent a time. Do not copy another namespace's SHA into the gap.

Inclusion line, prefixed with the namespace, one of:

- `{namespace}: included in latest deploy: yes — {schema_short_sha} is in {deploy_short_sha}`
- `{namespace}: included in latest deploy: yes — existing schema {path} ({introducer}) is in {deploy_short_sha}`
- `{namespace}: included in latest deploy: no — {schema_short_sha} {subject} is not in {deploy_short_sha}`
- `{namespace}: included in latest deploy: no — {RecordName}.avsc is not in the deploy SHA`
- `{namespace}: included in latest deploy: unknown — {error}`
