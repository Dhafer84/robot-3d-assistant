// server.js — sert le frontend et relaie la conversation vers l'IA Groq (réponse en streaming).

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const dotenv = require("dotenv");
const { serveVendor, securityHeaders, parseOrigins } = require("./security");
const stats = require("./stats");

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const PORT = Number(process.env.PORT) || 3000;
// Écoute en local uniquement par défaut : en production, c'est Nginx qui reçoit les visiteurs
const HOST = process.env.HOST || "127.0.0.1";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Fiche du modèle : répond sans consommer de quota (sert au contrôle de santé)
const GROQ_MODEL_URL = `https://api.groq.com/openai/v1/models/${GROQ_MODEL}`;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
// Sites autorisés à afficher l'assistant dans une bulle (embed.js), en plus de lui-même
const FRAME_ANCESTORS = parseOrigins(
  process.env.FRAME_ANCESTORS ?? "https://qualitycrew.fr https://www.qualitycrew.fr"
);
const PROFILE_PATH = path.join(__dirname, "profile.md");

// Synthèse vocale Piper (tts/server.py), lancée par ce serveur si elle est installée
const TTS_DIR = path.join(__dirname, "..", "tts");
const TTS_PYTHON = path.join(TTS_DIR, ".venv", "bin", "python");
const TTS_PORT = Number(process.env.TTS_PORT) || 5005;
const TTS_URL = `http://127.0.0.1:${TTS_PORT}`;
const MAX_TTS_LENGTH = 600;

// Limites par visiteur (adresse IP), pour protéger le quota Groq gratuit
const CHAT_LIMIT_PER_MINUTE = Number(process.env.CHAT_LIMIT_PER_MINUTE) || 10;
const TTS_LIMIT_PER_MINUTE = Number(process.env.TTS_LIMIT_PER_MINUTE) || 60;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY = 10; // messages (questions + réponses) envoyés à l'IA

// Limite de débit : nombre d'essais et attente maximale (s) faite en silence par le serveur
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_SILENT_WAIT = 8;

// Le compte Groq gratuit est limité en tokens par minute : on n'envoie que les parties
// de la fiche utiles à la question. Ces sections sont toujours jointes…
const ALWAYS_SECTIONS = ["Dhafer", "Contact", "Consignes"];
// …les autres seulement si la question (ou la précédente) contient un de ces mots-clés.
const SECTION_KEYWORDS = {
  Parcours: /exp[ée]rien|parcours|carri[èe]re|poste|travail|emploi|job|actia|cipi|volvo|scania|continental|jaguar|entreprise|r[ôo]le|manag|team|[ée]quipe|usine|ann[ée]e|work|career|company/,
  "Compétences": /comp[ée]ten|sait|ma[îi]tris|skill|technolog|norme|iso|iatf|python|power ?bi|fmea|amdec|misra|ldra|coverity|kubernetes|cloud|devops/,
  Formation: /formation|dipl[ôo]m|[ée]tud|[ée]cole|ing[ée]nieur|certif|esprit|iset|universit|degree|study|educat/,
  "Quality Crew": /quality ?crew|site|outil|d[ée]mo|agent|\bia\b|\bai\b|intelligen|llm|crewai|github|tool|projet|project/,
  // Une section par outil : son détail (fonctionnement, rôle exact de l'IA) n'est envoyé que
  // s'il est question de lui — sinon la fiche coûterait trop de tokens à chaque question.
  "Outil QualityCrew": /qualitycrew|\baudit|agents?\b|crewai/,
  "Outil SentinelScan": /sentinel|fuite|leak|github|secret|27001/,
  "Outil SafetyScope": /safety ?scope|\bhara\b|asil|redout|hazard/,
  "Outil ThreatScope": /threat ?scope|\btara\b|menace|threat|cyber|21434|r155|stride/,
  "Outil RegWatch": /reg ?watch|veille|signal|r[ée]glement|regulat/,
  "Outil CauseTrace": /cause ?trace|\b8d\b|ishikawa|pourquoi|r[ée]clamation|cause racine|root cause/,
  "Autres projets": /projet|portfolio|robot|avatar|3d|assistant|qui es|who are|toi-m[êe]me|comment (tu )?(es|as)|project/,
};

const PERSONA = `Tu es l'assistant personnel de Dhafer Bouthelja. Tu apparais sous la forme d'un avatar 3D à son image, sur son portfolio et sur le site Quality Crew, et tu parles aux visiteurs à voix haute.

Style :
- Réponds toujours dans la langue du dernier message du visiteur : en anglais s'il écrit en anglais, en arabe s'il écrit en arabe, en français sinon. Ton chaleureux et professionnel.
- Sois bref : 1 à 3 phrases courtes, 4 au maximum si la question le demande vraiment.
- Tes réponses sont lues à voix haute : pas de markdown, pas de listes, pas d'emojis, pas d'URL à rallonge (dis plutôt "sur son site" ou "sur LinkedIn").
- Ne te présentes que si on te salue ou si on te demande qui tu es.
- Commence TOUJOURS ta réponse par une seule balise d'émotion, choisie parmi : <joie>, <reflexion>, <surprise>, <desole>, <neutre>. Exemple : "<joie> Avec plaisir ! …". Elle n'est pas lue à voix haute : elle règle l'expression de ton avatar. <joie> pour un salut ou une bonne nouvelle, <reflexion> pour une explication technique, <surprise> pour une question inattendue, <desole> quand tu ne sais pas ou refuses, <neutre> sinon.

Faits :
- Tout ce que tu sais sur Dhafer, ses projets et Quality Crew vient de la fiche de profil ci-dessous. N'invente jamais d'information (expérience, client, tarif, chiffre, date) qui n'y figure pas.
- Les lignes entre crochets [ ... ] sont des champs non remplis : ignore-les.
- Seuls les extraits de la fiche utiles à la question te sont fournis. Si l'information demandée n'y est pas, dis simplement que tu ne la connais pas et propose de contacter Dhafer.
- Ne conclus jamais qu'une chose n'existe pas (« aucune IA », « pas de fonction ») si la fiche ne le dit pas explicitement : dans le doute, dis que tu ne sais pas précisément.
- Reste cohérent avec tes réponses précédentes ; si l'une d'elles contredit la fiche, corrige-toi franchement.
- Pour utiliser un outil, résume ce que dit la fiche et invite à l'essayer sur qualitycrew.fr ; n'invente jamais de boutons ni d'étapes d'interface.
- Pour des questions générales (technologie, qualité logicielle, tests…), tu peux répondre avec tes connaissances, brièvement.`;

// La fiche est relue à chaque question : on peut la modifier sans redémarrer le serveur.
// Elle est découpée en sections "## Titre" ; l'en-tête (avant la première section) est
// une note pour l'humain qui la remplit et n'est pas envoyé.
function readProfileSections() {
  let profile = "";
  try {
    profile = fs.readFileSync(PROFILE_PATH, "utf8");
  } catch {
    console.warn("⚠️  backend/profile.md introuvable : l'assistant n'a pas de fiche de profil.");
  }
  return profile
    .split(/\n(?=## )/)
    .filter((part) => part.startsWith("## "))
    .map((text) => ({ title: text.slice(3, text.indexOf("\n")).trim(), text: text.trim() }));
}

function buildSystemPrompt(messages) {
  // Les deux dernières questions ET la dernière réponse de l'assistant : dans une question de
  // suivi (« et l'IA dans ce dernier ? »), c'est souvent sa réponse qui nomme l'outil.
  const lastAnswer = messages.filter((m) => m.role === "assistant").slice(-1);
  const recent = [...messages.filter((m) => m.role === "user").slice(-2), ...lastAnswer];
  const question = recent.map((m) => m.content).join(" ").toLowerCase();

  const sections = readProfileSections();
  const wanted = new Set(
    sections
      .filter(({ title }) => {
        if (ALWAYS_SECTIONS.some((name) => title.startsWith(name))) return true;
        const entry = Object.entries(SECTION_KEYWORDS).find(([name]) => title.startsWith(name));
        return entry ? entry[1].test(question) : true; // section inconnue : toujours jointe
      })
      .map((s) => s.title)
  );
  // Le détail d'un outil ne va pas sans la vue d'ensemble de Quality Crew (doctrine, IA par outil)
  if ([...wanted].some((t) => t.startsWith("Outil "))) {
    for (const s of sections) if (s.title.startsWith("Quality Crew")) wanted.add(s.title);
  }
  const selected = sections.filter((s) => wanted.has(s.title));

  return `${PERSONA}\n\n--- FICHE DE PROFIL (extraits utiles à la question) ---\n${selected.map((s) => s.text).join("\n\n")}`;
}

// Délai demandé par Groq, en secondes ("try again in 67.5ms", "11.4s" ou "1m2.5s")
function parseRetryDelay(details) {
  const match = details.match(/try again in (?:(\d+)m)?([\d.]+)(ms|s)/);
  if (!match) return 20;
  const minutes = Number(match[1] || 0);
  const value = Number(match[2]);
  return minutes * 60 + (match[3] === "ms" ? value / 1000 : value);
}

// Historique envoyé par le navigateur : [{ role: "user" | "assistant", content }, …]
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "La conversation est vide.";
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return "Message invalide.";
    if (typeof m.content !== "string" || !m.content.trim()) return "Message vide.";
    if (m.content.length > MAX_MESSAGE_LENGTH) return "Le message est trop long.";
  }
  if (messages[messages.length - 1].role !== "user") return "Le dernier message doit venir du visiteur.";
  return null;
}

if (!GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY n'est pas définie dans backend/.env (voir .env.example)");
}

// Limite simple en mémoire : au plus `max` requêtes par minute et par adresse IP.
// `name` sert aux statistiques (combien de fois la limite a été atteinte, sans l'IP).
function rateLimit(name, max, message) {
  const hits = new Map(); // ip -> instants (ms) des requêtes de la dernière minute
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [ip, times] of hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length) hits.set(ip, recent);
      else hits.delete(ip);
    }
  }, 60_000).unref();

  return (req, res, next) => {
    const now = Date.now();
    const times = (hits.get(req.ip) || []).filter((t) => t > now - 60_000);
    if (times.length >= max) {
      const retryAfter = Math.ceil((times[0] + 60_000 - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      stats.record("limit", { kind: name });
      return res.status(429).json({ error: message(retryAfter), retryAfter });
    }
    times.push(now);
    hits.set(req.ip, times);
    next();
  };
}

const app = express();
// Derrière Nginx (même machine), l'adresse du visiteur est dans X-Forwarded-For
app.set("trust proxy", "loopback");
app.disable("x-powered-by");
app.use(securityHeaders({ frontendDir: FRONTEND_DIR, frameAncestors: FRAME_ANCESTORS }));
app.use(express.json({ limit: "100kb" }));

// Statistiques : une vue par chargement de la page (bulle ou plein écran), robots exclus
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|headless/i;
app.use((req, res, next) => {
  if (req.method === "GET" && req.path === "/" && !BOTS.test(req.get("user-agent") || "")) {
    stats.record("view", { embed: "embed" in req.query });
  }
  next();
});

// Frontend (index.html, js/, models/…) servi sur la même origine que l'API
serveVendor(app); // Three.js, Draco, MediaPipe depuis node_modules (voir security.js)
app.use(
  express.static(FRONTEND_DIR, {
    // Nginx compresse le modèle 3D à la volée (sans Content-Length) : X-File-Size donne sa
    // taille au chargeur de Three.js, pour une barre de progression en pourcentage.
    setHeaders(res, filePath, stat) {
      if (filePath.endsWith(".glb")) res.setHeader("X-File-Size", String(stat.size));
    },
  })
);

// Statistiques d'une question terminée. Le texte n'est gardé que si l'assistant n'a pas su
// répondre (voir stats.js) ; `turn` = rang de la question dans la conversation (1 = nouvelle).
function recordQuestion(req, messages, answer) {
  const answered = !stats.isUnanswered(answer);
  stats.record("question", {
    embed: /[?&]embed\b/.test(req.get("referer") || ""),
    turn: messages.filter((m) => m.role === "user").length,
    emotion: stats.emotionOf(answer),
    answered,
    ...(answered ? {} : { q: stats.redact(messages[messages.length - 1].content) }),
  });
}

// Répond en texte brut, envoyé morceau par morceau au fil de la génération
const chatLimit = rateLimit(
  "visitor-chat",
  CHAT_LIMIT_PER_MINUTE,
  (s) => `Tu poses beaucoup de questions d'un coup ! Laisse-moi souffler ${s} secondes, s'il te plaît.`
);
const ttsLimit = rateLimit("visitor-tts", TTS_LIMIT_PER_MINUTE, () => "Trop de demandes de voix.");

app.post("/api/chat", chatLimit, async (req, res) => {
  const messages = req.body?.messages;
  const error = validateMessages(messages);
  if (error) return res.status(400).json({ error });
  if (!GROQ_API_KEY) return res.status(500).json({ error: "Clé API Groq manquante côté serveur." });

  // Si le visiteur coupe la parole (nouvelle question), on arrête la génération
  const upstream = new AbortController();
  res.on("close", () => upstream.abort());

  try {
    const body = JSON.stringify({
      model: GROQ_MODEL,
      stream: true,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: buildSystemPrompt(messages) },
        ...messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content: content.trim() })),
      ],
    });

    // Limite du compte gratuit (tokens par minute) : si Groq demande d'attendre peu de
    // temps, on patiente et on réessaie sans que le visiteur ne s'en aperçoive.
    let response;
    for (let attempt = 1; ; attempt++) {
      response = await fetch(GROQ_URL, {
        method: "POST",
        signal: upstream.signal,
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body,
      });
      if (response.status !== 429) break;

      const details = await response.text();
      const wait = parseRetryDelay(details);
      if (attempt < MAX_RATE_LIMIT_RETRIES && wait <= MAX_SILENT_WAIT) {
        await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 100));
        continue;
      }
      console.error("Limite Groq atteinte :", details);
      stats.record("limit", { kind: "groq" });
      const seconds = Math.max(1, Math.ceil(wait));
      return res.status(429).json({
        error: `Je reçois beaucoup de questions en ce moment. Repose-moi la tienne dans ${seconds} secondes, s'il te plaît.`,
        retryAfter: seconds,
      });
    }

    if (!response.ok) {
      console.error("Erreur HTTP Groq :", response.status, await response.text());
      stats.record("error", { status: response.status });
      return res.status(502).json({ error: "Erreur lors de l'appel à Groq." });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    // Flux SSE de Groq : lignes "data: {json}" ; on ne garde que le texte de la réponse
    // (delta.content), pas la réflexion interne du modèle (delta.reasoning).
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        const text = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
        if (text) {
          res.write(text);
          answer += text;
        }
      }
    }
    res.end();
    recordQuestion(req, messages, answer);
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Erreur API Groq :", err);
    stats.record("error", { status: "exception" }); // Groq injoignable, flux coupé…
    if (!res.headersSent) res.status(500).json({ error: "Erreur serveur." });
    else res.end();
  }
});

// Synthèse vocale : renvoie un WAV pour une phrase. En cas d'échec (Piper non installé
// ou encore en démarrage), le navigateur se rabat sur sa propre voix.
app.post("/api/tts", ttsLimit, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const lang = req.body?.lang === "en" ? "en" : "fr";
  if (!text || text.length > MAX_TTS_LENGTH) return res.status(400).json({ error: "Texte invalide." });

  try {
    const response = await fetch(`${TTS_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (!response.ok) throw new Error(`TTS ${response.status}`);
    res.setHeader("Content-Type", "audio/wav");
    res.send(Buffer.from(await response.arrayBuffer()));
    stats.record("tts", { lang });
  } catch {
    res.status(503).json({ error: "Synthèse vocale indisponible." });
  }
});

// ====== Santé (surveillance) ======
// GET /api/health : l'IA est-elle joignable (clé acceptée, modèle toujours proposé par
// Groq), la voix répond-elle, la fiche est-elle lisible ? Interrogé par une Action GitHub
// programmée (.github/workflows/surveillance.yml). Aucune question posée à l'IA : pas de
// quota consommé. Résultat gardé HEALTH_CACHE_MS, pour qu'un appel répété ne relaie pas
// chaque fois vers Groq. Réponse : 200 si l'IA marche (« degrade » si seule la voix manque,
// le navigateur lit alors avec la sienne), 503 sinon. Aucun détail interne exposé.
const HEALTH_CACHE_MS = 60_000;
let healthCache = null; // { at, promise }

async function checkGroq() {
  if (!GROQ_API_KEY) return "clé absente";
  try {
    const res = await fetch(GROQ_MODEL_URL, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 401 || res.status === 403) return `clé refusée (${res.status})`;
    if (res.status === 404) return "modèle retiré par Groq";
    if (res.status === 429) return "ok"; // occupé, mais en service
    if (!res.ok) return `Groq en erreur (${res.status})`;
    const model = await res.json().catch(() => ({}));
    return model.active === false ? "modèle désactivé par Groq" : "ok";
  } catch {
    return "Groq injoignable";
  }
}

async function checkVoice() {
  try {
    const res = await fetch(`${TTS_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok ? "ok" : `voix en erreur (${res.status})`;
  } catch {
    return "voix arrêtée";
  }
}

async function runHealthChecks() {
  const [ia, voix] = await Promise.all([checkGroq(), checkVoice()]);
  const fiche = readProfileSections().length ? "ok" : "fiche vide ou absente";
  const status = ia !== "ok" || fiche !== "ok" ? "panne" : voix !== "ok" ? "degrade" : "ok";
  return { status, checks: { ia, voix, fiche } };
}

app.get("/api/health", async (req, res) => {
  if (!healthCache || Date.now() - healthCache.at > HEALTH_CACHE_MS) {
    healthCache = { at: Date.now(), promise: runHealthChecks() };
  }
  const result = await healthCache.promise;
  res.setHeader("Cache-Control", "no-store");
  res.status(result.status === "panne" ? 503 : 200).json(result);
});

// Lance la voix Piper et la relance si elle s'arrête d'elle-même (plantage, mémoire…).
// Au-delà de TTS_MAX_RESTARTS relances, on abandonne : le contrôle de santé le signalera.
const TTS_MAX_RESTARTS = 5;
const TTS_RESTART_DELAY_MS = 30_000;

function startTtsServer() {
  if (!fs.existsSync(TTS_PYTHON)) {
    console.warn("ℹ️  Piper non installé (voir tts/README.md) : le navigateur utilisera sa propre voix.");
    return;
  }
  let tts;
  let restarts = 0;
  let stopping = false;
  const launch = () => {
    tts = spawn(TTS_PYTHON, [path.join(TTS_DIR, "server.py")], {
      env: { ...process.env, TTS_PORT: String(TTS_PORT), PYTHONUNBUFFERED: "1" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    tts.on("exit", (code, signal) => {
      if (stopping) return;
      console.warn(`⚠️  Serveur de voix arrêté (${signal || `code ${code}`})`);
      if (restarts >= TTS_MAX_RESTARTS) {
        return console.error(`❌ Voix abandonnée après ${TTS_MAX_RESTARTS} relances : redémarrer le service.`);
      }
      restarts += 1;
      console.warn(`🔁 Relance de la voix dans ${TTS_RESTART_DELAY_MS / 1000} s (${restarts}/${TTS_MAX_RESTARTS})`);
      setTimeout(launch, TTS_RESTART_DELAY_MS).unref();
    });
  };
  launch();
  // Le serveur de voix s'arrête avec celui-ci
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      stopping = true;
      tts.kill();
      process.exit(0);
    });
  }
}

// Démarré seulement par `node server.js` : les tests (test/) importent l'application
// sans ouvrir de port ni lancer la voix.
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Robot 3D Assistant disponible sur http://localhost:${PORT} (modèle : ${GROQ_MODEL})`);
    startTtsServer();
    // Conservation limitée des statistiques : purge au démarrage, puis chaque jour
    stats.purgeOld();
    setInterval(() => stats.purgeOld(), 86400000).unref();
  });
}

// resetHealthCache : pour les tests (chaque cas veut un contrôle frais)
const resetHealthCache = () => (healthCache = null);

module.exports = { app, validateMessages, parseRetryDelay, buildSystemPrompt, readProfileSections, resetHealthCache, MAX_HISTORY };
