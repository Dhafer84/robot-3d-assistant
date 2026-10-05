// Tests de frontend/js/text.js : balises d'émotion, découpage en phrases, langue, nettoyage.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTagFilter,
  splitSentences,
  cleanForSpeech,
  detectLang,
  MIN_SENTENCE_LENGTH,
} from "../../frontend/js/text.js";

// Passe des morceaux de flux dans un filtre ; renvoie [texte affiché, émotions vues]
function run(chunks) {
  const emotions = [];
  const filter = createTagFilter((name) => emotions.push(name));
  const text = chunks.map((c) => filter.push(c)).join("") + filter.flush();
  return [text, emotions];
}

test("balise d'émotion en tête de réponse : retirée et signalée", () => {
  assert.deepEqual(run(["<joie> Avec plaisir !"]), ["Avec plaisir !", ["joie"]]);
});

test("balise coupée entre deux morceaux du flux (bug du 04/10 : « <neutre> » affiché)", () => {
  assert.deepEqual(
    run(["Bonjour ! Ravi de vous rencontrer. <neu", "tre> Comment puis-je vous aider ?"]),
    ["Bonjour ! Ravi de vous rencontrer. Comment puis-je vous aider ?", ["neutre"]]
  );
});

test("balise coupée juste après le chevron, et sur trois morceaux", () => {
  assert.deepEqual(run(["<", "refl", "exion> Voyons."]), ["Voyons.", ["reflexion"]]);
});

test("balise au milieu de la réponse, majuscules et espaces tolérés", () => {
  assert.deepEqual(run(["Oui. < JOIE > Super."]), ["Oui. Super.", ["joie"]]);
});

test("un autre texte entre chevrons n'est pas une émotion : il reste affiché", () => {
  assert.deepEqual(run(["Le tag <b> reste, comme <code>."]), ["Le tag <b> reste, comme <code>.", []]);
});

test("un « < » isolé en fin de réponse est rendu au flush, pas perdu", () => {
  assert.deepEqual(run(["Fin <"]), ["Fin <", []]);
});

test("un « < » de comparaison en fin de morceau est mis en réserve puis rendu", () => {
  const emotions = [];
  const filter = createTagFilter((name) => emotions.push(name));
  assert.equal(filter.push("si a <"), "si a "); // peut-être le début d'une balise : en réserve
  assert.equal(filter.push(" b alors c'est vrai."), "< b alors c'est vrai."); // ce n'en était pas une
  assert.deepEqual(emotions, []);
});

test("phrases : coupées sur la ponctuation, en gardant le reste non terminé", () => {
  const [sentences, rest] = splitSentences(
    "SafetyScope analyse les risques HARA. Il détermine le niveau ASIL selon l'ISO 26262. Et ens"
  );
  assert.deepEqual(sentences, [
    "SafetyScope analyse les risques HARA. ",
    "Il détermine le niveau ASIL selon l'ISO 26262. ",
  ]);
  assert.equal(rest, "Et ens");
});

test("phrases trop courtes : regroupées avec la suivante", () => {
  const [sentences, rest] = splitSentences("Oui. Bien sûr. Dhafer a 18 ans d'expérience. ");
  assert.deepEqual(sentences, ["Oui. Bien sûr. Dhafer a 18 ans d'expérience. "]);
  assert.equal(rest, "");
  assert.ok(sentences[0].length >= MIN_SENTENCE_LENGTH);
});

test("lecture à voix haute : sans URL, markdown ni emoji", () => {
  assert.equal(
    cleanForSpeech("**Bonjour** 🤖✨ ! Voir https://qualitycrew.fr/hara. C'est #top."),
    "Bonjour ! Voir C'est top."
  );
});

test("langue : français, anglais, arabe", () => {
  assert.equal(detectLang("Il a obtenu son diplôme d'ingénieur en 2025."), "fr");
  assert.equal(detectLang("He earned an engineering degree and leads a team of four."), "en");
  assert.equal(detectLang("مرحبا، كيف يمكنني مساعدتك؟"), "ar");
  // Sans indice, on retombe sur le français (langue par défaut du site)
  assert.equal(detectLang("ASPICE CL2"), "fr");
});
