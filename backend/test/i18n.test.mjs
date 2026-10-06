// Tests de frontend/js/i18n.js et de l'interface en anglais : aucun texte manquant, aucun
// texte français oublié en dur dans les scripts, choix de la langue, bulle qui la transmet.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEXTS, LANGS, pickLang, t } from "../../frontend/js/i18n.js";

const FRONTEND = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend");
const read = (file) => fs.readFileSync(path.join(FRONTEND, file), "utf8");
const SCRIPTS = fs.readdirSync(path.join(FRONTEND, "js")).filter((f) => f.endsWith(".js") && f !== "i18n.js");

test("mêmes textes en français et en anglais, mêmes variables {…}", () => {
  assert.deepEqual(LANGS, Object.keys(TEXTS));
  const keys = Object.keys(TEXTS.fr).sort();
  assert.deepEqual(Object.keys(TEXTS.en).sort(), keys);
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const key of keys) {
    for (const lang of LANGS) assert.ok(TEXTS[lang][key].trim(), `${lang}.${key} vide`);
    assert.deepEqual(vars(TEXTS.en[key]), vars(TEXTS.fr[key]), key);
  }
});

test("aucun mot français dans les textes anglais", () => {
  const FRENCH = /[éèêàùçôî«»]|\b(le|la|les|tu|ta|ton|est|une|des|du|pour|avec|ou|et)\b/i;
  for (const [key, text] of Object.entries(TEXTS.en)) assert.doesNotMatch(text, FRENCH, `en.${key} : ${text}`);
});

test("t() : traduction, variables, langue forcée", () => {
  assert.equal(t("youSaid", { text: "bonjour" }, "fr"), "Tu as dit : « bonjour »");
  assert.equal(t("loadingPercent", { percent: 42 }, "en"), "Loading the assistant… 42%");
  assert.equal(t("ready"), "Prêt."); // hors navigateur : français
});

test("langue : ?lang= d'abord, puis le navigateur (fr ou en), sinon français", () => {
  assert.equal(pickLang("?embed&lang=en", ["fr-FR"]), "en");
  assert.equal(pickLang("?lang=fr", ["en-US"]), "fr");
  assert.equal(pickLang("?lang=de", ["en-GB"]), "en"); // langue non gérée : ignorée
  assert.equal(pickLang("", ["ar-TN", "fr-FR", "en"]), "fr");
  assert.equal(pickLang("", ["EN-us"]), "en");
  assert.equal(pickLang("", ["ar", "de"]), "fr");
  assert.equal(pickLang(), "fr");
});

test("index.html : chaque texte traduisible existe, et son texte français est le même", () => {
  const html = read("index.html");
  const found = [...html.matchAll(/data-i18n(?:-(placeholder|title|label|empty))?="(\w+)"/g)];
  assert.ok(found.length >= 9, "attributs data-i18n manquants");
  for (const [, , key] of found) assert.ok(key in TEXTS.fr, `clé inconnue : ${key}`);
  // Le français écrit dans la page (affiché avant les scripts) = celui du catalogue
  for (const [, key, text] of html.matchAll(/data-i18n="(\w+)"[^>]*>([^<]+)</g)) {
    assert.equal(text.replace(/\s+/g, " ").trim(), TEXTS.fr[key], key);
  }
  assert.match(html, /data-empty="([^"]+)" data-i18n-empty="chatEmpty"/);
  assert.equal(html.match(/data-empty="([^"]+)"/)[1], TEXTS.fr.chatEmpty);
  // Aucun texte français dans le CSS (content: "…") : il ne serait pas traduit
  assert.doesNotMatch(html, /content:\s*"[^"]*[a-zé]{3}/i);
  // i18n.js est exécuté AVANT main.js (qui attend Three.js) : pas de français affiché en anglais
  assert.ok(html.indexOf('src="js/i18n.js"') < html.indexOf('src="js/main.js"'));
});

test("scripts : chaque t(\"…\") existe, et plus aucun texte d'interface français en dur", () => {
  for (const file of SCRIPTS) {
    const source = read(`js/${file}`);
    // Clés de t("clé") et de t(condition ? "clé1" : "clé2")
    for (const [call] of source.matchAll(/\bt\([^)]*\)/g)) {
      for (const [, key] of call.matchAll(/(?:^t\(\s*|\?\s*|:\s*)"(\w+)"/g)) {
        assert.ok(key in TEXTS.fr, `${file} : clé « ${key} » inconnue dans ${call}`);
      }
    }
    source.split("\n").forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (/console\.|new Error\(/.test(code)) return; // journal du développeur, pas l'interface
      assert.doesNotMatch(code, /["'`][^"'`]*[éèêàçù«][^"'`]*["'`]/, `${file}:${i + 1} texte français en dur : ${line.trim()}`);
    });
  }
});

test("bulle (embed.js) : la langue de la page hôte est transmise à l'assistant", () => {
  const embed = read("embed.js");
  assert.match(embed, /frame\.src = `\$\{origin\}\/\?embed&lang=\$\{lang\}`/);
  assert.match(embed, /script\.dataset\.lang \|\| document\.documentElement\.lang/);
});
