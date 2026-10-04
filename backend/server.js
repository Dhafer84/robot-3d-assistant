// server.js - version CommonJS, compatible Node 24.x

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Petite vérification au démarrage
if (!GROQ_API_KEY) {
  console.warn("⚠️  Attention : GROQ_API_KEY n'est pas définie dans le fichier .env");
}

// Route principale : IA via Groq
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // ⚠️ Node 24.x contient déjà fetch en global → pas besoin de node-fetch
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
          model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Tu es 'Dhafer 3D Robot Assistant'. Tu es un robot 3D intelligent, simple, clair, concis et amical. Tu réponds toujours en français, avec un style professionnel mais chaleureux, et parfois des emojis 🤖✨. La première phrase de chaque réponse doit TOUJOURS commencer par : \"Bonjour ! Je suis le robot 3D assistant de Dhafer BTH, prêt à t'aider 🤖\"."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur HTTP Groq:", response.status, errorText);
      return res.status(500).json({ error: "Erreur lors de l'appel à Groq." });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Désolé, je n'ai pas compris.";

    res.json({ answer });

  } catch (error) {
    console.error("Erreur API Groq :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend opérationnel sur http://localhost:${PORT}`);
});
