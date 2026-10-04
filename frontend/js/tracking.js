// tracking.js — webcam + MediaPipe (FaceMesh pour la tête, Pose pour les bras).

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

// Temps (s) pour que la position neutre de la tête s'adapte à ta posture
const NEUTRAL_ADAPT_SECONDS = 4;
const neutral = { yaw: 0, pitch: 0, time: 0 };

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
  const left = face[LEFT_EAR];
  const right = face[RIGHT_EAR];
  const earsX = (left.x + right.x) / 2;
  const earsY = (left.y + right.y) / 2;
  const earDistance = Math.hypot(right.x - left.x, right.y - left.y);
  if (earDistance < 1e-3) return;

  // Rotation de la tête : position du nez par rapport aux oreilles (et non par rapport
  // au centre de l'image), pour que l'avatar regarde en face même si tu n'es pas centré.
  const yaw = ((nose.x - earsX) / earDistance) * 2;
  const pitch = (nose.y - earsY) / earDistance;

  // Position neutre apprise lentement : seuls les mouvements par rapport à ta posture
  // habituelle sont reproduits, et l'avatar revient regarder en face si tu restes tourné.
  const now = performance.now() / 1000;
  const dt = neutral.time ? Math.min(now - neutral.time, 1) : 1;
  const k = neutral.time ? 1 - Math.exp(-dt / NEUTRAL_ADAPT_SECONDS) : 1;
  neutral.yaw += (yaw - neutral.yaw) * k;
  neutral.pitch += (pitch - neutral.pitch) * k;
  neutral.time = now;

  const gain = state.mode === "miroir" ? 1.2 : 0.5; // miroir amplifie, assistant adoucit
  state.head.yaw = (yaw - neutral.yaw) * gain;
  state.head.pitch = (pitch - neutral.pitch) * gain;
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

const MEDIAPIPE_SCRIPTS = ["face_mesh/face_mesh.js", "pose/pose.js", "camera_utils/camera_utils.js"];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Échec du chargement de ${src}`));
    document.head.appendChild(script);
  });
}

function resetPose(state) {
  state.head.yaw = 0;
  state.head.pitch = 0;
  for (const arm of Object.values(state.arms)) {
    arm.raised = false;
    arm.elbowBend = 0;
  }
}

// Suivi webcam activé à la demande : les scripts et modèles MediaPipe (plusieurs Mo) ne sont
// téléchargés qu'au premier démarrage, et la caméra est vraiment libérée à l'arrêt.
export function createTracker(videoElement, state) {
  let models = null;
  let camera = null;

  async function loadModels() {
    if (!window.FaceMesh) await Promise.all(MEDIAPIPE_SCRIPTS.map((f) => loadScript(`${MEDIAPIPE_CDN}/${f}`)));

    const faceMesh = new window.FaceMesh({ locateFile: (file) => `${MEDIAPIPE_CDN}/face_mesh/${file}` });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults((results) => onFaceResults(results, state));

    const pose = new window.Pose({ locateFile: (file) => `${MEDIAPIPE_CDN}/pose/${file}` });
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    pose.onResults((results) => onPoseResults(results, state));

    return { faceMesh, pose };
  }

  return {
    get active() {
      return camera !== null;
    },
    async start() {
      if (camera) return;
      models ??= await loadModels();
      // camera_utils gère getUserMedia et envoie chaque image aux modèles
      const cam = new window.Camera(videoElement, {
        onFrame: async () => {
          if (camera !== cam) return;
          await models.faceMesh.send({ image: videoElement });
          await models.pose.send({ image: videoElement });
        },
        width: 640,
        height: 480,
      });
      camera = cam;
      try {
        await cam.start();
      } catch (err) {
        camera = null;
        throw err;
      }
    },
    stop() {
      if (!camera) return;
      camera.stop();
      camera = null;
      videoElement.srcObject?.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
      resetPose(state);
    },
  };
}
