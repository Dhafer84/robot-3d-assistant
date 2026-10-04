// avatars.js — les deux avatars : le robot en cubes et l'humanoïde GLB (Mixamo).
// Chacun expose { root, update(dt, state) } et lit le même état partagé.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ARM_RAISE_ANGLE = Math.PI / 3; // ≈ 60°
const SMOOTHING = 10; // plus grand = suit plus vite

// Interpolation indépendante du nombre d'images par seconde
function damp(current, target, dt) {
  return THREE.MathUtils.damp(current, target, SMOOTHING, dt);
}

// ====== Robot en cubes ======
export function createCubeRobot() {
  const root = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.5, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.3, roughness: 0.5 })
  );
  body.position.y = 0.2;
  root.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.4, roughness: 0.3 })
  );
  head.position.y = 1.2;
  body.add(head);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.2, roughness: 0.6 })
  );
  mouth.position.set(0, -0.25, 0.51);
  head.add(mouth);

  const armMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.3, roughness: 0.6 });
  const upperArmGeometry = new THREE.BoxGeometry(0.3, 0.7, 0.3);
  const foreArmGeometry = new THREE.BoxGeometry(0.25, 0.7, 0.25);

  // Épaule (pivot) → bras → coude (pivot) → avant-bras
  function createArm(x) {
    const shoulder = new THREE.Object3D();
    shoulder.position.set(x, 0.1, 0);
    body.add(shoulder);

    const upperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
    upperArm.position.y = -0.35;
    shoulder.add(upperArm);

    const elbow = new THREE.Object3D();
    elbow.position.y = -0.35;
    upperArm.add(elbow);

    const foreArm = new THREE.Mesh(foreArmGeometry, armMaterial);
    foreArm.position.y = -0.35;
    elbow.add(foreArm);

    return { shoulder, elbow };
  }

  // Miroir : ton bras droit fait bouger le bras côté droit de l'écran
  const arms = { right: createArm(0.9), left: createArm(-0.9) };

  function update(dt, state) {
    const t = performance.now() / 1000;

    head.rotation.y = damp(head.rotation.y, -state.head.yaw, dt);
    head.rotation.x = damp(head.rotation.x, state.head.pitch, dt);
    head.rotation.z = Math.sin(t) * 0.05;

    mouth.scale.y = state.isSpeaking ? 0.6 + 0.4 * Math.abs(Math.sin(t * 20)) : 1;

    for (const side of ["left", "right"]) {
      const target = state.arms[side];
      const arm = arms[side];
      arm.shoulder.rotation.x = damp(arm.shoulder.rotation.x, target.raised ? -ARM_RAISE_ANGLE : 0, dt);
      arm.elbow.rotation.x = damp(arm.elbow.rotation.x, target.elbowBend, dt);
    }
  }

  return { root, update };
}

// ====== Humanoïde GLB ======
const HUMANOID_HEIGHT = 2.6;
const HUMANOID_FLOOR_Y = -1.05;
const HUMANOID_ARM_RAISE_ANGLE = (2 * Math.PI) / 3; // ≈ 120° : main au-dessus de l'épaule

export async function loadHumanoid(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;

  // Mise à l'échelle automatique : quelle que soit la taille d'origine du modèle,
  // il fait HUMANOID_HEIGHT de haut, centré, les pieds sur HUMANOID_FLOOR_Y.
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
  const scale = HUMANOID_HEIGHT / size.y;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, HUMANOID_FLOOR_Y - box.min.y * scale, -center.z * scale);

  const root = new THREE.Group();
  root.add(model);

  // Animation de repos fournie avec le modèle
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations.length > 0) {
    mixer.clipAction(gltf.animations[0]).play();
  }

  const bone = (name) => model.getObjectByName(name) || model.getObjectByName(name.replace(":", ""));
  const head = bone("mixamorig:Head");
  const neck = bone("mixamorig:Neck");

  // Le personnage nous fait face : son bras gauche est à droite de l'écran.
  // Pour l'effet miroir, ton bras droit pilote donc son bras gauche.
  const arms = {
    right: { bone: bone("mixamorig:LeftArm"), direction: 1, weight: 0 },
    left: { bone: bone("mixamorig:RightArm"), direction: -1, weight: 0 },
  };

  const headYaw = { value: 0 };
  const headPitch = { value: 0 };
  const offset = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const forwardAxis = new THREE.Vector3(0, 0, 1);
  const localAxis = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();

  function update(dt, state) {
    // 1) L'animation de repos positionne tout le squelette…
    mixer.update(dt);

    // 2) …puis on ajoute les mouvements suivis par la webcam par-dessus.
    if (head) {
      const t = performance.now() / 1000;
      const speakingNod = state.isSpeaking ? Math.sin(t * 9) * 0.04 : 0;
      headYaw.value = damp(headYaw.value, -state.head.yaw, dt);
      headPitch.value = damp(headPitch.value, state.head.pitch + speakingNod, dt);

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
        offset.setFromAxisAngle(localAxis, arm.direction * HUMANOID_ARM_RAISE_ANGLE * arm.weight);
        arm.bone.quaternion.premultiply(offset);
      }
    }
  }

  return { root, update };
}
