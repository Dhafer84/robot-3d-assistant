// scene.js — scène Three.js : rendu, caméra, lumières, redimensionnement.

import * as THREE from "three";

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.6, 5.5);
  camera.lookAt(0, 0.6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(1, 2, 3);
  scene.add(keyLight);

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return { scene, camera, renderer };
}
