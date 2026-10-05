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
