#!/usr/bin/env bash
# Auslieferung beim Zug nach „Erledigt“ (Betreiber 2026-10-31): kanbanD aus main installieren und die Board-Instanz,
# auf der der Betreiber die neuen Features sieht, neu starten. Schlägt die Installation fehl, bleibt die alte Instanz
# laufen (Exit ≠ 0, der Ablauf legt die Karte zum Menschen). Aufruf nach dem Ablauf in AI-Team/factory.md.
# Beendet wird jede Instanz, die den Board-Ordner bedient — auch eine, die die Skripte der Factory gestartet haben
# (werkzeuge/instanzen.py); nie laufen zwei Instanzen auf demselben Ordner.
set -euo pipefail
PROJEKT=/home/shoff/Projekte/kanbanD
ORDNER=/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard
PORT=7422
PIDDATEI=$PROJEKT/.claude/factory/board.pid
LOG=$PROJEKT/.claude/factory/board.log

cargo install --path "$PROJEKT" --locked --quiet

alt=$(cat "$PIDDATEI" 2>/dev/null || true)
if [ -n "$alt" ] && kill -0 "$alt" 2>/dev/null; then
  kill "$alt"
  for _ in $(seq 50); do kill -0 "$alt" 2>/dev/null || break; sleep 0.2; done
fi
for p in $(pgrep -f "[k]anbanD $ORDNER( |\$)" || true); do
  kill "$p" 2>/dev/null || true
  for _ in $(seq 50); do kill -0 "$p" 2>/dev/null || break; sleep 0.2; done
done
setsid nohup "$HOME/.cargo/bin/kanbanD" "$ORDNER" --port "$PORT" --kein-browser >> "$LOG" 2>&1 < /dev/null &
echo $! > "$PIDDATEI"

for _ in $(seq 50); do
  if curl -fsS "http://127.0.0.1:$PORT/api/zustand" > /dev/null 2>&1; then
    echo "kanbanD $(git -C "$PROJEKT" rev-parse --short HEAD) läuft auf :$PORT (PID $(cat "$PIDDATEI"))"
    exit 0
  fi
  sleep 0.2
done
echo "Board antwortet nicht auf :$PORT (PID $(cat "$PIDDATEI"))" >&2
exit 1
