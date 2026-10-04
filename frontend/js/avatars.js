// avatars.js — chargement et animation de l'avatar GLB riggé (squelette Mixamo).
// L'avatar expose { root, update(dt, state, camera), wave(), framing } et lit l'état partagé.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { createLensEyes, createLipSync } from "./face.js";

const AVATAR_HEIGHT = 2.6;
const AVATAR_FLOOR_Y = -1.05;
const ARM_RAISE_ANGLE = (2 * Math.PI) / 3; // ≈ 120° : main au-dessus de l'épaule
const CLIP_FADE = 0.4; // secondes de fondu entre deux animations
const SMOOTHING = 10; // plus grand = suit plus vite

// Regard caméra : part de la correction appliquée et angle maximal corrigé
const LOOK_AT_CAMERA_WEIGHT = 0.9;
const LOOK_AT_CAMERA_MAX_ANGLE = THREE.MathUtils.degToRad(50);

const DRACO_DECODER_PATH = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/";

// Interpolation indépendante du nombre d'images par seconde
function damp(current, target, dt) {
  return THREE.MathUtils.damp(current, target, SMOOTHING, dt);
}

function createLoader() {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

// Charge un avatar GLB riggé. Animations reconnues par leur nom : "Idle", "Talking",
// "Waving" (sinon la première animation sert d'animation de repos).
// Si le modèle a des verres "Lens_L"/"Lens_R" et des morph targets "MouthOpen",
// le visage est animé (yeux dans les verres, lip-sync).
export async function loadRiggedAvatar(url) {
  const gltf = await createLoader().loadAsync(url);
  const model = gltf.scene;

  // Mise à l'échelle automatique : quelle que soit la taille d'origine du modèle,
  // il fait AVATAR_HEIGHT de haut, centré, les pieds sur AVATAR_FLOOR_Y.
  // (calcul sur la pose du squelette : les modèles Mixamo ont une échelle interne)
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse((obj) => {
    if (!obj.isSkinnedMesh) return;
    obj.computeBoundingBox();
    box.union(obj.boundingBox.clone().applyMatrix4(obj.matrixWorld));
  });
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = AVATAR_HEIGHT / size.y;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, AVATAR_FLOOR_Y - box.min.y * scale, -center.z * scale);

  const root = new THREE.Group();
  root.add(model);
  root.updateMatrixWorld(true);

  // ----- Animations -----
  const mixer = new THREE.AnimationMixer(model);
  const clip = (name) => gltf.animations.find((c) => c.name === name);
  const actions = {
    idle: mixer.clipAction(clip("Idle") || gltf.animations[0]),
    talking: clip("Talking") ? mixer.clipAction(clip("Talking")) : null,
    waving: clip("Waving") ? mixer.clipAction(clip("Waving")) : null,
  };
  let current = actions.idle;
  current.play();

  function fadeTo(action) {
    if (!action || action === current) return;
    action.reset().fadeIn(CLIP_FADE).play();
    current.fadeOut(CLIP_FADE);
    current = action;
  }

  let waveRemaining = 0;
  function wave(times = 3) {
    if (!actions.waving) return;
    waveRemaining = times * actions.waving.getClip().duration;
    fadeTo(actions.waving);
  }

  // ----- Squelette -----
  const bone = (name) => model.getObjectByName(name) || model.getObjectByName(name.replace(":", ""));
  const head = bone("mixamorig:Head");
  const neck = bone("mixamorig:Neck");

  // Axe "avant" de la tête dans le repère de l'os, mesuré en pose de repos
  // (le personnage est alors tourné vers +Z, c'est-à-dire vers la caméra).
  const headForward = new THREE.Vector3(0, 0, 1);
  if (head) {
    headForward.applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert());
  }

  // Le personnage nous fait face : son bras gauche est à droite de l'écran.
  // Pour l'effet miroir, ton bras droit pilote donc son bras gauche.
  const arms = {
    right: { bone: bone("mixamorig:LeftArm"), direction: 1, weight: 0 },
    left: { bone: bone("mixamorig:RightArm"), direction: -1, weight: 0 },
  };

  // ----- Visage -----
  const lenses = ["Lens_L", "Lens_R"].map((n) => model.getObjectByName(n)).filter(Boolean);
  const eyes = lenses.length ? createLensEyes(lenses) : null;
  let faceMesh = null;
  model.traverse((obj) => {
    if (obj.isMesh && obj.morphTargetDictionary?.MouthOpen !== undefined) faceMesh = obj;
  });
  const lipSync = faceMesh ? createLipSync(faceMesh) : null;

  const headYaw = { value: 0 };
  const headPitch = { value: 0 };
  const offset = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const forwardAxis = new THREE.Vector3(0, 0, 1);
  const localAxis = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const headRotation = new THREE.Quaternion();
  const headPosition = new THREE.Vector3();
  const currentDir = new THREE.Vector3();
  const targetDir = new THREE.Vector3();
  const identity = new THREE.Quaternion();

  // Tourne la tête vers la caméra, par-dessus l'animation (contact visuel)
  function lookAtCamera(camera) {
    head.updateWorldMatrix(true, false);
    head.getWorldQuaternion(headRotation);
    head.getWorldPosition(headPosition);
    currentDir.copy(headForward).applyQuaternion(headRotation);
    targetDir.copy(camera.position).sub(headPosition).normalize();

    offset.setFromUnitVectors(currentDir, targetDir);
    const angle = 2 * Math.acos(Math.min(1, Math.abs(offset.w)));
    const weight = LOOK_AT_CAMERA_WEIGHT * Math.min(1, LOOK_AT_CAMERA_MAX_ANGLE / Math.max(angle, 1e-6));
    offset.slerpQuaternions(identity, offset, weight);

    // Rotation monde → rotation locale de l'os
    head.parent.getWorldQuaternion(parentRotation);
    head.quaternion.copy(parentRotation).invert().multiply(offset).multiply(headRotation);
  }

  function update(dt, state, camera) {
    // 1) Choix de l'animation : salut > parole > repos
    if (waveRemaining > 0) {
      waveRemaining -= dt;
      if (waveRemaining <= 0) fadeTo(state.isSpeaking && actions.talking ? actions.talking : actions.idle);
    } else {
      fadeTo(state.isSpeaking && actions.talking ? actions.talking : actions.idle);
    }

    // 2) L'animation positionne tout le squelette…
    mixer.update(dt);

    // 3) …la tête se tourne vers la caméra…
    if (head && camera) lookAtCamera(camera);

    // 4) …puis on ajoute les mouvements suivis par la webcam par-dessus.
    if (head) {
      headYaw.value = damp(headYaw.value, -state.head.yaw, dt);
      headPitch.value = damp(headPitch.value, state.head.pitch, dt);

      // La rotation est répartie entre le cou et la tête pour un rendu plus naturel
      euler.set(headPitch.value * 0.5, headYaw.value * 0.5, 0);
      offset.setFromEuler(euler);
      head.quaternion.multiply(offset);
      if (neck) neck.quaternion.multiply(offset);
    }

    for (const side of ["left", "right"]) {
      const arm = arms[side];
      if (!arm.bone) continue;
      arm.weight = damp(arm.weight, state.arms[side].raised ? 1 : 0, dt);
      if (arm.weight > 0.001) {
        // Rotation autour de l'axe avant du personnage (lever le bras sur le côté),
        // exprimée dans le repère du parent de l'os pour ne pas dépendre de son orientation.
        arm.bone.parent.updateWorldMatrix(true, false);
        arm.bone.parent.getWorldQuaternion(parentRotation);
        localAxis.copy(forwardAxis).applyQuaternion(parentRotation.invert());
        offset.setFromAxisAngle(localAxis, arm.direction * ARM_RAISE_ANGLE * arm.weight);
        arm.bone.quaternion.premultiply(offset);
      }
    }

    // 5) Visage : le regard compense la rotation de la tête pour continuer à te regarder
    lipSync?.update(dt, state);
    eyes?.update(dt, {
      lookX: headYaw.value * 1.5,
      lookY: headPitch.value * 1.5,
      smile: state.isSpeaking ? 0.15 : 0.3,
    });
  }

  // Cadrage à mi-corps
  const framing = { target: new THREE.Vector3(0, 0.95, 0), distance: 2.1 };

  return { root, update, wave, framing };
}
