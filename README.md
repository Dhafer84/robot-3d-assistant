# 🤖 Robot 3D Assistant

Un assistant vocal en 3D qui **t'écoute, te répond et imite tes mouvements** grâce à ta webcam.

- 🧑‍💼 **Avatar 3D** (Three.js) : un personnage riggé avec des yeux animés dans ses lunettes, des animations (repos, parole, salut) et des **émotions** (joie, réflexion, surprise, désolé) choisies par l'IA à chaque réponse
- 👀 **Suivi webcam** (MediaPipe) : l'avatar te regarde, tourne la tête comme toi et lève les bras quand tu lèves les mains
- 🎙️ **Voix ou clavier** : tu parles ou tu écris, il répond à voix haute avec une **voix naturelle** ([Piper](https://github.com/OHF-Voice/piper1-gpl), français et anglais), phrase par phrase dès que la réponse arrive ; sa bouche suit le volume réel de la voix
- 🧠 **IA** : réponses de [Groq](https://groq.com) en streaming, avec mémoire de la conversation
- 📇 **Fiche de profil** : l'assistant présente Dhafer, son portfolio et Quality Crew à partir de `backend/profile.md`, sans rien inventer

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

## Voix naturelle (facultatif)

Sans installation supplémentaire, l'assistant utilise la voix du navigateur. Pour la voix naturelle Piper (gratuite, calculée sur le serveur), voir [tts/README.md](tts/README.md) : un environnement Python et un modèle vocal à télécharger. Le serveur Node lance alors automatiquement le serveur de voix.

## Personnaliser l'assistant

Remplis `backend/profile.md` (parcours, projets, Quality Crew, contact). C'est la seule source d'information de l'assistant sur Dhafer : ce qui n'y figure pas, il répond qu'il ne le sait pas. Le fichier est relu à chaque question, pas besoin de redémarrer le serveur.

Le ton et les règles de réponse (langue, longueur, pas d'emojis car tout est lu à voix haute…) sont dans la constante `PERSONA` de `backend/server.js`.

## Configuration (`backend/.env`)

| Variable | Défaut | Rôle |
|----------|--------|------|
| `GROQ_API_KEY` | — | Clé API Groq (obligatoire) |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Modèle utilisé pour les réponses |
| `PORT` | `3000` | Port du serveur |
| `TTS_VOICE_FR` | `fr_FR-upmc-medium:1` | Voix Piper française (`modele` ou `modele:locuteur`) |
| `TTS_VOICE_EN` | `en_US-ryan-high` | Voix Piper anglaise |
| `TTS_SPEED` | `1.0` | Vitesse de la voix |

## Structure

```
backend/
  server.js        Serveur Express : sert le frontend + POST /api/chat (historique → réponse en streaming)
  profile.md       Fiche de profil lue par l'assistant
tts/
  server.py        Serveur de voix Piper (lancé par server.js), POST /synthesize → WAV
frontend/
  index.html       Interface
  js/main.js       Point d'entrée : relie tous les modules
  js/scene.js      Scène Three.js (caméra, lumières, rendu)
  js/avatars.js    Chargement et animation de l'avatar GLB (squelette Mixamo)
  js/face.js       Yeux dessinés dans les verres, émotions, lip-sync
  js/tracking.js   Webcam + MediaPipe (visage et pose)
  js/chat.js       Conversation : historique, fil de discussion, streaming
  js/voice.js      Reconnaissance vocale ; lecture des phrases (Piper ou voix du navigateur)
  js/state.js      État partagé entre les modules
  models/          Modèle 3D de l'avatar (avatar.glb)
assets/
  reference/       Images de référence de l'avatar
  blender/         Scripts Blender qui fabriquent avatar.glb (voir ci-dessous)
```

## Fabriquer l'avatar

`frontend/models/avatar.glb` est produit par des scripts Blender (`assets/blender/`), à partir du modèle 3D généré (TRELLIS.2) et des fichiers Mixamo (personnage riggé + animations « Breathing Idle », « Talking », « Waving ») :

1. `prep_avatar.py` : mise à l'échelle et allègement du modèle brut → FBX à envoyer sur Mixamo
2. `assemble_avatar.py` : personnage riggé + animations → `avatar_02_rig.blend`
3. `face_rig.py` : fente de bouche, shape keys `MouthOpen`/`MouthSmile`, écrans dans les verres → `avatar_03_face.blend`
4. `export_avatar.py` : export GLB compressé (Draco) vers `frontend/models/avatar.glb`

```bash
blender -b assets/blender/avatar_03_face.blend -P assets/blender/export_avatar.py -- .
```

## Technologies

[Three.js](https://threejs.org) · [MediaPipe](https://developers.google.com/mediapipe) · Web Speech API · Web Audio · [Express](https://expressjs.com) · [Groq](https://groq.com) · [Piper](https://github.com/OHF-Voice/piper1-gpl)
