#!/bin/bash
# Напоминание о QA daily report: если репорта за сегодня нет —
# сразу открывает Terminal с opencode и командой /daily-report (без кликов).
# Запускается launchd по будням в 17:30.

export QA_PORTAL_TOKEN="qgp_2p4LF6EXOiQD639r92RMgZJVDZ-RFkgxKzQ2jjsKgBU"
NODE="/opt/homebrew/bin/node"
SCRIPT="$HOME/.config/opencode/mcp/qa-portal-daily.mjs"

# Проверяем наличие репорта. Коды: 0 = нет, 1 = уже есть, 2 = ошибка проверки.
# Молча выходим ТОЛЬКО если репорт точно есть (1). При ошибке (2) — лучше лишнее
# напоминание, чем пропуск, поэтому открываем терминал (fail-open).
"$NODE" "$SCRIPT" --check
CHECK=$?
[ "$CHECK" -eq 1 ] && exit 0

/usr/bin/osascript <<'EOF'
tell application "Terminal"
  activate
  do script "opencode --prompt \"/daily-report\""
end tell
EOF
