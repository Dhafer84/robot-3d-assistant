// face.js — visage animé de l'avatar : yeux dessinés dans les verres + lip-sync.
//
// Les verres des lunettes sont des "écrans" (meshes Lens_L / Lens_R) : on y dessine
// un œil sur un canvas, ce qui permet regard, clignements et expressions sans
// déformer le visage. La bouche est pilotée par les morph targets MouthOpen / MouthSmile.

import * as THREE from "three";

const CANVAS_W = 256;
const CANVAS_H = 224; // même proportion que les verres

function randomBlinkDelay() {
  return 2.5 + Math.random() * 3.5;
}

export function createLensEyes(lensMeshes) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // convention des UV glTF

  // Matériau non éclairé : l'écran "brille" comme sur l'image de référence
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  for (const mesh of lensMeshes) mesh.material = material;

  let blink = 0; // 0 = ouvert, 1 = fermé
  let nextBlink = randomBlinkDelay();
  let blinkTime = -1;
  const gaze = { x: 0, y: 0 };

  function draw(time, smile) {
    const w = CANVAS_W;
    const h = CANVAS_H;

    // Fond : verre bleu sombre avec un léger motif de circuit
    const bg = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.75);
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

    // Œil
    const cx = w / 2 + gaze.x * 26;
    const cy = h / 2 + gaze.y * 18;
    const open = 1 - blink;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 82, 70 * Math.max(open, 0.04), 0, 0, Math.PI * 2);
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
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(cx - 15, cy - 16, 9, 0, Math.PI * 2);
    ctx.fill();

    // Sourire : la paupière inférieure remonte un peu
    if (smile > 0.01) {
      ctx.fillStyle = "#123a6e";
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 95 - smile * 30, 100, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Contour lumineux de l'œil
    ctx.strokeStyle = "rgba(140, 210, 255, 0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 82, 70 * Math.max(open, 0.04), 0, 0, Math.PI * 2);
    ctx.stroke();

    texture.needsUpdate = true;
  }

  return {
    // lookX / lookY dans [-1, 1] : direction du regard
    update(dt, { lookX, lookY, smile }) {
      const time = performance.now() / 1000;

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

      gaze.x = THREE.MathUtils.damp(gaze.x, THREE.MathUtils.clamp(lookX, -1, 1), 8, dt);
      gaze.y = THREE.MathUtils.damp(gaze.y, THREE.MathUtils.clamp(lookY, -1, 1), 8, dt);
      draw(time, smile);
    },
  };
}

// Lip-sync approximatif : la synthèse vocale du navigateur ne donne pas accès au son,
// on simule donc des syllabes, et la bouche se referme brièvement à chaque mot.
export function createLipSync(mesh) {
  const open = mesh.morphTargetDictionary?.MouthOpen;
  const smile = mesh.morphTargetDictionary?.MouthSmile;
  let value = 0;

  return {
    update(dt, state) {
      const t = performance.now() / 1000;
      let target = 0;
      if (state.isSpeaking) {
        const syllables = Math.max(0, Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 3.7));
        const sinceWord = t - (state.lastWordAt || 0);
        const wordGap = sinceWord < 0.06 ? 0.3 : 1;
        target = (0.15 + 0.7 * syllables) * wordGap;
      }
      value = THREE.MathUtils.damp(value, target, 25, dt);
      if (open !== undefined) mesh.morphTargetInfluences[open] = value;
      if (smile !== undefined) {
        const smileTarget = state.isSpeaking ? 0.25 : 0.4;
        mesh.morphTargetInfluences[smile] = THREE.MathUtils.damp(
          mesh.morphTargetInfluences[smile], smileTarget, 3, dt
        );
      }
    },
  };
}
