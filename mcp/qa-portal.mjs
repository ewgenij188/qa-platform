#!/usr/bin/env node
// MCP-сервер для QA Portal (qa-quality-guard): чтение и заполнение daily-репортов.
// Без зависимостей: newline-delimited JSON-RPC 2.0 поверх stdio.
// Токен берётся из QA_PORTAL_TOKEN (задаётся в конфиге OpenCode).

const BASE = "https://qa-quality-guard.int.wnf.rocks";
const TOKEN = process.env.QA_PORTAL_TOKEN;

async function api(path, method = "GET", body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  if (res.status === 204 || !text) return null;
  return JSON.parse(text);
}

function slimReport(r) {
  return {
    id: r.id,
    entryDate: r.entryDate,
    reportTime: r.reportTime,
    answers: (r.answers ?? []).map((a) => ({
      questionId: a.questionId,
      label: a.label,
      type: a.type,
      value: a.value,
      values: a.values,
    })),
    tasks: (r.tasks ?? []).map((t) => ({
      task: t.task,
      jiraKey: t.jiraKey,
      timeSpent: t.timeSpent,
    })),
  };
}

const tools = {
  async qa_portal_questions() {
    // Список вопросов daily-репорта (Daily Summary, Risks и т.д.) с их id
    const qs = await api("/work-log-questions");
    return qs.map((q) => ({ id: q.id, label: q.label, type: q.type, options: q.options }));
  },

  async qa_portal_get_reports({ from, to = from }) {
    // Репорты текущего пользователя за диапазон дат (YYYY-MM-DD)
    const page = await api(
      `/work-logs?from=${from}&to=${to}&page=0&size=100&sort=entryDate,DESC`
    );
    const items = page.content ?? page;
    if (!items.length) return `Нет репортов за ${from}${to !== from ? " — " + to : ""}`;
    return items.map(slimReport);
  },

  async qa_portal_save_report({ date, summary, answers = [], tasks, reportTime }) {
    // Создаёт или обновляет репорт за дату. summary — короткий путь для вопроса "Daily Summary".
    if (!TOKEN) throw new Error("QA_PORTAL_TOKEN не задан");

    const page = await api(
      `/work-logs?from=${date}&to=${date}&page=0&size=10&sort=entryDate,DESC`
    );
    const existing = (page.content ?? page).find((r) => r.entryDate === date);

    let merged = (existing?.answers ?? []).map((a) =>
      a.type === "MULTI_CHOICE"
        ? { questionId: a.questionId, values: a.values }
        : { questionId: a.questionId, value: a.value }
    );
    // Явно переданные answers перекрывают существующие по questionId
    for (const a of answers) {
      merged = merged.filter((m) => String(m.questionId) !== String(a.questionId));
      merged.push(a.values !== undefined
        ? { questionId: a.questionId, values: a.values }
        : { questionId: a.questionId, value: a.value });
    }
    if (summary !== undefined) {
      const qs = await api("/work-log-questions");
      const q = qs.find((q) => /summary/i.test(q.label ?? ""));
      if (!q) throw new Error("Вопрос 'Daily Summary' не найден среди /work-log-questions");
      merged = merged.filter((m) => String(m.questionId) !== String(q.id));
      merged.push({ questionId: q.id, value: summary });
    }

    const mergedTasks = tasks ?? (existing?.tasks ?? []).map((t) => ({
      task: t.task,
      jiraKey: t.jiraKey ?? undefined,
      timeSpent: t.timeSpent,
    }));
    if (!mergedTasks.length)
      throw new Error("Сервер требует минимум одну задачу: передайте tasks, например [{task, timeSpent: '5m'}]");

    const body = {
      entryDate: date,
      answers: merged,
      tasks: mergedTasks,
      reportTime: reportTime ?? existing?.reportTime ?? "5m",
    };

    const result = existing
      ? await api(`/work-logs/${existing.id}`, "PUT", body)
      : await api("/work-logs", "POST", body);
    return slimReport(result);
  },

  async qa_portal_meetings({ date }) {
    // Митинги из календаря за дату (для расчёта времени на митинги)
    return api(`/work-logs/meetings?date=${date}`);
  },

  async qa_portal_delete_report({ date }) {
    // Удаляет репорт текущего пользователя за дату
    const page = await api(
      `/work-logs?from=${date}&to=${date}&page=0&size=10&sort=entryDate,DESC`
    );
    const existing = (page.content ?? page).find((r) => r.entryDate === date);
    if (!existing) return `Репорт за ${date} не найден`;
    await api(`/work-logs/${existing.id}`, "DELETE");
    return `Репорт за ${date} (id ${existing.id}) удалён`;
  },

  async qa_portal_list_disabled_tests({ environment, jiraIssue, allureId, component }) {
    // Список выключенных тестов с опциональными фильтрами
    const qp = new URLSearchParams();
    if (environment) qp.set("environment", environment);
    if (jiraIssue) qp.set("jira_issue", jiraIssue);
    if (allureId !== undefined) qp.set("allure_id", String(allureId));
    if (component) qp.set("component", component);
    const qs = qp.toString();
    return api(`/disabled-tests-data${qs ? "?" + qs : ""}`);
  },

  async qa_portal_disable_test({ allureId, environment, jiraIssue, reason }) {
    // Выключает тест на окружении: создаёт запись в disabled-tests-data (batch из одного элемента)
    const [result] = await api("/disabled-tests-data/batch", "POST", [
      { allureId, environment, jiraIssue, reason },
    ]);
    if (result.error) throw new Error(`Не удалось выключить тест: ${JSON.stringify(result.error)}`);
    return result;
  },

  async qa_portal_enable_test({ id, allureId, environment }) {
    // Включает тест обратно: удаляет запись disabled-tests-data по id, либо по паре allureId+environment
    let targetId = id;
    if (!targetId) {
      if (!allureId || !environment)
        throw new Error("Передайте id записи, либо пару allureId+environment");
      const found = await api(
        `/disabled-tests-data?allure_id=${allureId}&environment=${encodeURIComponent(environment)}`
      );
      if (!found.length)
        return `Запись для теста ${allureId} на ${environment} не найдена — уже включён`;
      targetId = found[0].id;
    }
    await api(`/disabled-tests-data/${targetId}`, "DELETE");
    return `Запись disabled-tests-data id ${targetId} удалена (тест включён обратно)`;
  },
};

const toolDefs = [
  {
    name: "qa_portal_questions",
    description: "List QA Portal daily report questions (Daily Summary, Risks/Blockers, ...) with their ids",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "qa_portal_get_reports",
    description: "Get current user's QA Portal daily reports for a date range (YYYY-MM-DD)",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD, defaults to from" },
      },
      required: ["from"],
    },
  },
  {
    name: "qa_portal_save_report",
    description:
      "Create or update current user's QA Portal daily report for a date. Use 'summary' for the Daily Summary text; 'answers' for other questions; tasks required when creating a new report.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Report date YYYY-MM-DD" },
        summary: { type: "string", description: "Daily Summary text (finds the question by name)" },
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionId: { type: "number" },
              value: { type: "string" },
              values: { type: "array", items: { type: "string" } },
            },
            required: ["questionId"],
          },
        },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string" },
              jiraKey: { type: "string" },
              timeSpent: { type: "string", description: "e.g. '2h', '1h 30m', '120m'" },
            },
            required: ["task", "timeSpent"],
          },
        },
        reportTime: { type: "string", description: "Time spent on the report itself, default 5m" },
      },
      required: ["date"],
    },
  },
  {
    name: "qa_portal_meetings",
    description: "Get calendar meetings for a date (YYYY-MM-DD) to compute meeting time for the daily report",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "Date YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "qa_portal_delete_report",
    description: "Delete current user's QA Portal daily report for a date",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "Report date YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "qa_portal_list_disabled_tests",
    description: "List disabled tests (QA Portal /disabled-tests-data) with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        environment: { type: "string", description: "e.g. 'latest', 'preprod'" },
        jiraIssue: { type: "string", description: "JIRA issue key, e.g. 'CORE-1234'" },
        allureId: { type: "number", description: "Allure test case ID" },
        component: { type: "string", description: "Component name, or 'n/a' for entries without one" },
      },
    },
  },
  {
    name: "qa_portal_disable_test",
    description: "Disable a test on an environment by Allure ID (creates a disabled-tests-data entry)",
    inputSchema: {
      type: "object",
      properties: {
        allureId: { type: "number", description: "Allure test case ID" },
        environment: { type: "string", description: "Environment name, e.g. 'preprod', 'latest'" },
        jiraIssue: { type: "string", description: "JIRA issue key tracking the reason, e.g. 'CORE-1234'" },
        reason: { type: "string", description: "Free-form reason for disabling the test" },
      },
      required: ["allureId", "environment", "jiraIssue"],
    },
  },
  {
    name: "qa_portal_enable_test",
    description: "Re-enable a disabled test: deletes the disabled-tests-data entry by id, or by allureId+environment",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "disabled-tests-data entry id" },
        allureId: { type: "number", description: "Allure test case ID (used with environment if id is not known)" },
        environment: { type: "string", description: "Environment name (used with allureId if id is not known)" },
      },
    },
  },
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handleLine(line);
  }
});

async function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  try {
    switch (method) {
      case "initialize":
        respond(id, {
          protocolVersion: params?.protocolVersion ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "qa-portal", version: "1.0.0" },
        });
        break;
      case "ping":
        respond(id, {});
        break;
      case "tools/list":
        respond(id, { tools: toolDefs });
        break;
      case "tools/call": {
        const fn = tools[params?.name];
        if (!fn) return respondError(id, -32602, `Unknown tool: ${params?.name}`);
        const out = await fn(params.arguments ?? {});
        const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        respond(id, { content: [{ type: "text", text }] });
        break;
      }
      default:
        if (id !== undefined) respondError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined)
      respond(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
  }
}
