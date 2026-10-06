// Écrans tactiles (téléphones, tablettes) : saisie écrite seulement, réponses lues à voix haute,
// bouton pour couper la voix. Choix du 06/10/2026 : le micro y est souvent bloqué dans la bulle.
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
const { createSpeaker } = await import("../../frontend/js/voice.js");

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

test("écran tactile : micro et suivi webcam masqués, bouton 🔊 affiché ; ordinateur inchangé", () => {
  const html = read("index.html");
  const touch = html.match(/@media \(pointer: coarse\) \{([^]*?)\n    \}/)?.[1];
  assert.ok(touch, "règle @media (pointer: coarse) absente");
  assert.match(touch, /#talkBtn, #camBtn \{ display: none; \}/);
  assert.match(touch, /#muteBtn \{ display: inline-block; \}/);
  // Hors écran tactile, le bouton 🔊 est masqué (les ordinateurs ne changent pas)
  assert.match(html, /#muteBtn \{ display: none;/);

  // main.js : même requête, et l'écoute (donc la demande de micro) n'est pas créée
  const main = read("js/main.js");
  assert.match(main, /const TOUCH = window\.matchMedia\("\(pointer: coarse\)"\)\.matches;/);
  assert.ok(main.indexOf("if (TOUCH)") < main.indexOf("createListener("), "l'écoute doit être évitée sur écran tactile");
});
