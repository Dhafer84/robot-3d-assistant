#!/bin/bash

echo "🛑 Arrêt du Robot 3D Assistant..."

# === Chemins (à adapter si besoin) ===
BACKEND_DIR="$HOME/Documents/robot-3d-assistant/backend"
FRONTEND_DIR="$HOME/Documents/robot-3d-assistant/frontend"

# --- Arrêt du backend (node server.js) ---
echo "🔻 Recherche du backend (node server.js)..."
BACKEND_PIDS=$(pgrep -f "node server.js")

if [ -n "$BACKEND_PIDS" ]; then
  echo "   → Backend trouvé (PID(s): $BACKEND_PIDS). Arrêt..."
  kill $BACKEND_PIDS
else
  echo "   → Aucun backend node server.js en cours."
fi

# --- Arrêt du frontend (live-server sur port 5500) ---
echo "🔻 Recherche du frontend (live-server)..."
FRONTEND_PIDS=$(pgrep -f "live-server")

if [ -n "$FRONTEND_PIDS" ]; then
  echo "   → Frontend trouvé (PID(s): $FRONTEND_PIDS). Arrêt..."
  kill $FRONTEND_PIDS
else
  echo "   → Aucun live-server en cours."
fi

echo "✅ Tout est arrêté (dans la limite de ce que j'ai trouvé)."
