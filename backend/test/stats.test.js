// Tests de stats.js : masquage des données personnelles, détection des questions sans
// réponse, fichiers par jour, conservation limitée.
const os = require("os");
const fs = require("fs");
const path = require("path");

process.env.STATS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "stats-unit-"));
process.env.STATS_RETENTION_DAYS = "90";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const stats = require("../stats");

after(() => fs.rmSync(process.env.STATS_DIR, { recursive: true, force: true }));

test("masquage : e-mails, numéros et liens écrits par un visiteur", () => {
  assert.equal(
    stats.redact("Écris-moi à jean.dupont@exemple.fr ou au +33 6 12 34 56 78, voir https://exemple.fr/cv"),
    "Écris-moi à [e-mail] ou au [numéro], voir [lien]"
  );
  assert.equal(stats.redact("Appelle le 0612345678 stp"), "Appelle le [numéro] stp");
  // Les nombres courts restent : ils font souvent le sens de la question
  assert.equal(stats.redact("ISO 26262 et ASPICE niveau 2 en 2026 ?"), "ISO 26262 et ASPICE niveau 2 en 2026 ?");
  assert.equal(stats.redact("x".repeat(500)).length, stats.MAX_QUESTION_LENGTH);
});

test("question sans réponse : émotion « désolé » ou formulation « je ne sais pas »", () => {
  assert.ok(stats.isUnanswered("<desole> Je ne dispose pas de cette information."));
  assert.ok(stats.isUnanswered("<neutre> Je ne connais pas son salaire, contacte-le sur LinkedIn."));
  assert.ok(stats.isUnanswered("<neutre> I don't have that information."));
  assert.ok(!stats.isUnanswered("<joie> Dhafer a 18 ans d'expérience dans l'électronique automobile."));
  assert.ok(!stats.isUnanswered("<reflexion> SafetyScope détermine le niveau ASIL."));
  assert.equal(stats.emotionOf("<Joie> Super"), "joie");
  assert.equal(stats.emotionOf("Pas de balise"), "aucune");
});

test("un fichier JSON Lines par jour ; lignes illisibles ignorées à la lecture", async () => {
  stats.record("question", { answered: true, turn: 1 });
  await new Promise((r) => setTimeout(r, 50));
  const today = new Date().toISOString().slice(0, 10);
  const file = path.join(process.env.STATS_DIR, `${today}.jsonl`);
  fs.appendFileSync(file, '{"t":"tronqu');
  const events = stats.readEvents(1);
  assert.equal(events.length, 1);
  assert.equal(events[0].e, "question");
  assert.match(events[0].t, /^\d{4}-\d{2}-\d{2}T/);
});

test("conservation limitée : les fichiers de plus de 90 jours sont supprimés", () => {
  const dir = process.env.STATS_DIR;
  const now = new Date("2026-10-05T12:00:00Z");
  for (const d of ["2026-06-01", "2026-07-07", "2026-07-08", "2026-10-05"]) fs.writeFileSync(path.join(dir, `${d}.jsonl`), "");
  fs.writeFileSync(path.join(dir, "notes.txt"), "pas un fichier de statistiques");
  assert.equal(stats.purgeOld(now), 2);
  const left = fs.readdirSync(dir).sort();
  assert.ok(!left.includes("2026-06-01.jsonl") && !left.includes("2026-07-07.jsonl"));
  assert.ok(left.includes("2026-07-08.jsonl") && left.includes("2026-10-05.jsonl") && left.includes("notes.txt"));
});
