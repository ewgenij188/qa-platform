---
name: "mr-documents-check"
description: "Inspect a GitLab MR and compare it with current knowledge-map features and their linked Confluence pages. Report whether a new feature is needed. Suggest a doc change only when Confluence does not already describe it. Do not edit the knowledge map."
---

# MR Documents Check

## When this runs

This skill is **independent**. It checks documentation drift. It does not edit the knowledge map, Confluence, or the MR's code.

The map lives in `wnf3/bang/core/tools/platform-ai` on `main`: `knowledge-map/` and `indexes/features-index.md`.

Tell the result on the origin MR. When a doc update is needed, anchor a resolvable diff discussion; when none is needed, leave a plain note (not resolvable).

## Use when

A GitLab MR is in a service that already has a page under `knowledge-map/systems/<gitlab project path>/`.

## Workflow

### 1. Inspect the change

Read the MR from the GitLab REST API when it is reachable: `GET https://gitlab.com/api/v4/projects/{urlencoded}/merge_requests/{iid}` and `GET .../merge_requests/{iid}/diffs`, header `PRIVATE-TOKEN: $GITLAB_MCP_TOKEN`. Do not use the GitLab MCP server. Take author, title, source and target branches, `diff_refs.*`, changed files, and the diff from that response.

The same change can be read from a local clone of that service. Diff the MR source branch against its target branch. Use that diff when GitLab is unreachable, and whenever the branch is already checked out. Do not invent the change from memory or from an unrelated branch.

If neither the MR nor that local branch is available, stop and say so.

### 2. Read the current features

Read platform-ai `main`, not a stale checkout.

Map the GitLab project path onto `knowledge-map/systems/<project path>/`. Read that service's `index.md`, `<service>.md`, and `indexes/features-index.md`.

**No feature catalog for this project.** Stop. Say this service is not in the knowledge map. Do not propose a new service page.

### 3. Compare the change with those features

Say which current feature the change belongs to, or that none of them cover it.

A **new feature** is needed when the change is a new capability the catalog does not list: a new route, command, or flow that is not an entry point of a feature already there.

An **existing feature** still covers it when the change is that capability: a bugfix, a refactor, or another entry point of the same feature. Say so. Do not propose a new feature.

A bugfix or refactor only short-circuits to "no doc change" when it **does not alter behavior the linked page describes**. Adding no new route, command, or topic is **not** by itself enough to conclude "no update" — the change may still alter observable behavior (timing, retry, emitted results, status transitions, message shapes) that the page asserts. When it does, fall through to the Confluence check (step 4) and report update-needed if the page now contradicts the code.

Skip the check when the diff cannot change what a feature describes: tests, project files, formatting, logging only, metrics only, or a package bump.

### 4. Check Confluence

Open only Confluence pages linked from the feature that matches, or from the service page. Those pages are the product description. Other Confluence pages are not a source for this check.

- **The linked page already describes the change.** Say that. Do not suggest a documentation change. Do not copy the page.
- **The linked page states behavior this diff now contradicts.** If the page makes a concrete claim — a sentence about timing, retry, what is emitted, a status transition, a table row, a `core.*` topic's payload — that the diff falsifies, treat it as update-needed even when no new route, topic, or command is added. Point at the exact section and claim that is now wrong.
- **No linked page describes the change.** Suggest what to add: the capability, in a few sentences. Do not paste the diff. Do not edit Confluence or the knowledge map. Ask the author to make the change.

### 5. Check for a prior verdict

Before posting, check whether a previous run of this skill already left a
comment on the MR (this makes re-runs, e.g. a commit push, idempotent).

Read the MR's existing notes/discussions. Match only comments authored by me
(the Sebastian service account) that carry the `## Documents` header — author +
header is enough to identify them.

- **Unresolved `Update needed: yes` discussion** → the actionable finding is
  still pending on the author. **Skip** — do not post another comment.
- **Resolved discussion, a `Update needed: no` note, or no prior comment**
  → re-run the check against the current diff and post a fresh verdict.

This keeps one actionable request per MR while re-evaluating when the diff has
moved on.

### 6. Tell the result

First line is always the verdict: `Update needed: yes | no`. Details come after.

**Update needed.** Anchor a resolvable diff discussion to the line that
introduces the behavior (if no single line fits, the closest changed line):

```
## Documents

Update needed: yes

Feature: <existing feature id, or "none — a new feature is needed">
Confluence: <linked page url, or none>

<suggestion: the capability, in a few sentences. Do not paste the diff.>
```

**No update needed.** Still leave a comment that the MR was checked and no
documentation update is required. Post it as a plain note — NOT a resolvable
diff discussion (there is nothing to resolve):

```
## Documents

Update needed: no

Feature: <existing feature id that covers the change>
Confluence: <linked page url>

Checked: the change is <a bugfix | a refactor | an entry point of> the feature
above, and the linked page already describes it. No documentation update needed.
```

## Rules

- Do not edit the knowledge map or Confluence.
- Do not create a service page for a project the map does not cover.
- Suggest a documentation change only when the linked Confluence page does not already describe the change.
- When unsure whether a current feature covers the change, say so and name the feature you compared.
- `GITLAB_MCP_TOKEN` is a secret. Never commit it.
