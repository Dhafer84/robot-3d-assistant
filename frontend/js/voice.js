// voice.js — reconnaissance vocale et synthèse vocale (Web Speech API).

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isVoiceSupported() {
  return Boolean(SpeechRecognition);
}

// Texte prêt à être lu : sans markdown, emojis ni URL (la voix les épellerait)
export function cleanForSpeech(text) {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>~|]/g, "")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// File de phrases à prononcer : la réponse peut être lue phrase par phrase,
// au fur et à mesure qu'elle arrive. state.isSpeaking reste vrai tant que la file n'est pas vide.
export function createSpeaker(state) {
  let pending = 0;
  let generation = 0; // ignore les événements des phrases annulées

  function done(gen) {
    if (gen !== generation) return;
    pending = Math.max(0, pending - 1);
    if (pending === 0) state.isSpeaking = false;
  }

  return {
    say(text) {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      const gen = generation;
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "fr-FR";
      utterance.onstart = () => {
        if (gen === generation) state.isSpeaking = true;
      };
      // À chaque mot, la bouche se referme brièvement (voir face.js)
      utterance.onboundary = () => (state.lastWordAt = performance.now() / 1000);
      utterance.onend = () => done(gen);
      utterance.onerror = () => done(gen);
      pending++;
      speechSynthesis.speak(utterance);
    },
    // Coupe la parole immédiatement (nouvelle question)
    stop() {
      generation++;
      pending = 0;
      state.isSpeaking = false;
      speechSynthesis.cancel();
    },
  };
}

// Écoute continue : onText(texte) est appelé pour chaque phrase reconnue.
// onStatus(message, isListening) informe l'interface des changements d'état.
export function createListener({ state, onText, onStatus }) {
  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = true;

  let listening = false;

  recognition.onstart = () => onStatus("Écoute en cours… 🎙️ (parle quand tu veux)", true);

  recognition.onerror = (e) => {
    // "no-speech" et "aborted" sont normaux en écoute continue
    if (e.error === "no-speech" || e.error === "aborted") return;
    listening = false;
    onStatus(`Erreur reconnaissance vocale : ${e.error}`, false);
  };

  // Le navigateur coupe régulièrement l'écoute : on la relance tant qu'elle est active
  recognition.onend = () => {
    if (listening) recognition.start();
    else onStatus("Écoute arrêtée.", false);
  };

  recognition.onresult = (event) => {
    // On ignore ce que le micro entend pendant que le robot parle (sa propre voix)
    if (state.isSpeaking) return;
    const text = event.results[event.resultIndex]?.[0]?.transcript?.trim();
    if (text) onText(text);
  };

  return {
    get listening() {
      return listening;
    },
    toggle() {
      listening = !listening;
      if (listening) recognition.start();
      else recognition.stop();
      return listening;
    },
  };
}
