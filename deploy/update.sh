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
echo "✅ À jour. La voix Piper sera prête dans ~40 s."
