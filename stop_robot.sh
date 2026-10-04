#!/bin/bash
# Arrête le serveur lancé par start_robot.sh.

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/.robot.pid"

echo "🛑 Arrêt du Robot 3D Assistant..."

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")"
  echo "   → Serveur arrêté (PID: $(cat "$PID_FILE"))."
else
  echo "   → Aucun serveur en cours."
fi

rm -f "$PID_FILE"
