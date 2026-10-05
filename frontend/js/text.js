// text.js — traitement du texte des réponses, sans dépendance au navigateur (testé par
// backend/test/text.test.mjs) : balises d'émotion, découpage en phrases, langue, nettoyage.

// ====== Balises d'émotion ======
// L'IA commence sa réponse par une balise d'émotion, ex. "<joie> Avec plaisir !"
// (parfois plus loin dans la réponse, et parfois coupée entre deux morceaux du flux).
export const EMOTIONS = ["neutre", "joie", "reflexion", "surprise", "desole"];
const TAG = /<\s*([a-zéè]+)\s*>\s*/gi;
const PARTIAL_TAG_AT_END = /<\s*[a-zéè]*\s*$/i;
const MAX_PARTIAL_TAG = 14; // "<   reflexion " : au-delà, ce n'est pas un début de balise

// Retire les balises du texte reçu au fil de l'eau ; onEmotion(nom) est appelé pour chacune.
// Un début de balise en fin de morceau ("<neu") est gardé de côté jusqu'au morceau suivant.
export function createTagFilter(onEmotion) {
  let held = "";
  const strip = (text) =>
    text.replace(TAG, (tag, name) => {
      name = name.toLowerCase();
      if (!EMOTIONS.includes(name)) return tag; // pas une balise d'émotion : on garde le texte
      onEmotion(name);
      return "";
    });
  return {
    push(chunk) {
      let text = held + chunk;
      held = "";
      const partial = text.match(PARTIAL_TAG_AT_END);
      if (partial && partial[0].length <= MAX_PARTIAL_TAG) {
        held = partial[0];
        text = text.slice(0, partial.index);
      }
      return strip(text);
    },
    flush() {
      const text = strip(held);
      held = "";
      return text;
    },
  };
}

// ====== Découpage en phrases ======
// Fin de phrase : ponctuation forte suivie d'un espace ou d'un retour à la ligne
const SENTENCE_END = /[.!?…;:]+["»)]?\s+|\n+/g;
export const MIN_SENTENCE_LENGTH = 25; // évite de lire des bouts de phrase trop courts séparément

// Découpe le texte reçu en phrases complètes ; renvoie [phrases, reste non terminé]
export function splitSentences(buffer, minLength = MIN_SENTENCE_LENGTH) {
  const sentences = [];
  let start = 0;
  for (const match of buffer.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    if (end - start >= minLength) {
      sentences.push(buffer.slice(start, end));
      start = end;
    }
  }
  return [sentences, buffer.slice(start)];
}

// ====== Lecture à voix haute ======
// Texte prêt à être lu : sans markdown, emojis ni URL (la voix les épellerait)
export function cleanForSpeech(text) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>~|]/g, "")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Langue d'une phrase, pour choisir la voix : arabe (alphabet), anglais ou français (mots fréquents)
const ARABIC_LETTERS = /[؀-ۿ]/;
const ENGLISH_WORDS = /\b(the|and|is|are|you|your|he|his|with|for|of|to|this|that|what|it|in|on|can|has)\b/gi;
const FRENCH_WORDS = /\b(le|la|les|et|est|sont|vous|tu|il|son|sa|ses|avec|pour|de|des|du|une|un|que|qui|ce|dans|sur)\b/gi;

export function detectLang(text) {
  if (ARABIC_LETTERS.test(text)) return "ar";
  const en = (text.match(ENGLISH_WORDS) || []).length;
  const fr = (text.match(FRENCH_WORDS) || []).length + (/[éèêàùçôîû]/i.test(text) ? 2 : 0);
  return en > fr ? "en" : "fr";
}
