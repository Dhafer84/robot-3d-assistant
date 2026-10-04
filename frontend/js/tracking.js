// tracking.js — webcam + MediaPipe (FaceMesh pour la tête, Pose pour les bras).
// Les scripts MediaPipe sont chargés en global depuis index.html.

const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe";

// Indices MediaPipe Pose
const LANDMARKS = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
};

// Indices MediaPipe FaceMesh
const NOSE = 1;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;

// Angle du coude (0 = bras tendu), en ignorant les petits angles et borné à ~100°
function computeElbowBend(shoulder, elbow, wrist) {
  const u = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y, z: elbow.z - shoulder.z };
  const v = { x: wrist.x - elbow.x, y: wrist.y - elbow.y, z: wrist.z - elbow.z };
  const du = Math.hypot(u.x, u.y, u.z);
  const dv = Math.hypot(v.x, v.y, v.z);
  if (du < 1e-5 || dv < 1e-5) return 0;

  const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y + u.z * v.z) / (du * dv)));
  const angle = Math.acos(cos);
  const min = (25 * Math.PI) / 180;
  const max = (100 * Math.PI) / 180;
  return Math.max(0, Math.min(angle - min, max - min));
}

function onFaceResults(results, state) {
  const face = results.multiFaceLandmarks?.[0];
  if (!face || face.length <= RIGHT_EAR) return;

  const nose = face[NOSE];
  const earsY = (face[LEFT_EAR].y + face[RIGHT_EAR].y) / 2;

  // Le mode miroir amplifie les mouvements, le mode assistant les adoucit
  const gain = state.mode === "miroir" ? 1.2 : 0.5;
  state.head.yaw = (nose.x - 0.5) * 2 * gain;
  state.head.pitch = (nose.y - earsY) * 2 * gain;
}

function onPoseResults(results, state) {
  const lm = results.poseLandmarks;
  if (!lm) return;

  for (const side of ["left", "right"]) {
    const ids = LANDMARKS[side];
    const shoulder = lm[ids.shoulder];
    const elbow = lm[ids.elbow];
    const wrist = lm[ids.wrist];
    if (!shoulder || !elbow || !wrist) continue;

    // y plus petit = plus haut dans l'image
    state.arms[side].raised = wrist.y < shoulder.y - 0.05;
    state.arms[side].elbowBend = computeElbowBend(shoulder, elbow, wrist);
  }
}

export async function startTracking(videoElement, state) {
  if (!window.FaceMesh || !window.Camera) {
    throw new Error("Scripts MediaPipe non chargés");
  }

  const faceMesh = new window.FaceMesh({ locateFile: (file) => `${MEDIAPIPE_CDN}/face_mesh/${file}` });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults((results) => onFaceResults(results, state));

  let pose = null;
  if (window.Pose) {
    pose = new window.Pose({ locateFile: (file) => `${MEDIAPIPE_CDN}/pose/${file}` });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults((results) => onPoseResults(results, state));
  } else {
    console.warn("MediaPipe Pose introuvable : le suivi des bras est désactivé.");
  }

  // camera_utils gère getUserMedia et envoie chaque image aux modèles
  const camera = new window.Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
      if (pose) await pose.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });
  await camera.start();
}
