// Tests de backend/profile.md : la fiche est la seule source de l'assistant sur Dhafer,
// lue par n'importe quel visiteur via ses réponses. Elle ne doit contenir AUCUNE donnée
// personnelle volontairement écartée du CV (voir CLAUDE.md, « Contenu de l'assistant »).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { readProfileSections, buildSystemPrompt } = require("../server");

const profile = fs.readFileSync(path.join(__dirname, "..", "profile.md"), "utf8");

test("aucune donnée personnelle dans la fiche", () => {
  const interdits = [
    [/\+?\d{2,3}[\s.]?\d{2}[\s.]?\d{3}[\s.]?\d{3}/, "numéro de téléphone"],
    [/@[a-z0-9-]+\.[a-z]{2,}/i, "adresse e-mail"],
    [/\b(19[5-9]\d|200\d)\b.*naissance|né le|born/i, "date de naissance"],
    [/\bmarié|married|célibataire|enfants?\b/i, "situation familiale"],
    [/dammam|siemens/i, "candidature en cours"],
  ];
  for (const [motif, quoi] of interdits) assert.doesNotMatch(profile, motif, quoi);
});

test("la fiche est découpée en sections ; l'en-tête pour l'humain n'en fait pas partie", () => {
  const titles = readProfileSections().map((s) => s.title);
  for (const attendu of ["Dhafer", "Parcours", "Compétences", "Formation et certifications", "Contact", "Consignes particulières"]) {
    assert.ok(titles.includes(attendu), `section « ${attendu} » absente`);
  }
  assert.ok(titles.some((t) => t.startsWith("Quality Crew")));
  assert.ok(!titles.some((t) => t.startsWith("Fiche de profil")));
});

test("les consignes de confidentialité sont toujours envoyées à l'IA", () => {
  const prompt = buildSystemPrompt([{ role: "user", content: "Bonjour" }]);
  assert.match(prompt, /## Consignes particulières/);
  assert.match(prompt, /N'invente jamais/);
});

test("le détail d'un outil n'est envoyé que s'il en est question, avec la vue d'ensemble", () => {
  const prompt = buildSystemPrompt([{ role: "user", content: "Comment marche CauseTrace ?" }]);
  assert.match(prompt, /## Outil CauseTrace/);
  assert.match(prompt, /## Quality Crew/); // la doctrine et l'IA par outil vont avec
  for (const autre of ["SafetyScope", "ThreatScope", "RegWatch", "SentinelScan"]) {
    assert.doesNotMatch(prompt, new RegExp(`## Outil ${autre}`), autre);
  }
  // Question générale : la vue d'ensemble suffit, sans le détail des six outils
  const general = buildSystemPrompt([{ role: "user", content: "Quel outil n'utilise aucune IA ?" }]);
  assert.match(general, /## Quality Crew/);
  assert.doesNotMatch(general, /## Outil /);
});

test("question de suivi : l'outil est retrouvé grâce à la réponse précédente (bug du 05/10)", () => {
  // Conversation réelle : le visiteur ne renomme pas l'outil (« ce dernier », « donc il y a de l'IA »)
  const prompt = buildSystemPrompt([
    { role: "user", content: "comment utiliser cause trace" },
    { role: "assistant", content: "<reflexion> CauseTrace guide une réclamation 8D…" },
    { role: "user", content: "ou intervient l ia ds ce dernier" },
    { role: "assistant", content: "<reflexion> Dans CauseTrace, l'IA est facultative…" },
    { role: "user", content: "donc il y a de lai" },
  ]);
  assert.match(prompt, /## Outil CauseTrace/);
  assert.match(prompt, /IA FACULTATIVE, sur boutons/);
});
