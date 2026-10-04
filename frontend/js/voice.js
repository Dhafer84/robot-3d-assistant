// voice.js — reconnaissance vocale (Web Speech API) et synthèse vocale (Piper, ou voix du navigateur).

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

// Langue d'une phrase, pour choisir la voix : arabe (alphabet), anglais ou français (mots fréquents)
const ENGLISH_WORDS = /\b(the|and|is|are|you|your|he|his|with|for|of|to|this|that|what|it|in|on|can|has)\b/gi;
const FRENCH_WORDS = /\b(le|la|les|et|est|sont|vous|tu|il|son|sa|ses|avec|pour|de|des|du|une|un|que|qui|ce|dans|sur)\b/gi;

export function detectLang(text) {
  if (/[؀-ۿ]/.test(text)) return "ar";
  const en = (text.match(ENGLISH_WORDS) || []).length;
  const fr = (text.match(FRENCH_WORDS) || []).length + (/[éèêàùçôîû]/i.test(text) ? 2 : 0);
  return en > fr ? "en" : "fr";
}

const BROWSER_LANGS = { fr: "fr-FR", en: "en-US", ar: "ar-SA" };
const PIPER_RETRY_DELAY = 30000; // ms avant de réessayer Piper après un échec

// File de phrases à prononcer, lues au fur et à mesure que la réponse arrive.
// Chaque phrase est synthétisée par Piper sur le serveur (voix naturelle) dès qu'elle est
// ajoutée, puis jouée dans l'ordre ; le volume du son anime la bouche (state.voiceLevel).
// Si Piper est indisponible (ou pour l'arabe), on utilise la voix du navigateur.
// state.isSpeaking reste vrai tant que la file n'est pas vide.
export function createSpeaker(state) {
  let ctx = null;
  let analyser = null;
  let samples = null;
  let queue = [];
  let playing = false;
  let generation = 0; // les phrases d'une réponse annulée sont ignorées
  let source = null;
  let piperRetryAt = 0;

  function audioContext() {
    if (!ctx) {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.connect(ctx.destination);
      samples = new Float32Array(analyser.fftSize);
    }
    return ctx;
  }

  async function synthesize(text, lang) {
    if (lang === "ar" || Date.now() < piperRetryAt) return null;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      return await audioContext().decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn("Voix Piper indisponible, voix du navigateur utilisée :", err.message);
      piperRetryAt = Date.now() + PIPER_RETRY_DELAY;
      return null;
    }
  }

  // Joue un son Piper en mesurant son volume à chaque image (lip-sync)
  function playAudio(buffer) {
    return new Promise((resolve) => {
      const node = audioContext().createBufferSource();
      node.buffer = buffer;
      node.connect(analyser);
      node.onended = () => {
        source = null;
        state.voiceLevel = 0;
        resolve();
      };
      source = node;
      state.audioDriven = true;
      node.start();

      const meter = () => {
        if (source !== node) return;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        state.voiceLevel = Math.min(1, Math.sqrt(sum / samples.length) * 6);
        requestAnimationFrame(meter);
      };
      meter();
    });
  }

  function playBrowserVoice(text, lang) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = BROWSER_LANGS[lang];
      state.audioDriven = false;
      // À chaque mot, la bouche se referme brièvement (voir face.js)
      utterance.onboundary = () => (state.lastWordAt = performance.now() / 1000);
      utterance.onend = resolve;
      utterance.onerror = resolve;
      speechSynthesis.speak(utterance);
    });
  }

  async function playNext() {
    if (playing) return;
    const item = queue.shift();
    if (!item) {
      state.isSpeaking = false;
      return;
    }
    playing = true;
    state.isSpeaking = true;
    const buffer = await item.audio;
    if (item.generation === generation) {
      if (buffer) await playAudio(buffer);
      else await playBrowserVoice(item.text, item.lang);
    }
    playing = false;
    playNext();
  }

  return {
    say(text) {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      const lang = detectLang(clean);
      // La synthèse démarre tout de suite, pendant que la phrase précédente est lue
      queue.push({ text: clean, lang, generation, audio: synthesize(clean, lang) });
      state.isSpeaking = true;
      playNext();
    },
    // Coupe la parole immédiatement (nouvelle question)
    stop() {
      generation++;
      queue = [];
      source?.stop();
      speechSynthesis.cancel();
      state.isSpeaking = false;
      state.voiceLevel = 0;
    },
    // Le navigateur n'autorise le son qu'après une action de l'utilisateur (clic, touche)
    unlock() {
      audioContext().resume();
    },
  };
}

// Écoute continue : onText(texte) est appelé pour chaque phrase reconnue.
// onStatus(message, isListening, erreur) informe l'interface des changements d'état ;
// erreur vaut "not-allowed" quand le micro est refusé.
export function createListener({ state, onText, onStatus }) {
  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = true;

  let listening = false;
  let micGranted = false;

  function micRefused() {
    listening = false;
    onStatus("Micro refusé.", false, "not-allowed");
  }

  // Dans une iframe (bulle sur un autre site), surtout sur mobile, la reconnaissance vocale
  // échoue parfois directement en "not-allowed" sans afficher la demande d'autorisation.
  // getUserMedia, lui, l'affiche : on demande donc le micro d'abord, puis on le relâche.
  async function ensureMicrophone() {
    if (micGranted || !navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micGranted = true;
  }

  recognition.onstart = () => onStatus("Écoute en cours… 🎙️ (parle quand tu veux)", true);

  recognition.onerror = (e) => {
    // "no-speech" et "aborted" sont normaux en écoute continue
    if (e.error === "no-speech" || e.error === "aborted") return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") return micRefused();
    listening = false;
    onStatus(`Erreur reconnaissance vocale : ${e.error}`, false, e.error);
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
    async toggle() {
      if (listening) {
        listening = false;
        recognition.stop();
        return false;
      }
      listening = true;
      onStatus("Autorisation du micro…", true);
      try {
        await ensureMicrophone();
      } catch {
        micRefused();
        return false;
      }
      if (listening) recognition.start();
      return listening;
    },
    stop() {
      if (!listening) return;
      listening = false;
      recognition.stop();
    },
  };
}
