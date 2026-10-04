#!/bin/bash
# Lance le Robot 3D Assistant (un seul serveur : frontend + API) et ouvre le navigateur.

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
PID_FILE="$ROOT_DIR/.robot.pid"
LOG_FILE="$BACKEND_DIR/backend.log"

# Charge le PATH de l'utilisateur (node, npm) quand le script est lancé depuis Robot3D.app
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "🚀 Lancement du Robot 3D Assistant..."

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "   → Déjà lancé (PID: $(cat "$PID_FILE"))."
else
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "⚠️  backend/.env manquant : copie backend/.env.example et ajoute ta clé Groq."
    exit 1
  fi

  cd "$BACKEND_DIR"
  npm install --silent
  nohup node server.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "   → Serveur lancé (PID: $(cat "$PID_FILE")), logs : $LOG_FILE"
  sleep 1
fi

PORT=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)
URL="http://localhost:${PORT:-3000}"

echo "👉 $URL"
open "$URL"
