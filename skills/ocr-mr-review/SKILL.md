---
name: "ocr-mr-review"
description: "Run ocr AI code review on a GitLab merge request, post findings as anchored (resolvable) diff discussions, and handle MR webhooks (new MR / new commits / discussion replies) end-to-end through approval. Includes the ocr CLI install/configure + base review mechanics and the team's MR-review rules."
---

# OCR MR Review

Run an AI code review with the `ocr` CLI (alibaba/open-code-review) on a GitLab
merge request, then post every finding as a line-anchored, **resolvable** diff
discussion (never a loose MR note).

## Required input

- A GitLab MR URL or `project path + !IID`, e.g.
  `https://gitlab.com/wnf3/bang/core/backoffice/-/merge_requests/572`.

---

# Part 1 — ocr CLI: install, configure, base mechanics

This part covers installing/configuring the `ocr` CLI and the base review
mechanics (provider setup, arguments, output format, rules, troubleshooting).

## Prerequisite: ocr CLI

Before any review, check whether the `ocr` CLI is installed and functioning:

```bash
which ocr || test -f ~/.openclaw/workspace/.npm-global/bin/ocr
```

If missing or broken, install it:

```bash
npm install -g @alibaba-group/open-code-review
```

Then configure a provider/model (see below). Do not proceed past this gate until
`ocr` is confirmed available and configured.

## Environment (already wired)

- `ocr` binary: `~/.openclaw/workspace/.npm-global/bin/ocr`
  (symlink → `.../node_modules/@alibaba-group/ocr-linux-x64/bin/opencodereview`).
- Config lives under a **non-default HOME**:
  `~/.openclaw/workspace/.ocrhome/.opencodereview/config.json`
  (provider `waibee`, model `deepseek/deepseek-v4-pro-0813`).
- **Always run ocr with `HOME` pointed at `.ocrhome`**, or it tries to
  `mkdir /home/node/.opencodereview` on a read-only filesystem and dies.

```bash
OCR=~/.openclaw/workspace/.npm-global/bin/ocr
export HOME=/home/node/.openclaw/workspace/.ocrhome
```

## Provider / model setup

`ocr` must have a reachable LLM before it can review. If the wired config is
missing or wrong, set it up:

Interactive setup (recommended):

```bash
ocr config provider
```

Manual setup (alternative):

```bash
ocr config set llm.url https://api.waibee.com/v1
ocr config set llm.auth_token <api-key>
ocr config set llm.model deepseek/deepseek-v4-pro-0813
```

Verify connectivity with `ocr llm test`. Stop here and ask the user for
credentials — never invent or hardcode API keys.

## Business context (`--background`)

Analyze the review target to extract concise business context and pass it via
`--background` to improve review quality:

```bash
ocr review --audience agent --background "business context here" [user-args]
```

**Argument handling:**

- **Background context** (RECOMMENDED): `--background "context"` or `-b "context"`.
- **Default** (no args): reviews staged, unstaged, and untracked changes (workspace mode).
- **Specific commit**: `--commit` / `-c` reviews a single commit against its parent.
- **Branch comparison**: `--from <ref>` / `--to <ref>` reviews the diff between two refs.
- **Timeout**: effective timeout per group = `--timeout` × review rounds. Default `--timeout 15`, effort `medium` (2 rounds) → 30 min; `low`/`high` → 15/45 min.
- **Concurrency**: default 8 file workers; reduce with `--concurrency <n>` if rate limits are hit.
- **Preview mode**: `--preview` / `-p` previews files without running the LLM.
- **Output file**: `--output <path>` writes the full result to a file. If it fails with `unknown flag: --output`, don't fall back to stdout — ask whether to upgrade (`npm i -g @alibaba-group/open-code-review@latest`) and wait, then rerun with `--output`.
- **Installation**: if `ocr` is missing, `npm i -g @alibaba-group/open-code-review`.

**Common invocation patterns:**

| User says | Command |
|-----------|---------|
| "review my changes" / "review working copy" | `ocr review --audience agent -b "context"` |
| "review this PR" / "review feature branch" | `ocr review --audience agent -b "context" --from main --to <branch>` |
| "review commit abc123" | `ocr review --audience agent -b "context" --commit abc123` |
| "what would be reviewed?" | `ocr review --preview` |

**Output mode:**

- Always use `--audience agent` to suppress progress UI.
- **Prevent truncation**: for large reviews pass `--output /tmp/ocr_out.txt` and read the file in full via a file-reading tool — never pipe through `tail`/`head`, which drops earlier comments.

**On failure:** if `ocr review` exits non-zero (LLM connection error), don't retry blindly — consult the Troubleshooting section below.

## Output format

Each comment in OCR output contains `path`, `content`, `start_line`/`end_line`
(both 0 = positioning failed), `category` (bug/security/performance/
maintainability/test/style/documentation/other), `severity` (critical/high/
medium/low), `suggestion_code`, `existing_code`, `thinking`. Group results by
severity, discarding `low` items that are likely false positives.

**Mispositioned comments** (`start_line` and `end_line` both `0`): read the
content, examine the target file, identify the relevant section from context, and
apply the fix/suggestion to the correct location.

## Custom review rules

OCR resolves project-specific rules in this priority order:

1. `--rule <path>` (highest)
2. `<repo>/.opencodereview/rule.json`
3. `~/.opencodereview/rule.json`
4. Built-in system defaults (lowest)

By default the first matching user rule replaces the built-in system rule; set
`merge_system_rule: true` on a rule entry to include both. Rule file format:

```json
{
  "rules": [
    {
      "path": "**/*.java",
      "rule": "All new methods must validate required parameters for null",
      "merge_system_rule": true
    }
  ]
}
```

Preview which rule applies to a file: `ocr rules check <file>`.

## Advanced review options

- **Scoping**: `--exclude '<patterns>'` (comma-separated gitignore-style), merged with `rule.json` excludes.
- **Output**: `--format text|json|sarif`.
- **Model**: `--provider <name>` / `--model <name>` for a one-off override.
- **Budget**: `--max-tokens <n>` (per-group ceiling), `--max-tokens-budget <n>` (total cap), `--no-filter` (skip LLM post-filtering).

## Gotchas

- **LLM must be configured first** — `ocr review` fails loudly if no LLM is reachable.
- **Working directory matters** — operates on the repo at cwd; use `--repo /path` otherwise.
- **Untracked files reviewed in workspace mode** — stage selectively for narrower scope.
- **Large diffs may hit token limits** — `MAX_TOKENS` (prompt budget, `200000`; `ocr scan` uses `58888`), `MAX_COMPLETION_TOKENS` (`16384`). A file whose diff alone exceeds ~80% of `MAX_TOKENS` is skipped.
- **Plan phase** triggers when the largest changed file reaches `PLAN_MODE_LINE_THRESHOLD` (50) or 2+ files whose combined changed lines reach `PLAN_MODE_GROUP_LINE_THRESHOLD` (100).
- **Don't pass `--audience human`** — it streams progress UI. Always `--audience agent`.
- **Comment language** follows the `language` config (default `English`).
- **Resume an interrupted review**: `ocr review --resume <id>` with same `--from`/`--to`/`--commit` (id printed as `retry with: --resume <id>`, or `ocr session list`). Workspace resume unsupported.

## Validation

After review, verify: exit code 0, comments generated (or "No comments generated"), warnings (if any) in stderr.

## Troubleshooting

**`ocr: command not found`** → `npm install -g @alibaba-group/open-code-review`.

**`unknown flag: --output`** → CLI older than v1.10.0; ask before upgrading, then rerun with `--output`.

**LLM connection error** → `ocr config provider` (interactive) or `ocr config set llm.*` (manual); verify with `ocr llm test`. Never invent/hardcode API keys.

---

# Part 2 — GitLab MR workflow (the team's review rules)

This part covers the MR review workflow and the team's hard rules.

## Workflow

1. **Parse** project path + IID from the URL. Query the MR via the GitLab API
   (`GET /projects/{urlencoded_project}/merge_requests/{iid}`) to get
   `diff_refs.base_sha`, `diff_refs.head_sha`, `diff_refs.start_sha`,
   `source_branch`, `target_branch`.

   The MR head is authoritative — a local checkout branch tip is often stale.

2. **Skip if already reviewed.** Compare the MR's `diff_refs.head_sha` against the
   last-reviewed head SHA for this MR (track it in a note, e.g.
   `memory/ocr-mr-review-state.json` keyed by project + IID). **If the head SHA is
   identical to one already reviewed, do NOT run the review again** — reuse the
   prior findings (and tell the user you're reusing them). Only re-run when the
   head SHA has moved, or the user explicitly asks to force a fresh review.

3. **Fetch blobs** in the local clone (`~/repos/<service>/`) so `ocr`'s
   `git show`/`git grep` can read files (clone is blobless):

   ```bash
   cd ~/repos/<service>
   git fetch origin <head_sha> <base_sha>
   ```

4. **Review the diff** (medium effort default). Pin `--from` to the resolved
   `base_sha` (not a branch name — a branch can point at a stale/diverged commit):

   ```bash
   $OCR review --from "<base_sha>" --to "<head_sha>" --effort medium \
     --format json --audience agent -o /tmp/ocr-mr-review.json
   ```

   Run in background (`nohup ... &`); medium is ~10-20 min. Poll the log and the
   output JSON. Progress is visible via `review_item_done` events in the session
   `.jsonl` under `.ocrhome/.opencodereview/sessions/`.

5. **Record the head SHA** after a successful review so step 2 works next time.

6. **Map paths.** `ocr` can emit **slash-separated** project dirs
   (`Bang.BackOffice/ApiResources/...`) where the repo uses **dot-separated**
   (`Bang.BackOffice.ApiResources/...`). Resolve with:

   ```bash
   git ls-tree -r --name-only <head_sha> | grep -i '<short-filename>'
   ```

7. **Verify anchors.** Fetch the MR diffs and confirm each comment's `new_line`
   is on the new-file side of a hunk — GitLab rejects positions whose
   `line_code` is not a real diff line. Skip/retry otherwise.

8. **Always answer in the diff discussion thread.** When a comment shows up in
   a diff discussion (an author reply on one of your anchored findings, or a
   new comment in a thread), **always** post your response as a threaded reply
   directly in *that* discussion thread — never as a loose general note. There
   is no dedup/claim gate that lets you skip a reply; if a comment is shown,
   you answer it in its thread.

9. **Post** as diff discussions through the GitLab REST API with header
   `PRIVATE-TOKEN: $GITLAB_MCP_TOKEN`. Do not use the GitLab MCP server.

   ```
   POST /projects/{urlencoded_path}/merge_requests/{iid}/discussions
   {
     "body": "<markdown>",
     "position": {
       "base_sha": "...", "start_sha": "...", "head_sha": "...",
       "position_type": "text",
       "new_path": "<repo path>", "old_path": "<repo path>",
       "new_line": <int>
     }
   }
   ```

   **This endpoint is load-bearing. Do NOT post the review via
   `POST /projects/{path}/merge_requests/{iid}/notes`.** The `/notes` endpoint
   **silently strips the `position` field** and turns the comment into a loose,
   non-resolvable general note (no `position_type`, `resolvable:false`) — with no
   error either. Only `.../discussions` preserves the anchor, so post there.

   Position shape (verified 2026-10-07 on backoffice MR !592):
   - `base_sha`, `start_sha`, `head_sha` are all **required**. `head_sha` must be
     the **current MR head** (`diff_refs.head_sha` re-fetched right before
     posting — a dev can push while you review). A stale `head_sha` makes GitLab
     silently drop the anchor.
   - **Omit `old_line`** (and the legacy `line_code`). Including `old_line`
     returns HTTP 400 `line_code ... must be a valid line code`. `new_line` alone
     is sufficient for a `text` position on the new-file side.
   - Covering a **deleted/old-side** line instead: set `old_line` and omit
     `new_line` on `old_path`.
   - Use `urlencode`'d lowercase project path (e.g. `wnf3%2Fbang%2Fcore%2Fbackoffice`).

   **Verify the anchor actually landed** on every post. Inspect the created note:
   - 🟢 correct: `position.position_type == "text"` AND `resolvable == true`.
   - 🔴 wrong (was routed through `/notes` or stale `head_sha`):
     `position == null`, `type == null`, `resolvable == false` — a loose general
     note. Delete it and re-post via `/discussions`.

   `grep -oP 'oauth2:\K[^@]+' "$(git config --global --get url.https://oauth2:.*.insteadof)"`
   is **not** how to get the token — read it from `git config --global --list |
   grep -oP 'oauth2:\K[^@]+'` (the git-credential token, = the "Sebastian"
   service account) or `GITLAB_MCP_TOKEN` from the environment.

   Helper script: `scripts/post_mr_discussions.py` (reads a findings JSON and
   posts each entry).

10. **Collapse duplicates** (same file+line, or same content) into one comment,
    including against your own prior posts on the same MR.

11. **Read replies and answer.** On a follow-up, list your discussions on the MR
    and read any author replies (network summary + full thread notes):

```bash
$OCR_SCRIPTS/check_discussion_answers.py "<project_path>" <iid>
```

It marks threads where a **non-you note is last** (an unanswered reply).
Then, for each reply, decide whether it actually asks for a response:

- **Answer** when the author pushes back technically, asks a question, or
  makes a point you can confirm/clarify with a verifiable claim. Verify the
  claim against the current code before replying — fetch the file at the MR
  `head_sha` (`GET /projects/{path}/repository/files/{f}/raw?ref={head_sha}`),
  don't trust your memory of the diff.
- **Stay silent** on pure acknowledgments / resolutions (`fixed`, `поправил`,
  `удалил`, `ожидаемо`, `задел на будущее`, `так проще`, `можно не в мою
     смену`). Adding a "thanks" there only adds thread noise.

Post a reply to an existing discussion with (a note on the thread — this does
NOT need a `position`, it lands as a threaded reply):

```
POST /projects/{urlencoded_path}/merge_requests/{iid}/discussions/{discussion_id}/notes
{"body": "<markdown>"}
```

**Write comments in English.** All review findings, replies, and thread
responses must be in English, regardless of the author's language or the
thread's prior language. Keep it brief and confirm/counter with specifics.

## Webhook handling

GitLab webhooks fire for MR lifecycle events. Three matter here: **new MR**,
**new commits** (push to the MR source branch), and **new comment in a diff
discussion**. Route each through the rules below. The webhook payload carries the
`object_attributes` (IID, action, `last_commit.id`) and, for comment events, the
note + `position`/`discussion_id`. **Always re-query the MR via the GitLab API**
(`GET /projects/{urlencoded_project}/merge_requests/{iid}`) rather than trusting
webhook fields alone — the API `diff_refs.head_sha` is authoritative for
deciding whether a re-review is needed.

### New merge request

Treat exactly like a fresh trigger: run the standard **Workflow** from step 1.
Parse project + IID from `object_attributes`, fetch the MR, then review, post
findings as diff discussions, and do NOT approve yet (approval only happens once
every OCR thread is resolved).

### New commits pushed

0. **Dedupe the approve/unapprove action first — but only for duplicate
   deliveries of the *same* head.** Before touching approval state, check
   whether I have already approved the *current* `head_sha` (`GET .../approvals`
   → my service account is in `approved_by`, and the recorded
   `last_reviewed_head_sha` == current `diff_refs.head_sha`). If my approval is
   already in place for this exact head **and there is no new information**
   (no new findings, no new comments needing a reply), **no-op** — do NOT
   unapprove/re-approve. A single push can fire multiple webhook deliveries;
   this guard only suppresses that churn.

   **Do NOT let this guard suppress a legitimate unapprove.** If the new head
   actually breaks something or needs new comments, unapprove and re-review as
   normal — the guard is about *duplicate deliveries of an already-handled
   head*, not a blanket "never unapprove once approved." When in doubt about
   whether the head is genuinely new vs. a duplicate, re-review rather than
   no-op.

1. **Disapprove the MR** (remove any prior approval) and **re-run the review**
   against the new `diff_refs` — the head SHA has moved, so step 2's "skip if
   already reviewed" guard does NOT short-circuit this; treat it as a forced
   re-review of the new head.
2. **If everything looks good** (no new findings, and no unresolved OCR threads
   remain): **approve the MR**.
3. **If there are issues or unresolved discussions:** return to the diff
   discussion flow below and handle each thread (do not approve until all OCR
   threads are resolved).

Posting approval/disapproval uses the GitLab approval API:

```
POST /projects/{urlencoded_path}/merge_requests/{iid}/approve
POST /projects/{urlencoded_path}/merge_requests/{iid}/unapprove
```

(`unapprove` removes *the current service account's* approval; it does not touch
other reviewers' approvals.)

### New comment in a diff discussion

**Only reply to comments on threads I created.** A "new comment" webhook fires
for *any* comment on the MR, including comments by other reviewers (humans or
bots) on threads that are not mine. Those are addressed to the branch owner,
not to me — do **not** reply to them. Filter by the discussion's first-note
author: only act when the comment is on a thread whose first note was posted by
my service account (Sebastian). Comments on other reviewers' threads are out of
scope — skip them entirely (no reply, no resolve, no approve action).

This gate is **not webhook-specific** — it applies to the initial/audit review
and to manual discussion-list polling exactly as it applies to webhook events.
When reading the MR's existing discussions during a fresh review (or listing
threads to answer), treat a human reviewer's comment on the author's code as
someone else's business. Enumerate all unfiltered discussions *before* deciding
what to answer, and only answer threads whose first-note author is my service
account. Findings I post myself are the only threads I should ever reply into.

**Always reply to a comment webhook on my own thread — even when you think the
thread can be ignored.** Never silently drop a "new comment" webhook on a thread
I own. If you determine the comment needs no action (a pure acknowledgment, a
self-note like "push here validation code with a new commit", or "I'll fix it
later"), still reply and state (a) why you're taking no action and (b) what
you're waiting on (e.g. the author's next commit). "Ignoring the thread" ≠
"ignoring the webhook": the thread may stay open, but you must always
acknowledge the comment and explain your call. Crucially, treat an imperative
note in your own thread ("push the code here", "добавь код сюда") as a
**request to supply the concrete code**, not a self-reminder — reply with the
code.

On each new comment in one of **my** diff threads:

0. **De-duplicate replies BEFORE posting.** A single comment can fire multiple
   webhook events (and a burst of author replies can re-trigger the answer step
   repeatedly), so always check first whether you have **already replied on this
   exact thread for this exact comment**. List the full thread (step 11's
   `check_discussion_answers.py` + full-thread note listing) and, if you already
   have a non-system note on that thread that answers the author's latest point,
   **do NOT post another reply** — skip. You answer each author comment **once,
   at most once**, per thread. Only post if the author has raised a *new* point
   you haven't already addressed. This applies to findings too (see Workflow
   step 10): never leave duplicate comments on the same file+line or with the
   same content.

1. **Check the answers** in the discussion (read the full thread — see Workflow
   step 11's `check_discussion_answers.py` + full-thread note listing).
2. **If the answers are satisfactory** (the author addressed the finding — e.g.
   fixed it, explained it was intentional, or made a change that resolves the
   concern): **resolve the thread** so it no longer blocks approval.
   **Also resolve when the branch nets to no effective changes against the
   target branch:** if comparing target (`base_sha`) → current `head_sha` yields
   an **empty diff** (every code/contract change is paired with a matching
   revert, so there is literally nothing to review/merge), the prior findings
   are moot — resolve your open threads (and note there is nothing to merge; if
   the revert was accidental, the author should restore the commits before
   re-requesting review).
3. **If the answers are NOT satisfactory** (finding not addressed, vague,
   wrong, or still unresolved in the current head SHA): leave a comment with the
   exact text **`Resolve manually.`** and leave the thread **open**.
4. **Once all threads created by OCR on this MR are resolved, approve the MR.**
   Only resolve threads you yourself created (filter by the Sebastian service
   account, per the Rules below); never resolve or approve based on another
   author's thread.

Resolving a discussion thread (marks all its notes resolvable/closed):

```
PUT /projects/{urlencoded_path}/merge_requests/{iid}/discussions/{discussion_id}
{"resolved": true}
```

### Comment webhook — imperative-action handling

A reviewer's comment on one of **my** threads can be an **imperative** (a
command / ask), not just a question or an acknowledgment. These must be
executed **in-place, in that thread, immediately** — never deferred, and never
answered in a different thread.

1. **Resolve the discussion first, then act.** Before writing any reply, fetch
   the **full discussion** (`GET .../discussions/{id}` — not just the single
   note), so I know which thread the comment is in and what the reviewer was
   asking *in that thread*.

2. **Classify the note** into exactly one bucket:

   - **Imperative / ask** — imperative mood or a request for an artifact or
     state change: `close it` / `resolve`, `create contracts mr`, `create MR`,
     `push the code`, `fix it with a new commit`, `approve`, `unapprove`,
     `explain it to me`. → **execute it now, in this thread.**
   - **Question / pushback** — a genuine technical question or disagreement.
     → verify against the current head SHA, then answer in-thread.
   - **Acknowledgment / resolution** — `fixed`, `ок`, `сделал`, `already said`,
     pure thanks. → **stay silent** (no reply), but **still verify the fix**: fetch
     the file at the current `head_sha` and confirm the finding is actually
     addressed; if it is, **resolve the thread** per the resolve gate. "Stay
     silent" only means *no reply* — it does **not** mean *skip the resolve*.
     Resolution follows the same "answers are satisfactory" verdict as any
     other addressed finding.

3. **Imperative → execute in-place.** Each imperative maps to a concrete action
   performed immediately, confirmed inside the *same* thread:

   | Reviewer says | I do |
   |---|---|
   | `close it` / `resolve` | `PUT .../discussions/{id} {"resolved": true}` if answers are satisfactory per the resolve gate. |
   | `create contracts mr` | create it (respect "one contracts MR per ticket"), reply in-thread with the link. |
   | `fix it with a new commit` | push the change to the MR source branch, reply in-thread with the commit SHA. |
   | `push the code` / `добавь код сюда` | supply concrete code in-thread (existing rule). |
   | `approve` | approve only if the all-OCR-threads-resolved gate is met; else state the blocker. |
   | `explain it to me` | plain-language explanation in-thread. |

4. **Reply in the exact originating discussion.** The confirmation goes as a
   threaded note on the **same discussion** where the reviewer issued the
   command — never a "thematically related" thread, never a general MR note.
   Trace each ask to its discussion before replying.

## Rules

- **Comment language (mandatory).** Every comment — findings, replies,
  approvals/resolution notes, and webhook acknowledgments — must be written in
  **English**. Never write a review comment in Russian (or any other language),
  even when the author or an existing thread uses Russian. This overrides any
  "match the thread's language" instruction.
- **Comment formatting (mandatory).** A finding/reply must be valid Markdown:
  a `## heading` or a `**bold**` lead line must be followed by a **blank line**
  before the body — never join the heading and the first body token on one line
  (this fuses everything into the heading and renders a broken comment).
  Bullet/numbered list items must each sit on their own line. Do not run the
  heading, paragraph, and list together without newlines.
- **Never re-run the review when the MR `head_sha` is already reviewed.** Reuse
  prior findings unless the head moved or the user explicitly forces a re-review.
- Review the **MR diff only** by default, not the whole repo. If the user wants
  dependency/unchanged-file review, use `ocr scan` on those files instead.
- Post **diff discussions anchored to a line** (resolvable) — never loose notes.
  The `.../discussions` endpoint is mandatory; `/notes` silently strips the
  anchor. See Workflow step 9 for the exact payload + verification.
- Never post until each `new_line` is verified against the **current MR head**
  and confirmed to sit inside a diff hunk (the head can move mid-review —
  re-fetch `diff_refs.head_sha` immediately before posting).
- Pin `--from` to `diff_refs.base_sha`; do not rely on a branch name.
- The skill file must be named `SKILL.md` (lowercase `.md`), not `SKILL.MD` — the
  OpenClaw loader keys on `SKILL.md` and silently ignores uppercase variants.
- `GITLAB_MCP_TOKEN` is a secret — never commit it.
- My review service account is `service_account_group_13588526_3ed73b818b8cf9f205256bf31632a848`
  (display name "Sebastian"). Filter discussions by this username to find *my*
  threads — bots (SonarQube) and humans post to the same MR, so never treat
  another author's thread as your own.
- When answering a reply, verify against the current head SHA, not a stale local
  checkout or a remembered diff. If the author already fixed it exactly as
  suggested, a short confirmation is enough; if the concern is still unresolved
  in code, say so rather than rubber-stamping.
- Do not reply to acknowledgments. Only reply when there is a genuine question,
  disagreement, or claim worth confirming.
- **Always reply to a comment webhook on my own thread, even when you judge the
  thread ignorable.** Deciding a thread needs no action is not a reason to stay
  silent on the webhook itself — acknowledge it and explain what you're waiting
  on. Never ignore a comment webhook on a thread I own; the reply is to the
  event, the thread stays open/closed per the normal gate.
- **Do not reply to other reviewers' comments — webhook or not.** A comment on a
  thread I did not create (first-note author ≠ Sebastian service account) is
  addressed to the branch owner, not me. Skip it entirely — no reply, no
  resolve, no approve action. Only act on threads I own. This is a **standing
  rule for every reply**, not just webhook events: a human reviewer's own review
  comment (e.g. on the MR author's code) is *not* an invitation for me to jump
  in, even when it surfaces as I read the MR during an initial/audit review or
  when I poll the discussion list. Filter by the first note's author before
  replying to anything.
- **Exactly one reply per author comment, per thread.** The same comment can
  fire multiple webhooks; before replying, check you haven't already answered
  that thread/comment and skip if you have. Never post near-duplicate replies to
  the same thread (this caused multiple redundant Russian explanations on
  backoffice MR !593, 2026-10-08). Dedup both findings and replies.
- **Always answer in the diff discussion thread where the comment shows up.**
  Post every reply as a threaded note on the exact discussion (`.../discussions/{id}/notes`),
  never as a general MR note. When a comment is shown in a thread, answer that
  thread — do not skip it and do not reply elsewhere.
- **One contracts MR per ticket.** Before creating a contracts MR, claim
  `contracts-mr` and also list open contracts MRs for that CORE-* ticket; if one
  exists, point at it instead of creating another (duplicate !190/!191 happened
  2026-10-08).
- **Webhook-only approvals:** never approve an MR unless triggered by a webhook
  (new MR reviewed clean, or new commits that review clean, or all OCR threads
  resolved). A manual "please approve" request still follows the same gate: only
  approve when there are no unresolved OCR threads.
- **Never unapprove/approve on a duplicate delivery of an already-handled head.**
  Before any disapprove/approve, check `GET .../approvals` — if my service
  account is already in `approved_by` for the current `diff_refs.head_sha` *and*
  there is no new information (no new findings, no new comments needing a reply),
  no-op. This only suppresses duplicate webhook churn. It does **not** block a
  legitimate unapprove: if a new commit breaks something or needs new comments,
  unapprove and re-review as normal.
- **Disapprove on new commits** before re-reviewing; never leave a stale approval
  in place after the head SHA moved.
- **`Resolve manually.` is verbatim** — use that exact string when a thread's
  answer is not satisfactory, and leave the thread open (do not resolve it
  yourself).
- **Resolve only your own threads**, keyed by the Sebastian service account;
  only count OCR-created threads toward the "all resolved → approve" gate.
- **Resolve when the branch nets to no changes vs the target branch.** When
  `base_sha` → `head_sha` diffs to **empty** (reverts undo every change, so
  there is nothing to review or merge), the findings are moot — resolve your
  open threads and state that there is nothing to merge (no re-approval on an
  empty diff); flag that an accidental revert should be restored before
  re-requesting review.
- **Imperative comments are actions, not discussion points.** When a reviewer
  on my own thread writes an imperative (`close it`, `create contracts mr`,
  `fix it with a new commit`, `push the code`), that is a command to execute
  *now* in that thread — not a conversational reply to defer. Execute the
  mapped action immediately, then confirm in the same thread.
- **Reply where the ask happened, not where the topic lives.** Verify the
  originating discussion (via `GET .../discussions/{id}`) before answering, and
  post the reply on *that* discussion. Do not collapse an ask from thread A
  into an answer on a topically-similar thread B.
- **When the reviewer says `close it` / resolve:** treat it as the resolve gate
  (`PUT .../discussions/{id} {"resolved": true}`) and close the thread, provided
  the thread's answers are satisfactory per the existing resolve rules; do not
  leave it open pending a human re-prompt.
- **Self-fix → self-resolve on the commit webhook.** When I fix a finding from
  my **own** review comment (e.g. in response to `fix it with a new commit`),
  resolve that discussion thread **myself as soon as my fix commit lands** on
  the MR head — do NOT leave it unresolved for the author/reviewer to close
  after acknowledging with a "Nice"/"fixed"/etc. The acknowledgment bucket
  above says to stay *silent* (no reply), but the *thread* must still be
  resolved by me. Verified 2026-10-23 on backoffice MR !606 (I left my own
  thread open after committing `dddbc90f`; Ruslan's "Nice" exposed the gap).