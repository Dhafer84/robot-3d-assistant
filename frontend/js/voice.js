// voice.js — reconnaissance vocale (Web Speech API), appel à l'IA et synthèse vocale.

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function isVoiceSupported() {
  return Boolean(SpeechRecognition);
}

export async function askAssistant(message) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (data.answer) return data.answer;
    if (data.error) return `Erreur : ${data.error}`;
    return "Réponse inattendue du serveur.";
  } catch (err) {
    console.error("Erreur askAssistant :", err);
    return "Erreur de communication avec le cerveau IA.";
  }
}

export function speak(text, state) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.onstart = () => (state.isSpeaking = true);
  // À chaque mot, la bouche se referme brièvement (voir face.js)
  utterance.onboundary = () => (state.lastWordAt = performance.now() / 1000);
  utterance.onend = () => (state.isSpeaking = false);
  utterance.onerror = () => (state.isSpeaking = false);
  speechSynthesis.speak(utterance);
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
