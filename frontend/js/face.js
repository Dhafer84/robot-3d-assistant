// face.js — visage animé de l'avatar : yeux dessinés dans les verres, émotions et lip-sync.
//
// Les verres des lunettes sont des "écrans" (meshes Lens_L / Lens_R) : on y dessine
// un œil sur un canvas, ce qui permet regard, clignements et expressions sans
// déformer le visage. La bouche est pilotée par les morph targets MouthOpen / MouthSmile.

import * as THREE from "three";

const CANVAS_W = 256;
const CANVAS_H = 224; // même proportion que les verres
const EMOTION_DURATION = 6; // secondes d'expression après la fin de la parole

// Forme de l'œil et de la bouche pour chaque émotion
//   open : ouverture de l'œil · pupil : taille de la pupille · cheek : paupière inférieure
//   (sourire des yeux) · droop : paupière supérieure tombante côté extérieur (tristesse)
//   lookX/lookY : direction du regard · smile / mouth : morph targets de la bouche au repos
const EXPRESSIONS = {
  neutre: { open: 1, pupil: 1, cheek: 0.15, droop: 0, lookX: 0, lookY: 0, smile: 0.3, mouth: 0 },
  joie: { open: 0.95, pupil: 1.1, cheek: 0.65, droop: 0, lookX: 0, lookY: -0.15, smile: 0.9, mouth: 0 },
  reflexion: { open: 0.82, pupil: 1, cheek: 0.1, droop: 0.15, lookX: 0.55, lookY: -0.6, smile: 0.1, mouth: 0 },
  surprise: { open: 1.2, pupil: 0.7, cheek: 0, droop: 0, lookX: 0, lookY: 0, smile: 0, mouth: 0.3 },
  desole: { open: 0.85, pupil: 1, cheek: 0, droop: 0.9, lookX: 0, lookY: 0.35, smile: 0, mouth: 0 },
};

function randomBlinkDelay() {
  return 2.5 + Math.random() * 3.5;
}

// Émotion à afficher : celle de la réponse tant qu'il parle (et un peu après), sinon neutre
function currentEmotion(state) {
  if (state.thinking) return "reflexion";
  const age = performance.now() / 1000 - state.emotionAt;
  if (state.isSpeaking || age < EMOTION_DURATION) return EXPRESSIONS[state.emotion] ? state.emotion : "neutre";
  return "neutre";
}

function createExpressionTracker() {
  const current = { ...EXPRESSIONS.neutre };
  return {
    current,
    update(dt, state) {
      const target = EXPRESSIONS[currentEmotion(state)];
      for (const key of Object.keys(current)) {
        current[key] = THREE.MathUtils.damp(current[key], target[key], 6, dt);
      }
    },
  };
}

// innerOnLeft : le côté intérieur de l'œil (vers le nez) est-il à gauche du canvas ?
function createEyeCanvas(innerOnLeft) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // convention des UV glTF

  function draw(time, e, blink, gaze) {
    const w = CANVAS_W;
    const h = CANVAS_H;
    const cx0 = w / 2;
    const cy0 = h / 2;

    // Fond : verre bleu sombre avec un léger motif de circuit
    const bg = ctx.createRadialGradient(cx0, cy0, 10, cx0, cy0, w * 0.75);
    bg.addColorStop(0, "#1e4f8f");
    bg.addColorStop(1, "#071a36");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120, 190, 255, 0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 36 + Math.sin(time * 0.6 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w * 0.3, y);
      ctx.lineTo(w * 0.36, y + 12);
      ctx.lineTo(w, y + 12);
      ctx.stroke();
    }

    const rx = 82;
    const ry = 70 * Math.max(e.open * (1 - blink), 0.04);
    const cx = cx0 + gaze.x * 26;
    const cy = cy0 + gaze.y * 18;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#e8f3ff";
    ctx.fillRect(0, 0, w, h);

    const iris = ctx.createRadialGradient(cx, cy, 6, cx, cy, 46);
    iris.addColorStop(0, "#9fd8ff");
    iris.addColorStop(0.55, "#2f8cff");
    iris.addColorStop(1, "#0b3f9a");
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#06122a";
    ctx.beginPath();
    ctx.arc(cx, cy, 20 * e.pupil, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(cx - 15, cy - 16, 9, 0, Math.PI * 2);
    ctx.fill();

    // Paupière inférieure qui remonte : les yeux "sourient"
    ctx.fillStyle = "#123a6e";
    if (e.cheek > 0.01) {
      ctx.beginPath();
      ctx.ellipse(cx0, cy0 + 150 - e.cheek * 100, 95, 80, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Paupière supérieure tombante vers l'extérieur : air désolé
    if (e.droop > 0.01) {
      const innerX = innerOnLeft ? 0 : w;
      const outerX = innerOnLeft ? w : 0;
      ctx.beginPath();
      ctx.moveTo(innerX, 0);
      ctx.lineTo(innerX, cy0 - ry + e.droop * ry * 0.15);
      ctx.lineTo(outerX, cy0 - ry + e.droop * ry * 0.95);
      ctx.lineTo(outerX, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Contour lumineux de l'œil
    ctx.strokeStyle = "rgba(140, 210, 255, 0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx0, cy0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    texture.needsUpdate = true;
  }

  return { texture, draw };
}

// lensMeshes : les verres ; le verre du côté +X (Lens_L) a son côté intérieur à gauche du canvas
export function createLensEyes(lensMeshes) {
  const eyes = lensMeshes.map((mesh) => {
    const eye = createEyeCanvas(mesh.name === "Lens_L");
    // Matériau non éclairé : l'écran "brille" comme sur l'image de référence
    mesh.material = new THREE.MeshBasicMaterial({ map: eye.texture, toneMapped: false });
    return eye;
  });

  const expression = createExpressionTracker();
  let blink = 0; // 0 = ouvert, 1 = fermé
  let nextBlink = randomBlinkDelay();
  let blinkTime = -1;
  const gaze = { x: 0, y: 0 };

  return {
    expression: expression.current,
    // lookX / lookY dans [-1, 1] : compensation de la rotation de la tête
    update(dt, state, { lookX, lookY }) {
      const time = performance.now() / 1000;
      expression.update(dt, state);
      const e = expression.current;

      nextBlink -= dt;
      if (nextBlink <= 0 && blinkTime < 0) blinkTime = 0;
      if (blinkTime >= 0) {
        blinkTime += dt;
        const duration = 0.16;
        blink = Math.sin(Math.min(blinkTime / duration, 1) * Math.PI);
        if (blinkTime >= duration) {
          blinkTime = -1;
          blink = 0;
          nextBlink = randomBlinkDelay();
        }
      }

      // En réflexion, le regard erre doucement
      const wander = state.thinking ? Math.sin(time * 1.3) * 0.25 : 0;
      const targetX = THREE.MathUtils.clamp(lookX + e.lookX + wander, -1, 1);
      const targetY = THREE.MathUtils.clamp(lookY + e.lookY, -1, 1);
      gaze.x = THREE.MathUtils.damp(gaze.x, targetX, 8, dt);
      gaze.y = THREE.MathUtils.damp(gaze.y, targetY, 8, dt);

      for (const eye of eyes) eye.draw(time, e, blink, gaze);
    },
  };
}

// Bouche : avec la voix Piper, elle suit le volume réel du son ; avec la voix du navigateur
// (sans accès au son), on simule des syllabes et elle se referme brièvement à chaque mot.
export function createLipSync(mesh, expression) {
  const open = mesh.morphTargetDictionary?.MouthOpen;
  const smile = mesh.morphTargetDictionary?.MouthSmile;
  let value = 0;

  return {
    update(dt, state) {
      const t = performance.now() / 1000;
      let target = expression?.mouth ?? 0;
      if (state.isSpeaking && state.audioDriven) {
        target = Math.min(1, Math.sqrt(state.voiceLevel) * 1.1);
      } else if (state.isSpeaking) {
        const syllables = Math.max(0, Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 3.7));
        const sinceWord = t - (state.lastWordAt || 0);
        const wordGap = sinceWord < 0.06 ? 0.3 : 1;
        target = (0.15 + 0.7 * syllables) * wordGap;
      }
      value = THREE.MathUtils.damp(value, target, 25, dt);
      if (open !== undefined) mesh.morphTargetInfluences[open] = value;
      if (smile !== undefined) {
        // En parlant, le sourire est atténué pour ne pas gêner l'ouverture de la bouche
        const smileTarget = (expression?.smile ?? 0.3) * (state.isSpeaking ? 0.6 : 1);
        mesh.morphTargetInfluences[smile] = THREE.MathUtils.damp(
          mesh.morphTargetInfluences[smile], smileTarget, 4, dt
        );
      }
    },
  };
}
