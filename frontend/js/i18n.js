// i18n.js — textes de l'interface en français et en anglais.
//
// Langue choisie au chargement : `?lang=fr|en` (la bulle d'embed.js le transmet, d'après la
// langue de la page hôte), sinon la première langue du navigateur parmi fr / en, sinon fr.
// Les textes d'index.html sont en français (affichés avant l'exécution des scripts) et
// remplacés ici d'après leurs attributs data-i18n*. Les réponses de l'IA, elles, suivent
// la langue de chaque question (consigne côté serveur).
//
// Sans dépendance au navigateur à l'import : testé par backend/test/i18n.test.mjs.

export const LANGS = ["fr", "en"];

export const TEXTS = {
  fr: {
    // index.html
    loading: "Chargement de l'assistant…",
    chatEmpty: "Pose-moi une question à voix haute ou par écrit 👋",
    placeholder: "Écris ta question…",
    send: "Envoyer",
    privacy:
      "Les questions auxquelles je ne sais pas répondre sont gardées 90 jours, sans rien qui t'identifie, pour enrichir mes connaissances.",
    talkOn: "🎙️ Activer écoute auto",
    talkOff: "⏹️ Stop écoute",
    camOn: "📷 Activer le suivi",
    camOff: "📷 Couper le suivi",
    camTitle: "L'avatar suit les mouvements de ta tête et de tes bras",
    modeAssistant: "🤖 Assistant",
    modeMirror: "🪞 Miroir",
    ready: "Prêt.",
    // main.js
    loadingPercent: "Chargement de l'assistant… {percent} %",
    preparing: "Préparation…",
    loadingAvatar: "Chargement de l'avatar…",
    avatarError: "Impossible de charger l'avatar 3D. Tu peux quand même écrire ta question.",
    avatarErrorShort: "Impossible de charger l'avatar 3D.",
    modeAssistantOn: "Mode Assistant IA sélectionné.",
    modeMirrorOn: "Mode Miroir (je répète tout) sélectionné.",
    camStopped: "Suivi coupé, caméra libérée.",
    camStarting: "Démarrage de la caméra…",
    camRunning: "Je te suis des yeux 👀 (rien n'est enregistré ni envoyé).",
    camRefused: "Caméra refusée : le suivi reste désactivé.",
    camError: "Impossible de démarrer la caméra.",
    micBlockedEmbed: "Micro bloqué par ton navigateur dans la bulle : écris ta question ci-dessous.",
    micBlocked: "Micro refusé : autorise-le pour ce site (icône à gauche de l'adresse) ou écris ta question.",
    voiceUnsupported: "Reconnaissance vocale non supportée : utilise Chrome ou Edge (ou écris ta question).",
    youSaid: "Tu as dit : « {text} »",
    webcamPreview: "Aperçu de la webcam",
    // chat.js
    thinking: "Je réfléchis… 🤔",
    limitReached: "Limite de questions atteinte, réessaie dans un instant.",
    serverError: "Erreur serveur ({status})",
    emptyAnswer: "Réponse vide.",
    chatError: "Désolé, je n'arrive pas à joindre mon cerveau IA. ({error})",
    connectionError: "Erreur de communication.",
    echo: "Je répète : {text}",
    // voice.js
    micRefused: "Micro refusé.",
    micAsking: "Autorisation du micro…",
    listening: "Écoute en cours… 🎙️ (parle quand tu veux)",
    listeningStopped: "Écoute arrêtée.",
    voiceError: "Erreur reconnaissance vocale : {error}",
  },
  en: {
    loading: "Loading the assistant…",
    chatEmpty: "Ask me a question out loud or in writing 👋",
    placeholder: "Type your question…",
    send: "Send",
    privacy:
      "Questions I can't answer are kept for 90 days, with nothing that identifies you, to help me learn.",
    talkOn: "🎙️ Start listening",
    talkOff: "⏹️ Stop listening",
    camOn: "📷 Start tracking",
    camOff: "📷 Stop tracking",
    camTitle: "The avatar follows the movements of your head and arms",
    modeAssistant: "🤖 Assistant",
    modeMirror: "🪞 Mirror",
    ready: "Ready.",
    loadingPercent: "Loading the assistant… {percent}%",
    preparing: "Getting ready…",
    loadingAvatar: "Loading the avatar…",
    avatarError: "Couldn't load the 3D avatar. You can still type your question.",
    avatarErrorShort: "Couldn't load the 3D avatar.",
    modeAssistantOn: "AI assistant mode selected.",
    modeMirrorOn: "Mirror mode selected (I repeat everything).",
    camStopped: "Tracking stopped, camera released.",
    camStarting: "Starting the camera…",
    camRunning: "I'm following you with my eyes 👀 (nothing is recorded or sent).",
    camRefused: "Camera blocked: tracking stays off.",
    camError: "Couldn't start the camera.",
    micBlockedEmbed: "Your browser blocked the microphone in the bubble: type your question below.",
    micBlocked: "Microphone blocked: allow it for this site (icon left of the address bar) or type your question.",
    voiceUnsupported: "Speech recognition isn't supported: use Chrome or Edge (or type your question).",
    youSaid: "You said: “{text}”",
    webcamPreview: "Webcam preview",
    thinking: "Thinking… 🤔",
    limitReached: "Question limit reached, try again in a moment.",
    serverError: "Server error ({status})",
    emptyAnswer: "Empty answer.",
    chatError: "Sorry, I can't reach my AI brain. ({error})",
    connectionError: "Connection error.",
    echo: "I repeat: {text}",
    micRefused: "Microphone blocked.",
    micAsking: "Asking for microphone access…",
    listening: "Listening… 🎙️ (speak whenever you like)",
    listeningStopped: "Listening stopped.",
    voiceError: "Speech recognition error: {error}",
  },
};

// Langue à utiliser : paramètre ?lang= de l'adresse, sinon langues du navigateur, sinon fr
export function pickLang(search = "", languages = []) {
  const asked = new URLSearchParams(search).get("lang");
  if (LANGS.includes(asked)) return asked;
  for (const language of languages) {
    const code = String(language).slice(0, 2).toLowerCase();
    if (LANGS.includes(code)) return code;
  }
  return "fr";
}

export const LANG =
  typeof location === "undefined"
    ? "fr"
    : pickLang(location.search, navigator.languages?.length ? navigator.languages : [navigator.language]);

// Texte traduit ; {nom} est remplacé par vars.nom
export function t(key, vars = {}, lang = LANG) {
  const text = TEXTS[lang][key] ?? TEXTS.fr[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// Remplace les textes d'index.html : data-i18n (contenu), data-i18n-placeholder,
// data-i18n-title, data-i18n-label (aria-label), data-i18n-empty (data-empty : texte du fil
// vide, affiché par le CSS)
function applyToPage(root) {
  root.documentElement.lang = LANG;
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll("[data-i18n-label]")) el.setAttribute("aria-label", t(el.dataset.i18nLabel));
  for (const el of root.querySelectorAll("[data-i18n-empty]")) el.dataset.empty = t(el.dataset.i18nEmpty);
}

if (typeof document !== "undefined") applyToPage(document);
