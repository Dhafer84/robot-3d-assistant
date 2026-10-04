// security.js — en-têtes de sécurité et bibliothèques du navigateur servies localement.
//
// Three.js, le décodeur Draco et MediaPipe viennent de node_modules (versions figées dans
// package.json), servis par ce serveur sous /vendor/ : la page ne charge plus aucun script
// depuis un CDN tiers, et la CSP peut se limiter à 'self'.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const NODE_MODULES = path.join(__dirname, "node_modules");
const VENDOR_CACHE = { maxAge: "1d" };

// Dossier publié → dossier de node_modules. Seuls les sous-dossiers utiles sont exposés.
const VENDOR_DIRS = {
  "/vendor/three/build": "three/build",
  "/vendor/three/examples/jsm": "three/examples/jsm",
  "/vendor/mediapipe/face_mesh": "@mediapipe/face_mesh",
  "/vendor/mediapipe/pose": "@mediapipe/pose",
  "/vendor/mediapipe/camera_utils": "@mediapipe/camera_utils",
};

function serveVendor(app) {
  for (const [route, dir] of Object.entries(VENDOR_DIRS)) {
    app.use(route, express.static(path.join(NODE_MODULES, dir), VENDOR_CACHE));
  }
}

// Origines HTTPS nues uniquement : une valeur entre telle quelle dans la CSP, un chemin,
// un joker ou un mot-clé y ajouterait une source en douce.
function parseOrigins(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((origin) => {
      const ok = /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(origin);
      if (!ok) console.warn(`⚠️  FRAME_ANCESTORS : origine ignorée (HTTPS nue attendue) : ${origin}`);
      return ok;
    });
}

// Empreintes des scripts en ligne d'une page (dont l'import map) : seuls ceux-là s'exécutent.
// Jamais 'unsafe-inline' pour les scripts : c'est ce qui laisserait passer un script injecté.
function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(match[1] || "")) continue;
    const digest = crypto.createHash("sha256").update(match[2], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

function pageCsp(hashes, frameAncestors) {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' : compilation WebAssembly (décodeur Draco, MediaPipe), sans autoriser eval()
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim(),
    // Styles en ligne permis : une injection de CSS n'exécute pas de code
    "style-src 'self' 'unsafe-inline'",
    // blob: : textures du modèle 3D, décodées par le navigateur
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: data:",
    // Le décodeur Draco tourne dans un worker créé depuis un blob
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    // Seuls ce site et les sites listés peuvent afficher l'assistant dans une bulle
    `frame-ancestors 'self' ${frameAncestors.join(" ")}`.trim(),
  ].join("; ");
}

// Réponses qui ne sont pas des pages (API, fichiers) : rien à charger, rien à encadrer
const NON_PAGE_CSP = "default-src 'none'; frame-ancestors 'none'";

// Page de suivi webcam (frontend/tracking.html) : MediaPipe génère du code à la volée
// (new Function), d'où 'unsafe-eval' — accordé à CETTE page seulement. Elle n'affiche aucun
// texte venant de l'IA ni du visiteur, n'a aucun script en ligne, et seul l'assistant
// lui-même peut l'afficher (frame-ancestors 'self').
const TRACKING_PAGE = "/tracking.html";
const TRACKING_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const COMMON_HEADERS = {
  // HTTPS seulement, pendant un an. Pas de includeSubDomains : il s'imposerait à tout le domaine.
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  // Micro et caméra : pour l'assistant lui-même uniquement (délégués par la bulle du site hôte)
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

// Middleware : pose les en-têtes sur toute réponse. La CSP des pages est recalculée
// quand index.html change (ses scripts en ligne sont autorisés par empreinte).
function securityHeaders({ frontendDir, frameAncestors }) {
  const indexPath = path.join(frontendDir, "index.html");
  let cached = { mtime: 0, csp: "" };

  function currentPageCsp() {
    const mtime = fs.statSync(indexPath).mtimeMs;
    if (mtime !== cached.mtime) {
      const html = fs.readFileSync(indexPath, "utf8");
      cached = { mtime, csp: pageCsp(inlineScriptHashes(html), frameAncestors) };
    }
    return cached.csp;
  }

  return (req, res, next) => {
    for (const [name, value] of Object.entries(COMMON_HEADERS)) res.setHeader(name, value);
    const isPage = req.method === "GET" && (req.path === "/" || req.path.endsWith(".html"));
    let csp = NON_PAGE_CSP;
    if (req.path === TRACKING_PAGE) csp = TRACKING_CSP;
    else if (isPage) csp = currentPageCsp();
    res.setHeader("Content-Security-Policy", csp);
    next();
  };
}

module.exports = {
  serveVendor,
  securityHeaders,
  parseOrigins,
  inlineScriptHashes,
  pageCsp,
  NON_PAGE_CSP,
  TRACKING_CSP,
  COMMON_HEADERS,
};
