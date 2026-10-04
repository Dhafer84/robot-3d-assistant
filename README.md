# 🤖 Robot 3D Assistant

Un assistant vocal en 3D qui **t'écoute, te répond et imite tes mouvements** grâce à ta webcam.

- 🧑‍💼 **Avatar 3D** (Three.js) : un personnage riggé avec des yeux animés dans ses lunettes, des animations (repos, parole, salut) et des **émotions** (joie, réflexion, surprise, désolé) choisies par l'IA à chaque réponse
- 👀 **Suivi webcam à la demande** (MediaPipe) : l'avatar te regarde ; si tu actives le suivi, il tourne la tête comme toi et lève les bras quand tu lèves les mains (tout est calculé dans ton navigateur, rien n'est envoyé)
- 🎙️ **Voix ou clavier** : tu parles ou tu écris, il répond à voix haute avec une **voix naturelle** ([Piper](https://github.com/OHF-Voice/piper1-gpl), français et anglais), phrase par phrase dès que la réponse arrive ; sa bouche suit le volume réel de la voix
- 🧠 **IA** : réponses de [Groq](https://groq.com) en streaming, avec mémoire de la conversation
- 🧩 **Intégrable sur n'importe quel site** : une ligne de code ajoute une bulle d'assistant en bas de page
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

Puis ouvre [http://localhost:3000](http://localhost:3000) : écris ta question, ou clique sur **🎙️ Activer écoute auto** pour parler (et **📷 Activer le suivi** pour que l'avatar imite tes mouvements).

Sur macOS, tu peux aussi utiliser `./start_robot.sh` (lance le serveur en arrière-plan et ouvre le navigateur) et `./stop_robot.sh`.

## Sécurité

Les en-têtes sont posés par l'application elle-même (`backend/security.js`), sur toute réponse :

- **Aucun script tiers** : Three.js, le décodeur Draco et MediaPipe sont installés par npm en versions figées et servis par ce serveur (`/vendor/…`). Seuls les dossiers utiles sont exposés.
- **CSP stricte** sur les pages : `'self'` uniquement, scripts en ligne autorisés par empreinte (calculée sur `index.html`), jamais `'unsafe-inline'` ni `eval` pour les scripts.
- **Suivi webcam isolé** : MediaPipe a besoin d'`eval` ; il tourne donc dans une page à part (`tracking.html`), chargée dans une iframe seulement quand le visiteur active le suivi. Elle seule reçoit `'unsafe-eval'`, n'affiche aucun texte et ne transmet que des nombres.
- **Intégration limitée** : seuls l'assistant lui-même et les sites de `FRAME_ANCESTORS` (par défaut qualitycrew.fr) peuvent l'afficher dans une bulle.
- HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (micro et caméra pour l'assistant seul), limite de requêtes par visiteur, serveur en écoute locale derrière Nginx.

## Mise en ligne

Le guide pas à pas pour le VPS (Nginx, HTTPS, démarrage automatique, mises à jour) est dans [deploy/README.md](deploy/README.md).

## Intégrer l'assistant sur un site

Ajoute cette ligne avant `</body>` sur le site hôte (en remplaçant l'adresse par celle où l'assistant est hébergé) :

```html
<script src="https://assistant.qualitycrew.fr/embed.js" defer></script>
```

Un bouton rond avec l'avatar apparaît en bas à droite ; au clic, l'assistant s'ouvre dans une bulle (en plein écran sur mobile). Il n'est chargé qu'au premier clic, pour ne pas ralentir le site, et se tait quand on ferme la bulle. Options : `data-position="left"` pour le placer à gauche, `data-label="…"` pour changer l'infobulle. Démo locale : [http://localhost:3000/demo-integration.html](http://localhost:3000/demo-integration.html).

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
| `FRAME_ANCESTORS` | `https://qualitycrew.fr https://www.qualitycrew.fr` | Sites autorisés à afficher l'assistant dans une bulle |
| `HOST` | `127.0.0.1` | Adresse d'écoute (`0.0.0.0` pour l'ouvrir sur le réseau local) |
| `CHAT_LIMIT_PER_MINUTE` | `10` | Questions par minute et par visiteur (protège le quota Groq) |
| `TTS_LIMIT_PER_MINUTE` | `60` | Phrases lues par minute et par visiteur |
| `TTS_VOICE_FR` | `fr_FR-tom-medium` | Voix Piper française (`modele` ou `modele:locuteur`) |
| `TTS_VOICE_EN` | `en_US-ryan-high` | Voix Piper anglaise |
| `TTS_SPEED` | `1.0` | Vitesse de la voix |

## Structure

```
backend/
  server.js        Serveur Express : sert le frontend + POST /api/chat (historique → réponse en streaming)
  security.js      En-têtes de sécurité (CSP…) et bibliothèques servies localement (/vendor)
  profile.md       Fiche de profil lue par l'assistant
tts/
  server.py        Serveur de voix Piper (lancé par server.js), POST /synthesize → WAV
frontend/
  index.html       Interface (?embed : version compacte pour la bulle)
  embed.js         Script d'intégration sur un autre site (bouton + bulle)
  demo-integration.html  Page de démonstration de la bulle
  js/main.js       Point d'entrée : relie tous les modules
  js/scene.js      Scène Three.js (caméra, lumières, rendu)
  js/avatars.js    Chargement et animation de l'avatar GLB (squelette Mixamo)
  js/face.js       Yeux dessinés dans les verres, émotions, lip-sync
  js/tracking.js   Suivi webcam à la demande (pilote l'iframe tracking.html)
  tracking.html    Page isolée du suivi webcam (MediaPipe) + js/tracking-frame.js
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
