#!/usr/bin/env node
// Автозаполнение QA Portal daily report за сегодня.
// Режимы: --check (exit 0 = репорта нет, 1 = уже есть, 2 = ошибка проверки), --fill (создать по шаблону).
// Задачи за день берутся из /work-logs/jira-activity.

const BASE = "https://qa-quality-guard.int.wnf.rocks";
const TOKEN = process.env.QA_PORTAL_TOKEN;

if (!TOKEN) {
  console.error("QA_PORTAL_TOKEN не задан");
  process.exit(1);
}

const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD в локальной таймзоне
const mode = process.argv[2];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, method = "GET", body) {
  // После выхода из сна сеть встаёт не сразу — ретраим сетевые сбои (fetch failed).
  let lastErr;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
      return text ? JSON.parse(text) : null;
    } catch (e) {
      lastErr = e;
      // Ретраим только сетевые сбои, не ошибки ответа сервера (4xx/5xx).
      const retriable = e instanceof TypeError || /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(e.message);
      if (!retriable || attempt === 6) throw e;
      await sleep(attempt * 5000); // 5s, 10s, 15s, 20s, 25s — ждём, пока поднимется сеть
    }
  }
  throw lastErr;
}

async function getReport() {
  const page = await api(`/work-logs?from=${today}&to=${today}&page=0&size=10&sort=entryDate,DESC`);
  return (page.content ?? page).find((r) => r.entryDate === today) ?? null;
}

try {
  if (mode === "--check") {
    try {
      process.exit((await getReport()) ? 1 : 0);
    } catch (e) {
      console.error(`Ошибка проверки: ${e.message}`);
      process.exit(2); // не смогли проверить — не путаем с «репорт есть»
    }
  }

  if (mode === "--fill") {
    if (await getReport()) {
      console.log(`Репорт за ${today} уже заполнен — не трогаю`);
      process.exit(0);
    }

    const activity = await api(`/work-logs/jira-activity?date=${today}`);
    const keys = [...new Set((activity ?? []).map((a) => a.key))];
    if (!keys.length) {
      console.log(`За ${today} нет Jira-активности — заполните вручную`);
      process.exit(3);
    }

    const summary = `Занимался задачами из спринта ${keys.join(", ")}.`;
    await api("/work-logs", "POST", {
      entryDate: today,
      answers: [{ questionId: 1, value: summary }], // 1 = Daily Summary
      tasks: [{ task: `Задачи спринта: ${keys.join(", ")}`, timeSpent: "5m" }],
      reportTime: "5m",
    });
    console.log(`Репорт за ${today} заполнен: ${summary}`);
    process.exit(0);
  }

  console.error("Использование: qa-portal-daily.mjs --check | --fill");
  process.exit(1);
} catch (e) {
  console.error(`Ошибка: ${e.message}`);
  process.exit(1);
}
