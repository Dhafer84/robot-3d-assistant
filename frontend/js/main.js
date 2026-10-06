// main.js — point d'entrée : relie la scène 3D, l'avatar, la webcam, la voix et le chat.

import * as THREE from "three";
import { state } from "./state.js";
import { createScene } from "./scene.js";
import { loadRiggedAvatar } from "./avatars.js";
import { createTracker } from "./tracking.js";
import { isVoiceSupported, createListener, createSpeaker } from "./voice.js";
import { createChat } from "./chat.js";
import { t } from "./i18n.js";

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
// Bulle basse (clavier du mobile ouvert) : gros plan sur la tête. Même seuil que le CSS.
const COMPACT = window.matchMedia("(max-height: 400px)");
const COMPACT_TARGET_OFFSET = new THREE.Vector3(0, 0.36, 0);
const COMPACT_ZOOM = 0.4;
const framingTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3(0, 0.95, 0);
const cameraDirection = new THREE.Vector3(0, 1.0, 4.9).normalize();
let cameraDistance = 2.1;

let avatar = null;
// Indicateur de chargement : le modèle 3D (~2,5 Mo) prend quelques secondes sur mobile
const loaderEl = document.getElementById("loader");
const loaderBar = loaderEl.querySelector(".loader-bar span");
const loaderText = loaderEl.querySelector("p");

function showProgress(fraction) {
  const percent = Math.round(fraction * 100);
  loaderBar.style.width = `${percent}%`;
  loaderText.textContent = percent < 100 ? t("loadingPercent", { percent }) : t("preparing");
}

setStatus(t("loadingAvatar"));
loadRiggedAvatar("./models/avatar.glb", showProgress)
  .then((loaded) => {
    avatar = loaded;
    scene.add(avatar.root);
    if (!chat.restored) avatar.wave(); // pas de nouveau salut à chaque page visitée
    loaderEl.classList.add("done");
    setStatus(t("ready"));
  })
  .catch((err) => {
    console.error("❌ Erreur chargement avatar.glb", err);
    loaderEl.classList.add("error");
    loaderText.textContent = t("avatarError");
    setStatus(t("avatarErrorShort"));
  });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (avatar) {
    framingTarget.copy(avatar.framing.target);
    const compact = EMBED && COMPACT.matches;
    if (EMBED) framingTarget.add(compact ? COMPACT_TARGET_OFFSET : EMBED_TARGET_OFFSET);
    const distance = avatar.framing.distance * (compact ? COMPACT_ZOOM : EMBED ? EMBED_ZOOM : 1);
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
  setStatus(t("modeAssistantOn"));
});
modeButtons.miroir.addEventListener("click", () => {
  setMode("miroir");
  setStatus(t("modeMirrorOn"));
});
setMode(state.mode);

// ====== Webcam (à la demande) ======
const tracker = createTracker(trackingSlot, state);

function setTrackingUI(active) {
  document.body.classList.toggle("tracking", active);
  camBtn.classList.toggle("active", active);
  camBtn.textContent = t(active ? "camOff" : "camOn");
}

camBtn.addEventListener("click", async () => {
  if (tracker.active) {
    tracker.stop();
    setTrackingUI(false);
    setStatus(t("camStopped"));
    return;
  }
  camBtn.disabled = true;
  setStatus(t("camStarting"));
  // L'aperçu s'affiche dès le démarrage : la page de suivi a besoin d'être visible pour tourner
  document.body.classList.add("tracking");
  try {
    await tracker.start();
    setTrackingUI(true);
    setStatus(t("camRunning"));
  } catch (err) {
    console.error("Erreur suivi webcam :", err);
    setTrackingUI(false);
    setStatus(t(err.name === "NotAllowedError" ? "camRefused" : "camError"));
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

// Micro refusé : on explique quoi faire. Dans la bulle d'un autre site, le micro passe par
// une délégation que certains navigateurs mobiles refusent : on propose alors d'écrire,
// sans quitter la bulle (plus de lien vers un autre onglet, choix du 06/10/2026).
function showMicBlocked() {
  setStatus(t(EMBED ? "micBlockedEmbed" : "micBlocked"));
  if (EMBED) chatInput.focus();
}

let listener = null;
if (!isVoiceSupported()) {
  talkBtn.disabled = true;
  setStatus(t("voiceUnsupported"));
} else {
  listener = createListener({
    state,
    onText: (text) => {
      setStatus(t("youSaid", { text }));
      handleText(text);
    },
    onStatus: (text, listening, error) => {
      if (error === "not-allowed") showMicBlocked();
      else setStatus(text);
      talkBtn.textContent = t(listening ? "talkOff" : "talkOn");
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
