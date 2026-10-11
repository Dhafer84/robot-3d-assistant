// La voix au choix du visiteur (choix du 11/10/2026) : COUPÉE par défaut, bouton 🔊/🔇 partout,
// choix gardé pour la visite, bouche immobile sans voix. Et sur écran tactile (téléphones,
// tablettes, choix du 06/10/2026) : saisie écrite seulement, ni micro ni suivi webcam.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend");
const read = (file) => fs.readFileSync(path.join(FRONTEND, file), "utf8");

// voice.js lit window.SpeechRecognition au chargement ; la voix du navigateur sert de secours
globalThis.window = {};
globalThis.SpeechSynthesisUtterance = class {};
globalThis.speechSynthesis = { speak: (u) => u.onend?.(), cancel() {} };
const { createSpeaker, voiceWanted, VOICE_KEY } = await import("../../frontend/js/voice.js");

test("voix coupée PAR DÉFAUT : rien n'est lu ni demandé au serveur, la bouche reste immobile", () => {
  const requests = [];
  globalThis.fetch = async (url) => (requests.push(url), new Response("", { status: 503 }));
  const state = {};
  const speaker = createSpeaker(state);
  assert.equal(speaker.muted, true);
  speaker.say("Bonjour, je suis l'assistant de Dhafer.");
  assert.equal(requests.length, 0);
  assert.ok(!state.isSpeaking); // pas de lip-sync ni d'animation « Talking »
});

test("choix gardé pour la visite : voix activée seulement si le visiteur l'a activée (\"0\")", () => {
  const storage = (value) => () => ({ getItem: (k) => (k === VOICE_KEY ? value : null) });
  assert.equal(voiceWanted(storage("0")), true);
  assert.equal(voiceWanted(storage("1")), false);
  assert.equal(voiceWanted(storage(null)), false); // nouvelle visite : coupée
  assert.equal(voiceWanted(() => { throw new Error("SecurityError"); }), false); // stockage bloqué
  assert.equal(voiceWanted(() => undefined), false);
});

test("voix coupée : rien n'est lu ni demandé au serveur ; remise : la lecture reprend", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return new Response("", { status: 503 }); // Piper absent : voix du navigateur
  };
  const state = {};
  const speaker = createSpeaker(state);

  speaker.setMuted(true);
  assert.equal(speaker.muted, true);
  speaker.say("Bonjour, je suis l'assistant de Dhafer.");
  assert.equal(requests.length, 0);
  assert.ok(!state.isSpeaking);

  speaker.setMuted(false);
  speaker.say("Bonjour, je suis l'assistant de Dhafer.");
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(requests, ["/api/tts"]);
});

test("couper la voix arrête la phrase en cours", () => {
  const state = {};
  const speaker = createSpeaker(state);
  state.isSpeaking = true;
  speaker.setMuted(true);
  assert.equal(state.isSpeaking, false);
});

test("bouton de la voix partout, 🔇 « Activer la voix » dès le HTML ; écran tactile sans micro ni suivi", () => {
  const html = read("index.html");
  // Visible partout (ordinateur compris) : plus aucune règle qui le masque
  assert.doesNotMatch(html, /#muteBtn[^{]*\{[^}]*display: none/);
  // État initial = voix coupée, avant même l'exécution des scripts (pas d'éclair 🔊)
  assert.match(html, /<button id="muteBtn"[^>]*aria-pressed="true"[^>]*data-i18n-label="unmute"[^>]*>🔇<\/button>/);
  const touch = html.match(/@media \(pointer: coarse\) \{([^]*?)\n    \}/)?.[1];
  assert.ok(touch, "règle @media (pointer: coarse) absente");
  assert.match(touch, /#talkBtn, #camBtn \{ display: none; \}/);

  // main.js : même requête, et l'écoute (donc la demande de micro) n'est pas créée
  const main = read("js/main.js");
  assert.match(main, /const TOUCH = window\.matchMedia\("\(pointer: coarse\)"\)\.matches;/);
  assert.ok(main.indexOf("if (TOUCH)") < main.indexOf("createListener("), "l'écoute doit être évitée sur écran tactile");
  // Au démarrage : voix coupée sauf si activée plus tôt dans la visite ; le micro n'y touche pas
  assert.match(main, /setMuted\(!voiceWanted\(\(\) => sessionStorage\)\);/);
  assert.equal((main.match(/(?<!\.)setMuted\(/g) || []).length, 3, "setMuted : définition, bouton, démarrage — rien d'autre (le micro ne l'active pas)");
});
