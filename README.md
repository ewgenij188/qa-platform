# qa-platform

[opencode](https://opencode.ai) configuration for the Winfinity platform QA engineer.

An AI agent `fullstack-qa-engineer` with skills for manual and automated testing of CORE services via MCP servers for GitLab, Jira/Confluence, OpenSearch, and Grafana.

## Setup

### 1. Environment variables

Create `.env` from the template:

```bash
cp .env.example .env
```

Fill in the values:

| Variable | Purpose |
|---|---|
| `GITLAB_MCP_TOKEN` | Bearer token for the GitLab MCP (`glpat-...`) |
| `WAIBEE_API_KEY` | Waibee provider API key |

### 2. Sync skills

Skills are synced from the `platform-ai` repository:

```bash
cd ~/IdeaProjects/platform-ai
python opencode/sync.py              # install skills + MCP
python opencode/sync.py --dry-run    # preview only
```

### 3. Run opencode

```bash
opencode
```

Configuration is loaded at startup. Restart opencode after updating skills or `.env`.

## Structure

```
~/.config/opencode/
├── opencode.json          # AI providers + MCP servers
├── .env.example           # Environment variable template
├── agents/
│   ├── fullstack-qa-agent.md   # Main QA agent
│   └── standards/              # Standards (loaded automatically)
│       ├── api-testing.md
│       ├── automation-framework.md
│       ├── bug-report-template.md
│       ├── coding-standards.md
│       ├── jira-workflow.md
│       ├── test-case-template.md
│       ├── test-design-techniques.md
│       └── ui-testing.md
└── skills/                # 14 skills (synced from platform-ai)
```

## MCP servers

| Server | Purpose |
|---|---|
| **gitlab** | Repositories, MRs, pipelines, commits |
| **atlassian** | Jira issues, Confluence pages |
| **opensearch** | CORE service logs (win-dev-core-*) |
| **grafana** | Dashboards, Loki logs, Prometheus metrics, alerts, OnCall, Pyroscope |

## Agent

`fullstack-qa-engineer` — Senior Full Stack QA Engineer:

- Analyze requirements and identify gaps/risks/dependencies
- Create test cases applying test design techniques
- Write bug reports
- Design automated tests (Java, Maven, JUnit 5, Selenide, RestAssured)
- Write and review automated tests for `qa-tests-v2`

## Skills

### Releases and analysis

| Skill | Description |
|---|---|
| `branch-release` | Create release branches from develop, bump versions, tags |
| `core-release-diff-audit` | Audit develop vs master, check Jira, Avro schemas, migrations, Featbit |
| `contracts-develop-audit` | Validate OpenAPI contracts against service code |
| `analyze-release-logs` | Analyze ERROR logs after deployment in OpenSearch |
| `analyze-daily-regression` | Analyze daily regressions in Allure TestOps |
| `search-core-logs` | Search and analyze ERROR patterns in OpenSearch |

### Development

| Skill | Description |
|---|---|
| `add-new-game-type` | Add a new game type (GameType, Kafka, contracts, NuGet) |
| `add-new-game-type-autotests` | Automated tests for a new game type in qa-tests-v2 |
| `add-new-slot-game` | Register a new slot (Gambit/Winspinity) |
| `add-tablesettings-field` | New field in TableSettings / PartnerSite (model, requests, Kafka/Avro) |

### Testing

| Skill | Description |
|---|---|
| `create-testcases` | Create manual test cases in Allure TestOps |
| `winfinity-testops` | Work with Allure TestOps (Winfinity project, id=1) |
| `qa-tests-v2` | Work in the qa-tests-v2 repository |
| `qa-analyze` | QA analytics |

## Tech stack

- **opencode** v1.18.18 (Homebrew)
- **AI**: Waibee (OpenAI-compatible API) + Claude (Anthropic)
- **MCP**: GitLab, Atlassian (Jira/Confluence), OpenSearch, Grafana
- **Python 3.7+** — sync scripts
- **Node.js** — `@opencode-ai/plugin`

## Security

- `opencode.json`, `.env`, `.env.example`, `package*.json`, `node_modules` — in `.gitignore`
- Tokens and keys are **never** committed
- `.env.example` contains only variable names without values
