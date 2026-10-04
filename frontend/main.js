import * as THREE from "three"; // utilise l'importmap dans index.html
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

console.log("🔥 main.js chargé, THREE =", THREE);


// ====== Sélection des éléments DOM ======
const sceneContainer = document.getElementById("scene-container");
const videoElement = document.getElementById("inputVideo");
const answerEl = document.getElementById("answer");
const statusEl = document.getElementById("status");
const talkBtn = document.getElementById("talkBtn");
const modeAssistantBtn = document.getElementById("modeAssistantBtn");
const modeMiroirBtn = document.getElementById("modeMiroirBtn");

// ====== État global ======
let mode = "assistant";
let isSpeaking = false;        // bouche qui bouge quand il parle
let isListening = false;       // écoute continue ON/OFF
/*let rightArm = null;
let leftArm = null;
let rightArmTargetAngle = 0;
let leftArmTargetAngle = 0;   // ➕ pour le bras gauche
let recognition = null;        // instance SpeechRecognition
let pose = null;               // instance Pose (MediaPipe)
*/
let rightShoulderPivot = null;
let leftShoulderPivot = null;
let rightUpperArm = null;
let leftUpperArm = null;
let rightElbowPivot = null;
let leftElbowPivot = null;
let rightForeArm = null;
let leftForeArm = null;

let rightShoulderTargetX = 0;
let leftShoulderTargetX = 0;
let rightElbowTargetX = 0;
let leftElbowTargetX = 0;

let recognition = null;       // instance SpeechRecognition
let pose = null;              // instance Pose (MediaPipe)
// ====== Humanoïde GLB ======
let humanoid = null;
let humanoidHead = null;
let humanoidLeftUpperArm = null;
let humanoidRightUpperArm = null;

// Pose de base des bras de l'humanoïde
let humanoidLeftUpperArmBaseRot  = new THREE.Euler();
let humanoidRightUpperArmBaseRot = new THREE.Euler();

// États "bras levés" détectés par MediaPipe
let humanoidLeftArmRaised  = false;
let humanoidRightArmRaised = false;

// ====== Gestion des modes Assistant / Miroir ======
function updateModeUI() {
  modeAssistantBtn.classList.toggle("active", mode === "assistant");
  modeMiroirBtn.classList.toggle("active", mode === "miroir");
}

modeAssistantBtn.addEventListener("click", () => {
  mode = "assistant";
  statusEl.textContent = "Mode Assistant IA sélectionné.";
  updateModeUI();
});

modeMiroirBtn.addEventListener("click", () => {
  mode = "miroir";
  statusEl.textContent = "Mode Miroir (je répète tout) sélectionné.";
  updateModeUI();
});

updateModeUI();

// ====== 1) Scène 3D avec robot ======
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);

const camera = new THREE.PerspectiveCamera(
  45,
  sceneContainer.clientWidth / sceneContainer.clientHeight,
  0.1,
  100
);

// Caméra un peu plus haute et plus loin
camera.position.set(0, 2.2, 5);
// On regarde légèrement vers le bas, au centre du robot
camera.lookAt(0, 0.8, 0);


const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
sceneContainer.appendChild(renderer.domElement);

// Lumière
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);

// --- Corps du robot ---
const bodyGeometry = new THREE.BoxGeometry(1.2, 1.5, 0.8);
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x111827,
  metalness: 0.3,
  roughness: 0.5,
});
const robotBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
scene.add(robotBody);
// ====== Chargement de l'humanoïde GLB ======
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  "./models/humanoid.glb",
  (gltf) => {
    console.log("✅ Humanoïde GLB chargé brut :", gltf);
    humanoid = gltf.scene;

    // Position globale du perso
    humanoid.position.set(0, 0.9, 0.6);
    humanoid.scale.set(0.9, 0.9, 0.9);

   // Recherche des bones intéressants
// Recherche des bones intéressants
humanoid.traverse((obj) => {
  const name = (obj.name || "").toLowerCase();

  if (name.includes("head") && !humanoidHead) {
    humanoidHead = obj;
    console.log("🧠 Tête:", obj.name);
  }

  // BRAS GAUCHE
  // BRAS GAUCHE
if (name.includes("leftarm") && !humanoidLeftUpperArm) {
  humanoidLeftUpperArm = obj;
  console.log("💪 Bras gauche:", obj.name);

  // ❌ NE PAS modifier la rotation ici
  humanoidLeftUpperArmBaseRot.copy(humanoidLeftUpperArm.rotation);
}

// BRAS DROIT
if (name.includes("rightarm") && !humanoidRightUpperArm) {
  humanoidRightUpperArm = obj;
  console.log("💪 Bras droit:", obj.name);

  // ❌ NE PAS modifier la rotation ici non plus
  humanoidRightUpperArmBaseRot.copy(humanoidRightUpperArm.rotation);
}

});

   // scene.add(humanoid);
    console.log("✅ Humanoïde ajouté à la scène.");
  },
  (xhr) => {
    if (xhr.total) {
      console.log(
        "Humanoïde chargé à",
        ((xhr.loaded / xhr.total) * 100).toFixed(0),
        "%"
      );
    }
  },
  (error) => {
    console.error("❌ Erreur chargement humanoid.glb", error);
  }
);


// --- Tête du robot ---
const headGeometry = new THREE.BoxGeometry(1, 1, 1);
const headMaterial = new THREE.MeshStandardMaterial({
  metalness: 0.4,
  roughness: 0.3,
});
const robotHead = new THREE.Mesh(headGeometry, headMaterial);
robotHead.position.set(0, 1.2, 0);
robotBody.add(robotHead);

// --- Bouche ---
const mouthGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.05);
const mouthMaterial = new THREE.MeshStandardMaterial({
  color: 0x222222,
  metalness: 0.2,
  roughness: 0.6,
});
const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
mouth.position.set(0, -0.25, 0.51);
robotHead.add(mouth);

// --- Bras droit & gauche (avec épaule + coude) ---
const upperArmGeometry = new THREE.BoxGeometry(0.3, 0.7, 0.3);
const foreArmGeometry  = new THREE.BoxGeometry(0.25, 0.7, 0.25);
const armMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f2937,
  metalness: 0.3,
  roughness: 0.6,
});

// Bras droit
rightShoulderPivot = new THREE.Object3D();
rightShoulderPivot.position.set(0.9, 0.1, 0);   // position de l'épaule
robotBody.add(rightShoulderPivot);

rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
// on place le centre du bras sous l'épaule
rightUpperArm.position.set(0, -0.35, 0);
rightShoulderPivot.add(rightUpperArm);

rightElbowPivot = new THREE.Object3D();
// le coude est au bas du bras
rightElbowPivot.position.set(0, -0.35, 0);
rightUpperArm.add(rightElbowPivot);

rightForeArm = new THREE.Mesh(foreArmGeometry, armMaterial);
// centre de l'avant-bras sous le coude
rightForeArm.position.set(0, -0.35, 0);
rightElbowPivot.add(rightForeArm);

// Bras gauche (miroir)
leftShoulderPivot = new THREE.Object3D();
leftShoulderPivot.position.set(-0.9, 0.1, 0);
robotBody.add(leftShoulderPivot);

leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
leftUpperArm.position.set(0, -0.35, 0);
leftShoulderPivot.add(leftUpperArm);

leftElbowPivot = new THREE.Object3D();
leftElbowPivot.position.set(0, -0.35, 0);
leftUpperArm.add(leftElbowPivot);

leftForeArm = new THREE.Mesh(foreArmGeometry, armMaterial);
leftForeArm.position.set(0, -0.35, 0);
leftElbowPivot.add(leftForeArm);


// Animation
function animate() {
  requestAnimationFrame(animate);

  // léger mouvement "idle" de la tête
  robotHead.rotation.z = Math.sin(Date.now() * 0.001) * 0.05;

  // Bouche : ouvrir/fermer quand il parle
  if (isSpeaking) {
    const t = Date.now() * 0.02;
    const scale = 0.6 + 0.4 * Math.abs(Math.sin(t));
    mouth.scale.y = scale;
  } else {
    mouth.scale.y = 1.0;
  }

  /// Bras droit : épaule + coude
if (rightShoulderPivot && rightElbowPivot) {
  rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(
    rightShoulderPivot.rotation.x,
    rightShoulderTargetX,
    0.25
  );

  rightElbowPivot.rotation.x = THREE.MathUtils.lerp(
    rightElbowPivot.rotation.x,
    rightElbowTargetX,
    0.25
  );
}

// Bras gauche : épaule + coude
if (leftShoulderPivot && leftElbowPivot) {
  leftShoulderPivot.rotation.x = THREE.MathUtils.lerp(
    leftShoulderPivot.rotation.x,
    leftShoulderTargetX,
    0.25
  );

  leftElbowPivot.rotation.x = THREE.MathUtils.lerp(
    leftElbowPivot.rotation.x,
    leftElbowTargetX,
    0.25
  );
}
  // ====== Synchronisation humanoïde / robot cubes ======
  // Tête de l'humanoïde suit le cube
// ====== Synchronisation humanoïde / robot cubes ======
// Tête de l'humanoïde suit le cube
if (humanoidHead) {
  humanoidHead.rotation.x = robotHead.rotation.x;
  humanoidHead.rotation.y = robotHead.rotation.y;
  humanoidHead.rotation.z = robotHead.rotation.z;
}

// Bras de l'humanoïde : on part de la pose de repos,
// puis on ajoute un angle si le bras est levé.
// Bras de l'humanoïde : on part de la pose de repos,
// puis on ajoute un angle si le bras est levé.
const HUMANOID_ARM_RAISE = Math.PI / 3; // ≈ 60°

if (humanoidLeftUpperArm) {
  humanoidLeftUpperArm.rotation.copy(humanoidLeftUpperArmBaseRot);
  if (humanoidLeftArmRaised) {
    // lever le bras gauche sur le côté
    humanoidLeftUpperArm.rotation.z -= HUMANOID_ARM_RAISE;
  }
}

if (humanoidRightUpperArm) {
  humanoidRightUpperArm.rotation.copy(humanoidRightUpperArmBaseRot);
  if (humanoidRightArmRaised) {
    // lever le bras droit sur le côté
    humanoidRightUpperArm.rotation.z += HUMANOID_ARM_RAISE;
  }
}




  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
  const width = sceneContainer.clientWidth;
  const height = sceneContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// ====== 2) Webcam + MediaPipe FaceMesh & Pose ======
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
  });
  videoElement.srcObject = stream;
  return new Promise((resolve) => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });
}

// FaceMesh global (via <script> dans index.html)
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

// Pose global (via <script> dans index.html)
if (window.Pose) {
  pose = new Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
function computeElbowBend(shoulder, elbow, wrist) {
  // vecteur épaule -> coude
  const ux = elbow.x - shoulder.x;
  const uy = elbow.y - shoulder.y;
  const uz = elbow.z - shoulder.z;

  // vecteur coude -> poignet
  const vx = wrist.x - elbow.x;
  const vy = wrist.y - elbow.y;
  const vz = wrist.z - elbow.z;

  const du = Math.sqrt(ux*ux + uy*uy + uz*uz);
  const dv = Math.sqrt(vx*vx + vy*vy + vz*vz);
  if (du < 1e-5 || dv < 1e-5) return 0;

  let dot = (ux * vx + uy * vy + uz * vz) / (du * dv);
  dot = Math.min(1, Math.max(-1, dot));

  const angle = Math.acos(dot); // 0 = bras tendu, π = très plié

  // On ignore les petits angles (< 25°) et on borne à ~100°
  const min = (25 * Math.PI) / 180;
  const max = (100 * Math.PI) / 180;
  const bend = Math.max(0, Math.min(angle - min, max - min));

  // On renvoie un angle de rotation pour le robot (0 → ~1.3 rad)
  return bend;
}

  pose.onResults((results) => {
  const lm = results.poseLandmarks;
  if (
    !lm ||
    lm.length < 17 ||
    !rightShoulderPivot ||
    !leftShoulderPivot ||
    !rightElbowPivot ||
    !leftElbowPivot
  ) {
    return;
  }

  // Indices MediaPipe Pose :
  // 11 = épaule gauche, 13 = coude gauche, 15 = poignet gauche
  // 12 = épaule droite, 14 = coude droit, 16 = poignet droit
  const leftShoulder  = lm[11];
  const leftElbow     = lm[13];
  const leftWrist     = lm[15];
  const rightShoulder = lm[12];
  const rightElbow    = lm[14];
  const rightWrist    = lm[16];

  if (!leftShoulder || !leftElbow || !leftWrist ||
      !rightShoulder || !rightElbow || !rightWrist) {
    return;
  }

  // y plus petit = plus haut dans l’image
  const rightHandUp = rightWrist.y < rightShoulder.y - 0.05;
  const leftHandUp  = leftWrist.y  < leftShoulder.y  - 0.05;

  const upAngle   = -Math.PI / 3; // ~ -60° vers le haut
  const downAngle = 0;

  // Épaule : levée de bras
  rightShoulderTargetX = rightHandUp ? upAngle : downAngle;
  leftShoulderTargetX  = leftHandUp  ? upAngle : downAngle;
  // On mémorise aussi l'état pour l'humanoïde
  humanoidRightArmRaised = rightHandUp;
  humanoidLeftArmRaised  = leftHandUp;

  // Coude : flexion en fonction de l’angle réel
  rightElbowTargetX = computeElbowBend(rightShoulder, rightElbow, rightWrist);
  leftElbowTargetX  = computeElbowBend(leftShoulder,  leftElbow,  leftWrist);
});


} else {
  console.warn("Pose global non trouvé (script manquant ?)");
}

// Quand MediaPipe trouve le visage
faceMesh.onResults((results) => {
  const faces = results.multiFaceLandmarks;
  if (!faces || faces.length === 0) return;

  const landmarks = faces[0];
  if (!landmarks || landmarks.length < 455) return;

  const nose = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  if (!nose || !leftEar || !rightEar) return;

  const dy = nose.y - (rightEar.y + leftEar.y) / 2;

  let yaw = (nose.x - 0.5) * 2.0;
  let pitch = dy * 2.0;

  if (mode === "assistant") {
    yaw *= 0.5;
    pitch *= 0.5;
  } else if (mode === "miroir") {
    yaw *= 1.2;
    pitch *= 1.2;
  }

  robotHead.rotation.y = -yaw;
  robotHead.rotation.x = pitch;
});

// Lance la caméra + FaceMesh + Pose
async function startFaceTracking() {
  try {
    await setupCamera();
    const cameraMP = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
        if (pose) {
          await pose.send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });
    cameraMP.start();
    statusEl.textContent = "Caméra, visage & pose actives.";
  } catch (err) {
    console.error("Erreur startFaceTracking:", err);
    statusEl.textContent = "Erreur caméra ou MediaPipe.";
  }
}

startFaceTracking();

// ====== 3) VOIX : Web Speech API + backend Groq ======
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  statusEl.textContent =
    "Reconnaissance vocale non supportée dans ce navigateur.";
} else {
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = true; // écoute en continu

  recognition.onstart = () => {
    statusEl.textContent =
      "Écoute en cours en continu… 🎙️ (parle quand tu veux)";
  };

  recognition.onerror = (e) => {
    console.warn("Erreur reco vocale :", e);

    // Cas fréquent : pas de parole détectée -> on ignore tranquillement
    if (e.error === "no-speech" || e.error === "aborted") {
      if (!isListening) {
        statusEl.textContent = "Écoute arrêtée.";
      }
      return;
    }

    // Vraies erreurs (permission refusée, etc.)
    statusEl.textContent = "Erreur reconnaissance vocale : " + e.error;
    isListening = false;
    talkBtn.textContent = "🎙️ Activer écoute auto";
  };

  recognition.onend = () => {
    if (isListening) {
      // on relance automatiquement si l’écoute auto est active
      recognition.start();
    } else {
      statusEl.textContent = "Écoute arrêtée.";
    }
  };

  recognition.onresult = async (event) => {
    // Si le robot est en train de parler, on ignore ce que le micro entend
    if (isSpeaking) return;

    if (!event || !event.results || event.results.length === 0) {
      console.warn("onresult sans résultats valides :", event);
      return;
    }

    const index =
      typeof event.resultIndex === "number"
        ? event.resultIndex
        : event.results.length - 1;

    const result = event.results[index];
    if (!result || !result[0] || !result[0].transcript) {
      console.warn("Pas de transcript exploitable dans onresult :", result);
      return;
    }

    const text = result[0].transcript.trim();
    if (!text) return;

    statusEl.textContent = `Tu as dit : "${text}"`;

    if (mode === "assistant") {
      answerEl.textContent = "Je réfléchis à ta question… 🤔";
      const reply = await callBackend(text);
      answerEl.textContent = reply;
      speak(reply);
    } else if (mode === "miroir") {
      const mirrorText = `Je répète : ${text}`;
      answerEl.textContent = mirrorText;
      speak(text);
    }
  };
}

// Bouton "Parler" = ON/OFF de l’écoute auto
talkBtn.textContent = "🎙️ Activer écoute auto";

talkBtn.onclick = () => {
  if (!recognition) {
    statusEl.textContent =
      "La reconnaissance vocale n'est pas disponible dans ce navigateur.";
    return;
  }

  if (!isListening) {
    // On démarre l’écoute continue
    isListening = true;
    talkBtn.textContent = "⏹️ Stop écoute";
    recognition.start();
  } else {
    // On coupe le micro
    isListening = false;
    talkBtn.textContent = "🎙️ Activer écoute auto";
    recognition.stop();
  }
};

// Appel backend Groq
async function callBackend(message) {
  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (data.answer) return data.answer;
    if (data.error) return `Erreur backend : ${data.error}`;
    return "Réponse inattendue du backend.";
  } catch (err) {
    console.error("Erreur callBackend:", err);
    return "Erreur de communication avec le cerveau IA.";
  }
}

// Synthèse vocale + bouche
function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "fr-FR";
  utter.rate = 1.0;
  utter.pitch = 1.0;

  utter.onstart = () => {
    isSpeaking = true;
  };

  utter.onend = () => {
    isSpeaking = false;
  };

  speechSynthesis.speak(utter);
}

