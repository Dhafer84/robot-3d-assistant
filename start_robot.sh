#!/bin/bash

echo "🚀 Lancement du projet Robot 3D Assistant..."

# === CONFIGURE TES CHEMINS ICI ===
BACKEND_DIR="$HOME/Documents/robot-3d-assistant/backend"
FRONTEND_DIR="$HOME/Documents/robot-3d-assistant/frontend"

# ================================
# Lancer le Backend
# ================================
echo "📡 Démarrage du backend..."
cd "$BACKEND_DIR"
npm install --silent
NODE_ENV=production nohup node server.js > backend.log 2>&1 &
BACKEND_PID=$!

echo "   → Backend lancé (PID: $BACKEND_PID)"
echo "   → Logs: $BACKEND_DIR/backend.log"

# ================================
# Lancer le Frontend
# ================================
echo "🌐 Démarrage du frontend..."

cd "$FRONTEND_DIR"
npm install --silent

# Vérifier si live-server est installé
if ! command -v live-server &> /dev/null
then
    echo "⚠️  live-server n'est pas installé. Installation globale..."
    npm install -g live-server
fi

nohup live-server --port=5500 --quiet > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "   → Frontend lancé (PID: $FRONTEND_PID)"
echo "   → Logs: $FRONTEND_DIR/frontend.log"

echo ""
echo "🌟 Projet lancé avec succès !"
echo "👉 Ouvre ton navigateur : http://localhost:5500"
echo ""
