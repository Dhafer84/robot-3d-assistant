// tracking-frame.js — tourne dans tracking.html (iframe isolée, voir ce fichier).
// Analyse la webcam avec MediaPipe et envoie à la page principale des mesures brutes :
//   { type: "r3d:tracking", event: "ready" | "error" | "face" | "pose", ... }

(() => {
  const MEDIAPIPE = "/vendor/mediapipe";

  // Indices MediaPipe Pose
  const LANDMARKS = {
    left: { shoulder: 11, elbow: 13, wrist: 15 },
    right: { shoulder: 12, elbow: 14, wrist: 16 },
  };

  // Indices MediaPipe FaceMesh
  const NOSE = 1;
  const LEFT_EAR = 234;
  const RIGHT_EAR = 454;

  const video = document.getElementById("video");

  // camera_utils affiche une alerte quand la caméra est refusée : la page principale
  // l'annonce déjà dans sa barre d'état.
  window.alert = () => {};

  function send(message) {
    window.parent.postMessage({ type: "r3d:tracking", ...message }, location.origin);
  }

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

  function onFaceResults(results) {
    const face = results.multiFaceLandmarks?.[0];
    if (!face || face.length <= RIGHT_EAR) return;

    const nose = face[NOSE];
    const left = face[LEFT_EAR];
    const right = face[RIGHT_EAR];
    const earDistance = Math.hypot(right.x - left.x, right.y - left.y);
    if (earDistance < 1e-3) return;

    // Rotation de la tête : position du nez par rapport aux oreilles (et non par rapport
    // au centre de l'image), pour que l'avatar regarde en face même si tu n'es pas centré.
    send({
      event: "face",
      yaw: ((nose.x - (left.x + right.x) / 2) / earDistance) * 2,
      pitch: (nose.y - (left.y + right.y) / 2) / earDistance,
    });
  }

  function onPoseResults(results) {
    const lm = results.poseLandmarks;
    if (!lm) return;

    const arms = {};
    for (const side of ["left", "right"]) {
      const ids = LANDMARKS[side];
      const shoulder = lm[ids.shoulder];
      const elbow = lm[ids.elbow];
      const wrist = lm[ids.wrist];
      if (!shoulder || !elbow || !wrist) continue;
      // y plus petit = plus haut dans l'image
      arms[side] = {
        raised: wrist.y < shoulder.y - 0.05,
        elbowBend: computeElbowBend(shoulder, elbow, wrist),
      };
    }
    send({ event: "pose", arms });
  }

  const faceMesh = new FaceMesh({ locateFile: (file) => `${MEDIAPIPE}/face_mesh/${file}` });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults(onFaceResults);

  const pose = new Pose({ locateFile: (file) => `${MEDIAPIPE}/pose/${file}` });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  pose.onResults(onPoseResults);

  // camera_utils gère getUserMedia et envoie chaque image aux modèles
  const camera = new Camera(video, {
    onFrame: async () => {
      await faceMesh.send({ image: video });
      await pose.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  camera
    .start()
    .then(() => send({ event: "ready" }))
    .catch((err) => send({ event: "error", name: err?.name || "Error" }));
})();
