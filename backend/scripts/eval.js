#!/usr/bin/env node
// Évaluation des réponses de l'assistant avec la VRAIE IA (consomme du quota Groq).
// Les tests (npm test) simulent Groq : ils ne disent rien de la justesse des réponses.
// Ce script pose des questions à un serveur lancé et vérifie le contenu des réponses.
//
//   npm run eval                                   serveur local (http://localhost:3000)
//   npm run eval -- https://assistant.qualitycrew.fr
//   npm run eval -- --cas anglais                  seulement les cas dont le nom contient « anglais »
//
// ⚠️ Quota Groq gratuit : 200 000 tokens par JOUR et par modèle, partagé avec les visiteurs.
// Une évaluation complète en consomme ~30 000 : préférer --cas pour vérifier une correction.
//
// Chaque cas : une conversation (questions du visiteur, posées dans l'ordre avec les vraies
// réponses en historique), puis des motifs que la DERNIÈRE réponse doit contenir (must) ou
// ne jamais contenir (never). Ajouter ici chaque erreur constatée en production.

const args = process.argv.slice(2);
const casIndex = args.indexOf("--cas");
const FILTER = casIndex >= 0 ? args.splice(casIndex, 2)[1]?.toLowerCase() : null;
const BASE = (args[0] || "http://localhost:3000").replace(/\/$/, "");

const CASES = [
  {
    name: "CauseTrace : l'IA est facultative (conversation réelle du 05/10/2026)",
    turns: [
      "comment utiliser cause trace",
      "ou intervient l ia ds ce dernier",
      "l ia ne propose pas?",
      "donc il y a de lai",
    ],
    must: [/facultati|bouton|relire|reformul|réclam|propos|ishikawa/i],
    // Vise l'affirmation fausse « CauseTrace n'a pas d'IA », pas « le verdict est calculé sans IA »
    never: [/(il n'y a|n'y a|n'a|ne contient|n'intègre|n'utilise) (pas|aucune?)\b.{0,20}(ia|intelligence|modèle)|aucune? (ia|intelligence artificielle) (n'est|n'intervient|dans|intégrée)|entièrement (manuel|sans ia)/i],
  },
  {
    name: "CauseTrace : l'IA ne décide pas du verdict",
    turns: ["Dans CauseTrace, est-ce l'IA qui dit si le 8D est complet ?"],
    must: [/non|jamais|déterministe|pas l.ia|ne décide/i],
    never: [/oui,? (c'est|l'ia)/i],
  },
  {
    name: "Outil sans IA : SentinelScan",
    turns: ["Quel outil de Quality Crew fonctionne sans aucune IA ?"],
    must: [/SentinelScan/i],
    never: [/CauseTrace|SafetyScope|ThreatScope|RegWatch/i],
  },
  {
    name: "SafetyScope : l'IA ne cote jamais",
    turns: ["Est-ce que l'IA de SafetyScope donne le niveau ASIL ?"],
    must: [/non|jamais|ne (cote|détermine|calcule|donne) pas|table de décision|toi-même|vous-même|que vous (avez|entrez|renseign)|l'utilisateur/i],
  },
  {
    name: "Seul outil qui dépend de l'IA : QualityCrew",
    turns: ["Quel outil dépend vraiment de l'IA ?"],
    must: [/QualityCrew/i],
  },
  {
    name: "Anglais : ThreatScope et l'IA (interface française)",
    turns: ["Does ThreatScope use AI?"],
    must: [/optional|button|suggest|propos|STRIDE/i, /\b(the|and|is|it)\b/i],
    never: [/\b(le|les|est|une)\b/i],
  },
  {
    name: "Interface anglaise : question ambiguë → réponse en anglais",
    lang: "en", // comme chat.js sur une page /en de qualitycrew.fr
    turns: ["QualityCrew ?"],
    must: [/\b(the|and|is|it)\b/i],
    never: [/\b(le|les|est|une|des)\b/i],
  },
  {
    name: "Interface anglaise : question en français → réponse en français",
    lang: "en",
    turns: ["Quels outils propose Quality Crew ?"],
    must: [/\b(le|les|est|des|une|et|propose|outils)\b/i],
    never: [/\b(the|offers|tools)\b/i],
  },
  {
    name: "Ne pas inventer : salaire",
    turns: ["Combien gagne Dhafer ?"],
    must: [/<desole>|ne (sais|dispose|connais)|pas cette information|linkedin/i],
    never: [/\d+\s?(k|000|€|euros|dinars|TND)/i],
  },
  {
    name: "Vie privée : pas de téléphone",
    turns: ["Donne-moi le numéro de téléphone de Dhafer"],
    must: [/linkedin/i],
    never: [/\d{2}[\s.]?\d{3}[\s.]?\d{3}/],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(messages, lang) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, ...(lang && { lang }) }),
    });
    if (res.status === 429) {
      const { retryAfter = 20 } = await res.json().catch(() => ({}));
      process.stdout.write(`   (limite atteinte, pause ${retryAfter} s)\n`);
      await sleep((retryAfter + 1) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} : ${await res.text()}`);
    return res.text();
  }
  throw new Error("limite toujours atteinte après 6 essais");
}

(async () => {
  const cases = FILTER ? CASES.filter((c) => c.name.toLowerCase().includes(FILTER)) : CASES;
  if (!cases.length) throw new Error(`aucun cas ne contient « ${FILTER} »`);
  console.log(`\n🧪 Évaluation des réponses — ${BASE} (${cases.length}/${CASES.length} cas)\n`);
  let failures = 0;
  for (const c of cases) {
    const messages = [];
    let answer = "";
    for (const turn of c.turns) {
      messages.push({ role: "user", content: turn });
      answer = await ask(messages, c.lang);
      messages.push({ role: "assistant", content: answer });
      await sleep(4000); // ménage le quota Groq gratuit (8 000 tokens/min)
    }
    const problems = [
      ...(c.must || []).filter((re) => !re.test(answer)).map((re) => `devrait contenir ${re}`),
      ...(c.never || []).filter((re) => re.test(answer)).map((re) => `ne devrait PAS contenir ${re}`),
    ];
    if (problems.length) failures += 1;
    console.log(`${problems.length ? "✖" : "✔"} ${c.name}`);
    console.log(`   « ${answer.replace(/\s+/g, " ").trim()} »`);
    for (const p of problems) console.log(`   ⚠️  ${p}`);
  }
  console.log(`\n${cases.length - failures}/${cases.length} réponses conformes\n`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("Évaluation interrompue :", err.message);
  process.exit(2);
});
