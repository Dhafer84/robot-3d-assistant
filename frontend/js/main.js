// main.js — point d'entrée : relie la scène 3D, les avatars, la webcam et la voix.

import * as THREE from "three";
import { state } from "./state.js";
import { createScene } from "./scene.js";
import { createCubeRobot, loadHumanoid } from "./avatars.js";
import { startTracking } from "./tracking.js";
import { isVoiceSupported, createListener, askAssistant, speak } from "./voice.js";

const sceneContainer = document.getElementById("scene-container");
const videoElement = document.getElementById("inputVideo");
const answerEl = document.getElementById("answer");
const statusEl = document.getElementById("status");
const talkBtn = document.getElementById("talkBtn");
const avatarBtn = document.getElementById("avatarBtn");
const modeButtons = {
  assistant: document.getElementById("modeAssistantBtn"),
  miroir: document.getElementById("modeMiroirBtn"),
};

const setStatus = (text) => (statusEl.textContent = text);

// ====== Scène et avatars ======
const { scene, camera, renderer } = createScene(sceneContainer);

const avatars = { robot: createCubeRobot(), humanoid: null };
scene.add(avatars.robot.root);

let avatarChoice = "humanoid";
try {
  avatarChoice = localStorage.getItem("avatar") || avatarChoice;
} catch {}

function showAvatar(choice) {
  // Tant que l'humanoïde n'est pas chargé, on affiche le robot
  avatarChoice = choice;
  const active = choice === "humanoid" && avatars.humanoid ? "humanoid" : "robot";
  avatars.robot.root.visible = active === "robot";
  if (avatars.humanoid) avatars.humanoid.root.visible = active === "humanoid";
  avatarBtn.textContent = choice === "humanoid" ? "🧍 Humanoïde" : "🤖 Robot";
  try {
    localStorage.setItem("avatar", choice);
  } catch {}
}

avatarBtn.addEventListener("click", () => {
  showAvatar(avatarChoice === "humanoid" ? "robot" : "humanoid");
});

showAvatar(avatarChoice);

loadHumanoid("./models/humanoid.glb")
  .then((humanoid) => {
    avatars.humanoid = humanoid;
    scene.add(humanoid.root);
    showAvatar(avatarChoice);
  })
  .catch((err) => {
    console.error("❌ Erreur chargement humanoid.glb", err);
    avatarBtn.disabled = true;
  });

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const avatar of Object.values(avatars)) {
    if (avatar?.root.visible) avatar.update(dt, state);
  }
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

// ====== Voix ======
async function handleText(text) {
  setStatus(`Tu as dit : « ${text} »`);

  if (state.mode === "miroir") {
    answerEl.textContent = `Je répète : ${text}`;
    speak(text, state);
    return;
  }

  answerEl.textContent = "Je réfléchis à ta question… 🤔";
  const reply = await askAssistant(text);
  answerEl.textContent = reply;
  speak(reply, state);
}

if (!isVoiceSupported()) {
  talkBtn.disabled = true;
  setStatus("Reconnaissance vocale non supportée : utilise Chrome ou Edge.");
} else {
  const listener = createListener({
    state,
    onText: handleText,
    onStatus: (text, listening) => {
      setStatus(text);
      talkBtn.textContent = listening ? "⏹️ Stop écoute" : "🎙️ Activer écoute auto";
    },
  });
  talkBtn.addEventListener("click", () => listener.toggle());
}
