// Tests unitaires de security.js : origines autorisées, empreintes des scripts, CSP.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseOrigins, inlineScriptHashes, pageCsp } = require("../security");

test("FRAME_ANCESTORS : seules les origines HTTPS nues passent (rien ne s'ajoute en douce)", () => {
  assert.deepEqual(parseOrigins("https://qualitycrew.fr  https://www.qualitycrew.fr"), [
    "https://qualitycrew.fr",
    "https://www.qualitycrew.fr",
  ]);
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const refused of [
      "http://qualitycrew.fr",
      "https://qualitycrew.fr/chemin",
      "https://*.qualitycrew.fr",
      "*",
      "'unsafe-inline'",
      "https://a.fr;script-src",
      "javascript:alert(1)",
    ]) {
      assert.deepEqual(parseOrigins(refused), [], refused);
    }
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(parseOrigins(""), []);
});

test("empreintes : scripts en ligne seulement (import map comprise), pas ceux à src", () => {
  const html = `
    <script>console.log(1)</script>
    <script type="importmap">{"imports":{}}</script>
    <script src="/js/main.js"></script>
    <script type="module" src="/js/x.js"></script>`;
  const hashes = inlineScriptHashes(html);
  assert.equal(hashes.length, 2);
  assert.ok(hashes.every((h) => /^'sha256-[A-Za-z0-9+/]+=*'$/.test(h)));
  // Le moindre changement d'un script change son empreinte
  assert.notDeepEqual(inlineScriptHashes("<script>console.log(2)</script>"), [hashes[0]]);
});

test("CSP des pages : ni unsafe-inline ni eval pour les scripts, objets et base interdits", () => {
  const csp = pageCsp(["'sha256-abc='"], ["https://qualitycrew.fr"]);
  const scriptSrc = csp.match(/script-src ([^;]+)/)[1];
  assert.equal(scriptSrc, "'self' 'wasm-unsafe-eval' 'sha256-abc='");
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/qualitycrew\.fr$/);
});
