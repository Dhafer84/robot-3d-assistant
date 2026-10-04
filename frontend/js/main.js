// main.js — point d'entrée : relie la scène 3D, l'avatar, la webcam, la voix et le chat.

import * as THREE from "three";
import { state } from "./state.js";
import { createScene } from "./scene.js";
import { loadRiggedAvatar } from "./avatars.js";
import { createTracker } from "./tracking.js";
import { isVoiceSupported, createListener, createSpeaker } from "./voice.js";
import { createChat } from "./chat.js";

const sceneContainer = document.getElementById("scene-container");
const trackingSlot = document.getElementById("trackingSlot");
const chatListEl = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const statusEl = document.getElementById("status");
const talkBtn = document.getElementById("talkBtn");
const camBtn = document.getElementById("camBtn");
const modeButtons = {
  assistant: document.getElementById("modeAssistantBtn"),
  miroir: document.getElementById("modeMiroirBtn"),
};

const setStatus = (text) => (statusEl.textContent = text);

// ====== Scène et avatars ======
const { scene, camera, renderer } = createScene(sceneContainer);

// Cadrage de la caméra, interpolé à chaque image vers celui de l'avatar.
// En mode intégré (petite fenêtre), on cadre plus serré, sur le buste.
const EMBED = document.documentElement.classList.contains("embed");
const EMBED_TARGET_OFFSET = new THREE.Vector3(0, 0.22, 0);
const EMBED_ZOOM = 0.68;
const framingTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3(0, 0.95, 0);
const cameraDirection = new THREE.Vector3(0, 1.0, 4.9).normalize();
let cameraDistance = 2.1;

let avatar = null;
setStatus("Chargement de l'avatar…");
loadRiggedAvatar("./models/avatar.glb")
  .then((loaded) => {
    avatar = loaded;
    scene.add(avatar.root);
    avatar.wave();
    setStatus("Prêt.");
  })
  .catch((err) => {
    console.error("❌ Erreur chargement avatar.glb", err);
    setStatus("Impossible de charger l'avatar 3D.");
  });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (avatar) {
    framingTarget.copy(avatar.framing.target);
    if (EMBED) framingTarget.add(EMBED_TARGET_OFFSET);
    const distance = avatar.framing.distance * (EMBED ? EMBED_ZOOM : 1);
    cameraTarget.lerp(framingTarget, 1 - Math.exp(-4 * dt));
    cameraDistance = THREE.MathUtils.damp(cameraDistance, distance, 4, dt);
  }
  camera.position.copy(cameraTarget).addScaledVector(cameraDirection, cameraDistance);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
  avatar?.update(dt, state, camera);
  renderer.render(scene, camera);
});

// ====== Modes Assistant / Miroir ======
function setMode(mode) {
  state.mode = mode;
  for (const [name, button] of Object.entries(modeButtons)) {
    button.classList.toggle("active", name === mode);
  }
}

modeButtons.assistant.addEventListener("click", () => {
  setMode("assistant");
  setStatus("Mode Assistant IA sélectionné.");
});
modeButtons.miroir.addEventListener("click", () => {
  setMode("miroir");
  setStatus("Mode Miroir (je répète tout) sélectionné.");
});
setMode(state.mode);

// ====== Webcam (à la demande) ======
const tracker = createTracker(trackingSlot, state);

function setTrackingUI(active) {
  document.body.classList.toggle("tracking", active);
  camBtn.classList.toggle("active", active);
  camBtn.textContent = active ? "📷 Couper le suivi" : "📷 Activer le suivi";
}

camBtn.addEventListener("click", async () => {
  if (tracker.active) {
    tracker.stop();
    setTrackingUI(false);
    setStatus("Suivi coupé, caméra libérée.");
    return;
  }
  camBtn.disabled = true;
  setStatus("Démarrage de la caméra…");
  // L'aperçu s'affiche dès le démarrage : la page de suivi a besoin d'être visible pour tourner
  document.body.classList.add("tracking");
  try {
    await tracker.start();
    setTrackingUI(true);
    setStatus("Je te suis des yeux 👀 (rien n'est enregistré ni envoyé).");
  } catch (err) {
    console.error("Erreur suivi webcam :", err);
    setTrackingUI(false);
    setStatus(err.name === "NotAllowedError" ? "Caméra refusée : le suivi reste désactivé." : "Impossible de démarrer la caméra.");
  } finally {
    camBtn.disabled = false;
  }
});

// ====== Conversation (clavier et voix) ======
const speaker = createSpeaker(state);
const chat = createChat({ listEl: chatListEl, speaker, state, onStatus: setStatus });

// Le navigateur n'autorise le son qu'après une action de l'utilisateur
for (const type of ["pointerdown", "keydown"]) {
  document.addEventListener(type, () => speaker.unlock(), { capture: true });
}

function handleText(text) {
  if (state.mode === "miroir") chat.echo(text);
  else chat.ask(text);
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = "";
  handleText(text);
});

let listener = null;
if (!isVoiceSupported()) {
  talkBtn.disabled = true;
  setStatus("Reconnaissance vocale non supportée : utilise Chrome ou Edge (ou écris ta question).");
} else {
  listener = createListener({
    state,
    onText: (text) => {
      setStatus(`Tu as dit : « ${text} »`);
      handleText(text);
    },
    onStatus: (text, listening) => {
      setStatus(text);
      talkBtn.textContent = listening ? "⏹️ Stop écoute" : "🎙️ Activer écoute auto";
    },
  });
  talkBtn.addEventListener("click", () => listener.toggle());
}

// ====== Mode intégré (iframe) ======
// Quand le site hôte ferme la bulle (embed.js), l'assistant se tait et coupe micro et caméra
window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.data?.type !== "r3d:pause") return;
  speaker.stop();
  listener?.stop();
  if (tracker.active) {
    tracker.stop();
    setTrackingUI(false);
  }
});
