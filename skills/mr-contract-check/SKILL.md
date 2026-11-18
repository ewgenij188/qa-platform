---
name: "mr-contract-check"
description: "Inspect a GitLab MR's diff for HTTP API contract changes, compare against the contracts repository (wnf3/bang/core/contracts), and always post a verdict comment (anchor a diff discussion when an update is needed, or a plain note when none is). Independent skill."
---

# MR Contract Check

## When this runs

This skill is **independent**. It handles **HTTP API contract drift** only. Tell
the result on the origin MR: anchor a resolvable diff discussion when an update is
needed, or a plain note when none is needed — **always leave a comment**.
The header is always `## Contracts` with first line `Update needed: yes | no`.

## Use when

A GitLab MR touches backend HTTP API code. The skill checks whether the API
surface changed (new endpoints, modified request/response shapes, changed fields,
new enum values, nullable/required changes, etc.) and whether the corresponding
contract in `wnf3/bang/core/contracts` needs updating.

## Workflow

### 1. Inspect the MR diff

- `GET /projects/{urlencoded}/merge_requests/{iid}` — confirm the MR, author,
  title, description, source/target branches, `diff_refs.*`.
- List changed files and get the full diff on the relevant ones.

### 2. Determine whether an HTTP API contract changed

**Always relevant (contract-changing):**
- New controller actions, routes, or HTTP methods on existing routes
- New/modified request DTOs (props added, removed, or type-changed)
- New/modified response DTOs
- Changed nullability (`string` → `string?` or vice versa)
- Changed required/optional status (`[Required]`, `[JsonProperty(Required=...)]`)
- New/removed enum values
- New/removed query/route parameters or headers
- Changed response status codes
- Changed `[ProducesResponseType]` / `[SwaggerResponse]` attributes

**Not relevant (likely no contract change):**
- Pure internal logic (service/repository/helpers)
- DB access, ORM mappings, migrations
- Logging, metrics, telemetry
- Unit/integration test changes
- Config files, `.csproj`/NuGet bumps
- Whitespace, comments, formatting

### 3. Identify the affected endpoint/request/response

For each API-relevant change, trace the DTO/model back to the controller action
and record: HTTP method, route template, request/response body types, status codes.

### 4. Find the corresponding contract

Repo: `wnf3/bang/core/contracts`. Explore the tree and read candidate contract
files (OpenAPI/Swagger YAML or JSON, organized by API version e.g. `v4/`, `v5/`
or by service/domain). Match by route pattern, HTTP method, and DTO shape.

### 5. Compare implementation vs contract

Compare field-by-field for each affected endpoint:

- **Request body** — every implementation property present in the contract? types,
  nullability, required/optional consistent?
- **Response body** — same.
- **Route** — path + method match?
- **Query/route params** — all present with correct types + required/optional?
- **Status codes** — documented responses match?

Record each mismatch with: contract file + path, specific field/param, and
expected (implementation) vs actual (contract).

### 6. Check for a prior verdict

Before posting, check whether a previous run of this skill already left a comment
on the MR (this makes re-runs, e.g. a commit push, idempotent).

Read the MR's existing notes/discussions. Match only comments authored by me (the
Sebastian service account) that carry the `## Contracts` header — author + header
is enough to identify them.

- **Unresolved `Update needed: yes` discussion** → the actionable finding is still
  pending on the author. **Skip** — do not post another comment.
- **Resolved discussion, a `Update needed: no` note, or no prior comment** → re-run
  the check against the current diff and post a fresh verdict.

### 7. Check for an existing contracts MR (same ticket/task)

**Before** telling the author to open a contracts MR, check whether one already
exists in `wnf3/bang/core/contracts` for the same ticket/task. The author often
opens the contracts MR in parallel (minutes apart, same CORE-* task).

- List the contracts repo's open MRs:
  `GET /projects/{urlencoded}/merge_requests?state=opened` for project
  `wnf3/bang/core/contracts`.
- Match by title / source-branch / description against the implementation MR's
  ticket id (e.g. `CORE-4117`). Watch for ticket mismatches: a contracts MR may be
  titled `CORE-4117` but actually branch/close `CORE-4084` (or vice versa) — flag
  that if seen.
- If a matching MR exists, read its diff and compare against the gaps you found.
  Verify **every** flagged endpoint/field/param is actually updated in that
  contracts MR (missing items still need flagging).
- Respond accordingly:
  - **Fully covered** → reply on your contract-check threads pointing at the
    existing contracts MR ("already covered by !NNN") — do not tell the author to
    create a new one.
  - **Partially covered / missing items** → note which items are still absent.
  - **No matching MR** → proceed to step 8 (post the "create a contracts MR"
    comment).

### 8. If the contracts repo needs a change (and none exists)

Do **NOT** auto-create a contracts MR. Leave feedback on the **original MR** as an
**anchored diff discussion** (same convention as `ocr-mr-review`): a `POST
/projects/{path}/merge_requests/{iid}/discussions` carrying a `position` with
`base_sha`/`start_sha`/`head_sha` + `new_line`, so it is resolvable inline.

Anchor to the relevant added/changed line where possible. If no single line fits
(e.g. a whole missing endpoint), fall back to the closest changed route or DTO
line. The body should follow:

```
## Contracts

Update needed: yes

Endpoint: `POST /api/v4/...`

| Field | Issue |
|-------|-------|
| `request.newField` | Missing from contract (type: `string`, nullable: false) |
| `response.field` | Type mismatch: implementation returns `int`, contract says `string` |

Please create a contracts MR to update these before merging.
```

### 9. No changes needed

Still leave a comment that the MR was checked and no contract update is required.
Post it as a plain note — NOT a resolvable diff discussion (there is nothing to
resolve). Use the same form:

```
## Contracts

Update needed: no

Endpoint: `POST /api/v4/...` (or "none — no HTTP API surface change")

Checked: the change does not alter the HTTP API surface (internal logic,
config, tests, etc.), or the changed surface already matches the existing
contract. No contract update needed.
```

## Contracts repository details

- **GitLab project**: `wnf3/bang/core/contracts`
- **Structure**: organized by API version (`v4/`, `v5/`) and domain.

## Rules

- **Comment language (mandatory).** All contract-check comments and replies must
  be written in **English**, regardless of the author's language. Never write a
  review comment in Russian (or any other language).
- **Always leave a comment.** Anchor a resolvable diff discussion when an update
  is needed; post a plain (non-resolvable) note when no update is needed — never
  stay silent (matching the team's inline-resolution habit).
- When an update IS needed, post **anchored, resolvable diff discussions** — never
  a loose MR-level note.
- Focus on the **latest** API version unless the MR targets a specific older one.
- If no contract file exists for an endpoint, report it as a missing contract.
- Skip internal/non-public endpoints, but flag that assumption in the comment.
- When unsure whether a change is contract-relevant, include it with a note.
- **Check for an existing contracts MR (same CORE-* ticket) before telling the
  author to create one** — see step 7. If covered, point at it; don't duplicate.
- Watch for ticket/branch mismatches in the contracts MR (title vs description vs
  source branch) and flag them.
- **Contracts MR title convention (mandatory).** When you create a contracts MR
  (only when the author explicitly asks you to, e.g. "go and create mr yourself"),
  title it as `CORE-XXXX <short task description>` — take the task number from the
  **origin MR's title** and append a concise description of the contract change.
  Example: origin MR `Resolve CORE-4222 "Feature/ seb 2"` → contracts MR title
  `CORE-4222 Add order field to LobbyCategoriesResponse`. Do NOT use a colon
  (`CORE-4222: add ...`) or a bare ticket id — the task number must come from the
  origin MR, not be guessed.
- `GITLAB_MCP_TOKEN` is a secret — never commit it.