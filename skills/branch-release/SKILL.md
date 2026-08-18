---
name: branch-release
description: Creates release branches from develop for CORE services in the local repos/ directory, pulls latest develop, tags with bumped minor version, pushes when approved, and collects GitLab pipeline links for each tag. Use when the user asks to cut a release branch, create release/X.Y, tag a release, push release, or prepare services for release.
---

# Branch Release

## Purpose

For each selected local Git repository under `repos/`:
1. Fetch and update `develop` from `origin`
2. Create `release/{RELEASE}` from `develop`
3. Tag the branch tip with the next **minor** version (reset patch to `0`)
4. Push branch and tag **only after explicit user approval**
5. Find GitLab **pipelines triggered by each tag** and return links

## Required inputs

Before running, confirm (ask if missing):
- **Release branch name** (e.g. `76.0` → branch `release/76.0`)
- **Services to ignore** (e.g. `promo-balance-service`, `replays`)

Default `repos/` root: `~/repos/` (sibling clones; override if user specifies another path).

## Service selection

- If the user refers to a prior **verify release** / **core-release-diff-audit**, use **services with `develop` vs `master` changes** from that audit, minus ignored services.
- Map GitLab paths to local folder names when needed (e.g. `integration/public-api-v1` → `public-api-v1`).
- If an expected repo path is missing locally, **stop and ask the user** — do not skip silently.

## Per-repository workflow

For each service `S`:

```bash
cd {repos_root}/S
git fetch origin
git checkout develop
git pull origin develop
git checkout -b release/{RELEASE}   # or reset existing release branch to develop
# create tag — see below
```

If `release/{RELEASE}` already exists locally, reset to `develop` unless the user says otherwise.

### Push (only after approval)

When the user explicitly approves push (e.g. "push", "push to origin"):

```bash
git push -u origin release/{RELEASE}
git push origin {TAG}
```

## Version tag rules

1. List tags: `git tag -l 'v*' --sort=-v:refname` (fallback: semver without `v`).
2. Take the **latest semver** tag.
3. Bump **minor**, set **patch = 0**:
   - `1.12.1` → `1.13.0`
   - `1.11.0` → `1.12.0`
4. Create an **annotated** tag on `release/{RELEASE}` tip:
   - Keep the same prefix as the latest tag (`v1.13.0` vs `1.13.0`).
   - Message: `Release {RELEASE}`.

## GitLab pipelines for tags

After push, for each service use GitLab MCP `list_pipelines`:

- `project_id`: `wnf3/bang/core/{service}` or `wnf3/bang/core/integration/public-api-v1` as appropriate
- `ref`: the tag name (e.g. `v3.67.0`)
- `per_page`: 5

Pick the **most recent** pipeline for that `ref` (first result). Include:
- pipeline **web_url**
- **status** (`running`, `success`, `failed`, etc.)
- **id** if useful

If no pipeline yet, wait briefly and retry once, or link the project's pipelines page filtered by tag:
`https://gitlab.com/wnf3/bang/core/{project}/-/pipelines?ref={tag}`

## Push policy (mandatory)

- **Never** run `git push` until the user **explicitly** approves in that conversation.
- Before approval: show local results and copy-paste push commands only.

## Output format

### 1. Release branches and tags

| Service | Branch | Tag | Pushed |
|---------|--------|-----|--------|
| backoffice | release/76.0 | v3.67.0 | yes / awaiting approval |

List **skipped** services (ignored / not found).

### 2. Pipelines for tags

| Service | Tag | Status | Pipeline |
|---------|-----|--------|----------|
| backoffice | v3.67.0 | running | [pipeline](url) |

Use markdown links for pipeline URLs.

### 3. MR links (optional)

GitLab prints MR creation URLs after branch push; include if useful.

## Guardrails

- Always `git pull origin develop` before branching.
- Do not commit unrelated changes; if working tree is dirty, stop and report.
- Do not amend or force-push unless the user asks.
- Ignored services: no branch, no tag, no push.
