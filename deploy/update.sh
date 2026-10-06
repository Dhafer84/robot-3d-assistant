#!/bin/bash
# Met à jour l'assistant sur le VPS avec la dernière version de la branche main.
#   ~/apps/robot-3d-assistant/deploy/update.sh
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "📥 Récupération de la dernière version…"
git pull --ff-only

echo "📦 Dépendances Node…"
(cd backend && npm ci --omit=dev --silent)

echo "🧪 Tests…"
# set -e : si un test échoue, on s'arrête AVANT le redémarrage — l'ancienne version
# continue de tourner.
(cd backend && npm test --silent)

echo "🔊 Dépendances de la voix…"
tts/.venv/bin/pip install -q -r tts/requirements.txt

echo "🔄 Redémarrage du service…"
sudo systemctl restart robot3d
sleep 2
systemctl --no-pager --lines=5 status robot3d

echo "🩺 Contrôle de santé dans 45 s (le temps que la voix Piper démarre)…"
sleep 45
# Interrogé une seule fois : le résultat est gardé une minute par le serveur
health=$(curl -s --max-time 15 http://127.0.0.1:3000/api/health || echo '{"status":"injoignable"}')
echo "   $health"
case "$health" in
  *'"status":"ok"'*) echo "✅ À jour, IA et voix en service." ;;
  *'"status":"degrade"'*) echo "⚠️  À jour, mais la voix ne répond pas encore : journalctl -u robot3d -n 30" ;;
  *) echo "❌ L'assistant est en panne : journalctl -u robot3d -n 30"; exit 1 ;;
esac
