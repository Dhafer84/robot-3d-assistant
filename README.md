# 🤖 Robot 3D Assistant

Un assistant vocal en 3D qui **t'écoute, te répond et imite tes mouvements** grâce à ta webcam.

- 🧍 **Avatar 3D** (Three.js) : un personnage animé ou un robot en cubes, au choix
- 👀 **Suivi webcam** (MediaPipe) : l'avatar tourne la tête comme toi et lève les bras quand tu lèves les mains
- 🎙️ **Voix** : tu parles, il répond à voix haute
- 🧠 **IA** : les réponses viennent de [Groq](https://groq.com)

## Modes

| Mode | Ce qu'il fait |
|------|---------------|
| 🤖 **Assistant** | Pose une question à voix haute, l'IA répond et l'avatar la lit |
| 🪞 **Miroir** | L'avatar répète ce que tu dis et amplifie tes mouvements de tête |

## Installation

Prérequis : [Node.js](https://nodejs.org) 20 ou plus, et **Chrome** ou **Edge** (pour la reconnaissance vocale).

```bash
git clone https://github.com/Dhafer84/robot-3d-assistant.git
cd robot-3d-assistant/backend
npm install
cp .env.example .env
```

Ouvre `backend/.env` et colle ta clé Groq (gratuite sur [console.groq.com/keys](https://console.groq.com/keys)).

## Lancement

```bash
npm start
```

Puis ouvre [http://localhost:3000](http://localhost:3000), autorise la webcam et le micro, et clique sur **🎙️ Activer écoute auto**.

Sur macOS, tu peux aussi utiliser `./start_robot.sh` (lance le serveur en arrière-plan et ouvre le navigateur) et `./stop_robot.sh`.

## Configuration (`backend/.env`)

| Variable | Défaut | Rôle |
|----------|--------|------|
| `GROQ_API_KEY` | — | Clé API Groq (obligatoire) |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Modèle utilisé pour les réponses |
| `PORT` | `3000` | Port du serveur |

## Structure

```
backend/
  server.js        Serveur Express : sert le frontend + route POST /api/chat vers Groq
frontend/
  index.html       Interface
  js/main.js       Point d'entrée : relie tous les modules
  js/scene.js      Scène Three.js (caméra, lumières, rendu)
  js/avatars.js    Robot en cubes et humanoïde GLB
  js/tracking.js   Webcam + MediaPipe (visage et pose)
  js/voice.js      Reconnaissance vocale, appel à l'IA, synthèse vocale
  js/state.js      État partagé entre les modules
  models/          Modèle 3D de l'humanoïde
```

## Technologies

[Three.js](https://threejs.org) · [MediaPipe](https://developers.google.com/mediapipe) · Web Speech API · [Express](https://expressjs.com) · [Groq](https://groq.com)
