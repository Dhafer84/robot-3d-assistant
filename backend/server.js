// server.js — sert le frontend et relaie les questions vers l'IA Groq.

const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT) || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MESSAGE_LENGTH = 2000;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

const SYSTEM_PROMPT =
  "Tu es 'Dhafer 3D Robot Assistant'. Tu es un robot 3D intelligent, simple, clair, concis et amical. " +
  "Tu réponds toujours en français, avec un style professionnel mais chaleureux, et parfois des emojis 🤖✨. " +
  "La première phrase de chaque réponse doit TOUJOURS commencer par : " +
  "\"Bonjour ! Je suis le robot 3D assistant de Dhafer BTH, prêt à t'aider 🤖\".";

if (!GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY n'est pas définie dans backend/.env (voir .env.example)");
}

const app = express();
app.use(express.json({ limit: "20kb" }));

// Frontend (index.html, js/, models/…) servi sur la même origine que l'API
app.use(express.static(FRONTEND_DIR));

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "Le message est vide." });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: "Le message est trop long." });
  }
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "Clé API Groq manquante côté serveur." });
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Erreur HTTP Groq :", response.status, await response.text());
      return res.status(502).json({ error: "Erreur lors de l'appel à Groq." });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas compris.";
    res.json({ answer });
  } catch (error) {
    console.error("Erreur API Groq :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Robot 3D Assistant disponible sur http://localhost:${PORT} (modèle : ${GROQ_MODEL})`);
});
