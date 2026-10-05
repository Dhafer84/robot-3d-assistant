#!/usr/bin/env node
// Affiche les statistiques d'usage de l'assistant (voir stats.js).
//   npm run stats            30 derniers jours
//   npm run stats -- 7       7 derniers jours
//   npm run stats -- 90 --toutes   toutes les questions sans réponse (sinon les 20 dernières)

const { readEvents, STATS_DIR, RETENTION_DAYS } = require("../stats");

const args = process.argv.slice(2);
const days = Math.max(1, Math.min(Number(args.find((a) => /^\d+$/.test(a))) || 30, RETENTION_DAYS));
const showAll = args.includes("--toutes");

const events = readEvents(days);
const pct = (n, total) => (total ? `${Math.round((n / total) * 100)} %` : "—");
const pad = (value, width) => String(value).padStart(width);

console.log(`\n📊 Statistiques de l'assistant — ${days} derniers jours`);
console.log(`   (données : ${STATS_DIR}, conservées ${RETENTION_DAYS} jours, sans adresse IP)\n`);

if (!events.length) {
  console.log("Aucune donnée sur la période.\n");
  process.exit(0);
}

// ====== Par jour ======
const perDay = new Map();
for (const e of events) {
  const d = e.t.slice(0, 10);
  if (!perDay.has(d)) perDay.set(d, { views: 0, bubble: 0, conv: 0, questions: 0, unanswered: 0, tts: 0, limits: 0, errors: 0 });
  const row = perDay.get(d);
  if (e.e === "view") {
    row.views += 1;
    if (e.embed) row.bubble += 1;
  } else if (e.e === "question") {
    row.questions += 1;
    if (e.turn === 1) row.conv += 1;
    if (!e.answered) row.unanswered += 1;
  } else if (e.e === "tts") row.tts += 1;
  else if (e.e === "limit") row.limits += 1;
  else if (e.e === "error") row.errors += 1;
}

const columns = [
  ["Jour", 10, "day"],
  ["Vues", 6, "views"],
  ["dont bulle", 10, "bubble"],
  ["Conversations", 13, "conv"],
  ["Questions", 9, "questions"],
  ["Sans réponse", 12, "unanswered"],
  ["Phrases lues", 12, "tts"],
  ["Limites", 7, "limits"],
  ["Erreurs", 7, "errors"],
];
console.log(columns.map(([title, w]) => title.padStart(w)).join("  "));
const total = { day: "Total" };
for (const [d, row] of [...perDay].sort()) {
  console.log(columns.map(([, w, key]) => pad(key === "day" ? d : row[key], w)).join("  "));
  for (const [, , key] of columns.slice(1)) total[key] = (total[key] || 0) + row[key];
}
console.log(columns.map(([, w]) => "─".repeat(w)).join("  "));
console.log(columns.map(([, w, key]) => pad(total[key], w)).join("  "));

// ====== Répartitions ======
const questions = events.filter((e) => e.e === "question");
const count = (list, key) =>
  [...list.reduce((m, e) => m.set(e[key], (m.get(e[key]) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${pct(n, list.length)}`)
    .join(" · ");

if (questions.length) {
  const fromBubble = questions.filter((q) => q.embed).length;
  console.log(`\nQuestions posées depuis la bulle : ${pct(fromBubble, questions.length)}`);
  console.log(`Questions par conversation : ${(questions.length / Math.max(1, total.conv)).toFixed(1)}`);
  console.log(`Émotions des réponses : ${count(questions, "emotion")}`);
}
const limits = events.filter((e) => e.e === "limit");
if (limits.length) console.log(`Limites atteintes : ${count(limits, "kind")}`);

// ====== Questions sans réponse ======
const unanswered = questions.filter((q) => !q.answered && q.q);
console.log(`\n❓ Questions sans réponse (${unanswered.length}) — à ajouter à profile.md si pertinent :`);
if (!unanswered.length) console.log("   aucune 🎉");

// Regroupe les questions identiques (casse et ponctuation ignorées), plus récentes d'abord
const groups = new Map();
for (const q of unanswered) {
  const key = q.q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const g = groups.get(key) || { text: q.q, n: 0, last: q.t };
  g.n += 1;
  if (q.t > g.last) g.last = q.t;
  groups.set(key, g);
}
const list = [...groups.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
for (const g of showAll ? list : list.slice(0, 20)) {
  const when = g.last.slice(0, 16).replace("T", " ");
  console.log(`   ${when}  ${g.n > 1 ? `(×${g.n}) ` : ""}« ${g.text} »`);
}
if (!showAll && list.length > 20) console.log(`   … et ${list.length - 20} autres (ajoute --toutes)`);
console.log("");
