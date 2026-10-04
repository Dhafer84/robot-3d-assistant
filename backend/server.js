// server.js — sert le frontend et relaie la conversation vers l'IA Groq (réponse en streaming).

const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT) || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
const PROFILE_PATH = path.join(__dirname, "profile.md");

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
  Parcours: /exp[ée]rien|parcours|carri[èe]re|poste|travail|emploi|job|actia|cipi|volvo|scania|continental|jaguar|entreprise|r[ôo]le|manag|team|[ée]quipe|aspice|audit|usine|ann[ée]e|work|career|company/,
  "Compétences": /comp[ée]ten|sait|ma[îi]tris|skill|technolog|norme|iso|iatf|python|power ?bi|fmea|amdec|8d|misra|ldra|coverity|kubernetes|cloud|devops/,
  Formation: /formation|dipl[ôo]m|[ée]tud|[ée]cole|ing[ée]nieur|certif|esprit|iset|universit|degree|study|educat/,
  "Quality Crew": /quality ?crew|site|outil|d[ée]mo|agent|ia|ai|intelligen|llm|hara|tara|asil|8d|sentinel|safety|threat|regwatch|cause|crewai|github|tool|projet|project/,
  "Autres projets": /projet|portfolio|robot|avatar|3d|assistant|qui es|who are|toi-m[êe]me|comment (tu )?(es|as)|project/,
};

const PERSONA = `Tu es l'assistant personnel de Dhafer Bouthelja. Tu apparais sous la forme d'un avatar 3D à son image, sur son portfolio et sur le site Quality Crew, et tu parles aux visiteurs à voix haute.

Style :
- Réponds toujours dans la langue du dernier message du visiteur : en anglais s'il écrit en anglais, en arabe s'il écrit en arabe, en français sinon. Ton chaleureux et professionnel.
- Sois bref : 1 à 3 phrases courtes, 4 au maximum si la question le demande vraiment.
- Tes réponses sont lues à voix haute : pas de markdown, pas de listes, pas d'emojis, pas d'URL à rallonge (dis plutôt "sur son site" ou "sur LinkedIn").
- Ne te présentes que si on te salue ou si on te demande qui tu es.

Faits :
- Tout ce que tu sais sur Dhafer, ses projets et Quality Crew vient de la fiche de profil ci-dessous. N'invente jamais d'information (expérience, client, tarif, chiffre, date) qui n'y figure pas.
- Les lignes entre crochets [ ... ] sont des champs non remplis : ignore-les.
- Seuls les extraits de la fiche utiles à la question te sont fournis. Si l'information demandée n'y est pas, dis simplement que tu ne la connais pas et propose de contacter Dhafer.
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
  const question = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const selected = readProfileSections().filter(({ title }) => {
    if (ALWAYS_SECTIONS.some((name) => title.startsWith(name))) return true;
    const entry = Object.entries(SECTION_KEYWORDS).find(([name]) => title.startsWith(name));
    return entry ? entry[1].test(question) : true; // section inconnue : toujours jointe
  });

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

const app = express();
app.use(express.json({ limit: "100kb" }));

// Frontend (index.html, js/, models/…) servi sur la même origine que l'API
app.use(express.static(FRONTEND_DIR));

// Répond en texte brut, envoyé morceau par morceau au fil de la génération
app.post("/api/chat", async (req, res) => {
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
      const seconds = Math.max(1, Math.ceil(wait));
      return res.status(429).json({
        error: `Je reçois beaucoup de questions en ce moment. Repose-moi la tienne dans ${seconds} secondes, s'il te plaît.`,
        retryAfter: seconds,
      });
    }

    if (!response.ok) {
      console.error("Erreur HTTP Groq :", response.status, await response.text());
      return res.status(502).json({ error: "Erreur lors de l'appel à Groq." });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    // Flux SSE de Groq : lignes "data: {json}" ; on ne garde que le texte de la réponse
    // (delta.content), pas la réflexion interne du modèle (delta.reasoning).
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        const text = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
        if (text) res.write(text);
      }
    }
    res.end();
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Erreur API Groq :", err);
    if (!res.headersSent) res.status(500).json({ error: "Erreur serveur." });
    else res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Robot 3D Assistant disponible sur http://localhost:${PORT} (modèle : ${GROQ_MODEL})`);
});
