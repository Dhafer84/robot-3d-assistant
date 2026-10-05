# Mise en ligne sur le VPS (assistant.qualitycrew.fr)

Guide pour le VPS OVH (Ubuntu 24.04, Nginx déjà en place pour qualitycrew.fr).
Toutes les commandes se lancent **sur le VPS** (connecté en SSH avec l'utilisateur `dhafer`),
sauf mention contraire.

Architecture une fois en ligne :

```
Visiteur ──HTTPS──▶ Nginx (443) ──▶ Node 127.0.0.1:3000 ──▶ Groq (IA)
                                        └──▶ Piper 127.0.0.1:5005 (voix)
```

Node et Piper n'écoutent qu'en local : seul Nginx est exposé.

---

## 1. DNS : créer le sous-domaine (espace client OVH)

OVH Manager → **Noms de domaine** → `qualitycrew.fr` → **Zone DNS** → **Ajouter une entrée** :

| Type | Sous-domaine | Cible |
|------|--------------|-------|
| A | `assistant` | `57.131.46.92` (la même IP que qualitycrew.fr) |

La propagation prend de quelques minutes à quelques heures. Vérification (depuis le Mac ou le VPS) :

```bash
dig +short assistant.qualitycrew.fr
```

→ doit afficher `57.131.46.92`.

## 2. Récupérer le code

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/Dhafer84/robot-3d-assistant.git
cd robot-3d-assistant/backend
npm ci --omit=dev
```

## 3. Configurer la clé Groq

```bash
cp .env.example .env
nano .env
```

Colle ta clé Groq à la place de `ta_cle_groq_ici` (Ctrl+O pour enregistrer, Ctrl+X pour quitter), puis protège le fichier :

```bash
chmod 600 .env
```

## 4. Installer la voix (Piper)

```bash
sudo apt install -y python3-venv
cd ~/apps/robot-3d-assistant/tts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m piper.download_voices --data-dir voices fr_FR-tom-medium en_US-ryan-high
```

## 5. Premier test, à la main

```bash
cd ~/apps/robot-3d-assistant/backend
node server.js
```

Attends le message `🔊 Voix prêtes …` (~40 s), puis dans un **deuxième terminal SSH** :

```bash
curl -s -XPOST localhost:3000/api/tts -H 'Content-Type: application/json' -d '{"text":"Bonjour"}' -o /dev/null -w "%{http_code}\n"
```

→ `200`. Reviens au premier terminal et arrête avec **Ctrl+C**.

## 6. Démarrage automatique (systemd)

```bash
sudo cp ~/apps/robot-3d-assistant/deploy/robot3d.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now robot3d
systemctl status robot3d --no-pager
```

Le service redémarre tout seul en cas de plantage et au redémarrage du VPS.
Pour voir les journaux en direct : `journalctl -u robot3d -f` (Ctrl+C pour quitter).

## 7. Nginx

```bash
sudo cp ~/apps/robot-3d-assistant/deploy/nginx-assistant.qualitycrew.fr.conf /etc/nginx/sites-available/assistant.qualitycrew.fr
sudo ln -s /etc/nginx/sites-available/assistant.qualitycrew.fr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` doit répondre `syntax is ok` / `test is successful` avant le rechargement.

## 8. HTTPS (Let's Encrypt)

Une fois le DNS de l'étape 1 propagé :

```bash
which certbot || sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d assistant.qualitycrew.fr
```

Accepte la redirection HTTP → HTTPS si certbot la propose. Le renouvellement est automatique.

Ouvre https://assistant.qualitycrew.fr : l'avatar doit apparaître, répondre et parler.

## 9. Ajouter la bulle sur qualitycrew.fr

### 9a. Le script

Dans le gabarit HTML commun de qualitycrew.fr, juste avant `</body>` :

```html
<script src="https://assistant.qualitycrew.fr/embed.js" defer></script>
```

### 9b. Autoriser l'assistant dans les en-têtes de sécurité de qualitycrew.fr

qualitycrew.fr envoie une politique de sécurité stricte qui, telle quelle, **bloque la bulle**
(script, iframe et image venant d'un autre domaine, micro et caméra interdits).
Trouve où ces en-têtes sont définis (Nginx ou l'application Python) :

```bash
sudo grep -rn -i "permissions-policy\|content-security-policy" /etc/nginx/ ~/ --include=*.conf --include=*.py 2>/dev/null | grep -v robot-3d-assistant
```

Puis modifie-les ainsi (seuls les ajouts sont à faire, le reste ne change pas) :

**Content-Security-Policy** — ajoute `https://assistant.qualitycrew.fr` à `script-src` et `img-src`, et ajoute une directive `frame-src` :

```
script-src 'self' https://assistant.qualitycrew.fr https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js 'sha256-…' 'sha256-…';
img-src 'self' data: https://assistant.qualitycrew.fr;
frame-src https://assistant.qualitycrew.fr;
```

**Permissions-Policy** — autorise micro et caméra pour l'assistant uniquement :

```
camera=("https://assistant.qualitycrew.fr"), microphone=("https://assistant.qualitycrew.fr"), geolocation=(), payment=(), usb=()
```

Recharge ensuite Nginx (`sudo nginx -t && sudo systemctl reload nginx`) ou redémarre l'application Python selon l'endroit modifié.

Vérification :

```bash
curl -s -D - -o /dev/null https://www.qualitycrew.fr/ | grep -iE "content-security|permissions-policy"
```

## 10. Mettre à jour plus tard

Après un `git push` sur `main` depuis le Mac :

```bash
~/apps/robot-3d-assistant/deploy/update.sh
```

## Consulter les statistiques

```bash
cd ~/apps/robot-3d-assistant/backend && npm run stats
```

`npm run stats -- 7` pour 7 jours, `npm run stats -- 90 --toutes` pour toutes les questions
sans réponse. Les données restent sur le VPS (`backend/data/stats/`, hors Git, effacées
au bout de 90 jours).

## En cas de problème

| Symptôme | Vérification |
|----------|--------------|
| Page inaccessible | `systemctl status robot3d` puis `journalctl -u robot3d -n 50` |
| L'avatar ne répond pas | clé Groq dans `backend/.env`, puis `journalctl -u robot3d -n 50` |
| Voix du navigateur au lieu de Piper | attendre ~40 s après un redémarrage ; sinon `journalctl -u robot3d \| grep -i voix` |
| Bulle absente sur qualitycrew.fr | console du navigateur (F12) : message « Content Security Policy » → étape 9b |
| Micro refusé dans la bulle | en-tête `Permissions-Policy` de qualitycrew.fr → étape 9b |
