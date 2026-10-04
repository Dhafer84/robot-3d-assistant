// main.js — point d'entrée : relie la scène 3D, l'avatar, la webcam, la voix et le chat.

import * as THREE from "three";
import { state } from "./state.js";
import { createScene } from "./scene.js";
import { loadRiggedAvatar } from "./avatars.js";
import { startTracking } from "./tracking.js";
import { isVoiceSupported, createListener, createSpeaker } from "./voice.js";
import { createChat } from "./chat.js";

const sceneContainer = document.getElementById("scene-container");
const videoElement = document.getElementById("inputVideo");
const chatListEl = document.getElementById("chat");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const statusEl = document.getElementById("status");
const talkBtn = document.getElementById("talkBtn");
const modeButtons = {
  assistant: document.getElementById("modeAssistantBtn"),
  miroir: document.getElementById("modeMiroirBtn"),
};

const setStatus = (text) => (statusEl.textContent = text);

// ====== Scène et avatars ======
const { scene, camera, renderer } = createScene(sceneContainer);

// Cadrage de la caméra, interpolé à chaque image vers celui de l'avatar
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
    cameraTarget.lerp(avatar.framing.target, 1 - Math.exp(-4 * dt));
    cameraDistance = THREE.MathUtils.damp(cameraDistance, avatar.framing.distance, 4, dt);
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

// ====== Webcam ======
startTracking(videoElement, state)
  .then(() => setStatus("Caméra, visage et pose actifs."))
  .catch((err) => {
    console.error("Erreur suivi webcam :", err);
    setStatus("Erreur caméra ou MediaPipe.");
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

if (!isVoiceSupported()) {
  talkBtn.disabled = true;
  setStatus("Reconnaissance vocale non supportée : utilise Chrome ou Edge (ou écris ta question).");
} else {
  const listener = createListener({
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
