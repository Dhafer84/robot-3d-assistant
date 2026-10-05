// stats.js — statistiques d'usage anonymes.
//
// Un fichier JSON Lines par jour dans STATS_DIR (défaut backend/data/stats/), supprimé au
// bout de STATS_RETENTION_DAYS (défaut 90). Jamais d'adresse IP ni d'identifiant de
// visiteur. Le texte d'une question n'est conservé QUE si l'assistant n'a pas su y
// répondre (pour enrichir profile.md), tronqué, e-mails / numéros / liens masqués.
// Lecture : `npm run stats` (scripts/stats.js).

const fs = require("fs");
const path = require("path");

const STATS_DIR = process.env.STATS_DIR || path.join(__dirname, "data", "stats");
const RETENTION_DAYS = Number(process.env.STATS_RETENTION_DAYS) || 90;
const MAX_QUESTION_LENGTH = 300;

// Réponses où l'assistant dit ne pas savoir (en plus de l'émotion <desole>)
const UNANSWERED = /je ne (sais|dispose|connais|peux)\b|je n'ai pas (cette|d'|l')|pas (cette|d'|l') ?information|i (don't|do not) (know|have)|i'm not sure/i;

// Masque ce qu'un visiteur pourrait écrire de personnel dans sa question
function redact(text) {
  return String(text)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[lien]")
    .replace(/\+?\d[\d\s.-]{6,}\d/g, "[numéro]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION_LENGTH);
}

// L'assistant a-t-il su répondre ? (émotion de la balise + formulations « je ne sais pas »)
function isUnanswered(answer) {
  const emotion = /^\s*<\s*([a-z]+)\s*>/i.exec(answer)?.[1]?.toLowerCase();
  return emotion === "desole" || UNANSWERED.test(answer);
}

function emotionOf(answer) {
  return /^\s*<\s*([a-z]+)\s*>/i.exec(answer)?.[1]?.toLowerCase() || "aucune";
}

const day = (date) => date.toISOString().slice(0, 10);

// Ajoute un événement au fichier du jour. N'échoue jamais : une statistique perdue ne
// doit pas gêner une conversation.
function record(event, data = {}) {
  const now = new Date();
  const line = JSON.stringify({ t: now.toISOString(), e: event, ...data }) + "\n";
  fs.mkdir(STATS_DIR, { recursive: true }, (mkdirError) => {
    if (mkdirError) return console.warn("Statistiques : dossier inaccessible", mkdirError.message);
    fs.appendFile(path.join(STATS_DIR, `${day(now)}.jsonl`), line, (err) => {
      if (err) console.warn("Statistiques : écriture impossible", err.message);
    });
  });
}

// Supprime les fichiers plus vieux que la durée de conservation (aujourd'hui compris :
// 90 jours = aujourd'hui et les 89 précédents, comme readEvents)
function purgeOld(now = new Date()) {
  const limit = day(new Date(now.getTime() - (RETENTION_DAYS - 1) * 86400000));
  let removed = 0;
  for (const file of listFiles()) {
    if (file.slice(0, 10) < limit) {
      fs.rmSync(path.join(STATS_DIR, file));
      removed += 1;
    }
  }
  return removed;
}

function listFiles() {
  try {
    return fs.readdirSync(STATS_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  } catch {
    return [];
  }
}

// Événements des `days` derniers jours (lignes illisibles ignorées)
function readEvents(days, now = new Date()) {
  const since = day(new Date(now.getTime() - (days - 1) * 86400000));
  const events = [];
  for (const file of listFiles()) {
    if (file.slice(0, 10) < since) continue;
    for (const line of fs.readFileSync(path.join(STATS_DIR, file), "utf8").split("\n")) {
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // ligne tronquée (arrêt brutal pendant une écriture) : ignorée
      }
    }
  }
  return events;
}

module.exports = {
  record,
  purgeOld,
  readEvents,
  redact,
  isUnanswered,
  emotionOf,
  STATS_DIR,
  RETENTION_DAYS,
  MAX_QUESTION_LENGTH,
};
