// tracking.js — suivi webcam à la demande.
//
// MediaPipe tourne dans une page isolée (tracking.html), chargée dans une iframe
// uniquement quand le visiteur active le suivi : elle seule a besoin d'eval(), ce qui
// permet à la page principale de garder une CSP stricte (backend/security.js).
// L'iframe envoie des mesures brutes ; on y applique ici la posture neutre et le gain.
// Supprimer l'iframe coupe la caméra.

const FRAME_URL = "/tracking.html";
const START_TIMEOUT = 30000; // ms : premier chargement des modèles MediaPipe compris

// Temps (s) pour que la position neutre de la tête s'adapte à ta posture
const NEUTRAL_ADAPT_SECONDS = 4;

function resetPose(state) {
  state.head.yaw = 0;
  state.head.pitch = 0;
  for (const arm of Object.values(state.arms)) {
    arm.raised = false;
    arm.elbowBend = 0;
  }
}

// container : élément où afficher l'aperçu de la webcam (l'iframe)
export function createTracker(container, state) {
  let frame = null;
  const neutral = { yaw: 0, pitch: 0, time: 0 };

  function onFace({ yaw, pitch }) {
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

  function onPose({ arms }) {
    for (const side of ["left", "right"]) {
      const arm = arms?.[side];
      if (!arm) continue;
      state.arms[side].raised = Boolean(arm.raised);
      state.arms[side].elbowBend = Number(arm.elbowBend) || 0;
    }
  }

  let unlisten = null;

  function stop() {
    if (!frame) return;
    unlisten?.();
    unlisten = null;
    frame.remove(); // décharge la page : la caméra s'éteint
    frame = null;
    neutral.time = 0;
    resetPose(state);
  }

  return {
    get active() {
      return frame !== null;
    },
    stop,
    start() {
      if (frame) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        iframe.src = FRAME_URL;
        iframe.title = "Aperçu de la webcam";
        iframe.allow = "camera";

        const timer = setTimeout(() => fail("TimeoutError"), START_TIMEOUT);
        function fail(name) {
          stop();
          const err = new Error("Échec du suivi webcam");
          err.name = name;
          reject(err);
        }

        // Seuls les messages de NOTRE iframe, de notre origine, sont pris en compte
        function onMessage(event) {
          if (event.source !== iframe.contentWindow || event.origin !== location.origin) return;
          const data = event.data;
          if (data?.type !== "r3d:tracking") return;
          if (data.event === "face") onFace(data);
          else if (data.event === "pose") onPose(data);
          else if (data.event === "ready") {
            clearTimeout(timer);
            resolve();
          } else if (data.event === "error") fail(String(data.name));
        }

        window.addEventListener("message", onMessage);
        unlisten = () => {
          clearTimeout(timer);
          window.removeEventListener("message", onMessage);
        };
        frame = iframe;
        container.appendChild(iframe);
      });
    },
  };
}
