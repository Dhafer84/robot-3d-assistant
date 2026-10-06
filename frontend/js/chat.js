// chat.js — conversation avec l'assistant : historique, affichage du fil et réponse en streaming.
//
// La réponse arrive morceau par morceau : elle s'affiche au fil de l'eau et chaque phrase
// terminée part tout de suite à la synthèse vocale, sans attendre la fin de la réponse.
//
// La conversation est gardée dans le sessionStorage du navigateur (onglet courant, jusqu'à
// sa fermeture ; rien sur le serveur) : dans la bulle, elle survit au changement de page
// du site hôte. Les réponses restaurées sont affichées, pas relues.

import { createTagFilter, splitSentences } from "./text.js";
import { LANG, t } from "./i18n.js";

const MAX_HISTORY = 20; // messages conservés et renvoyés à l'IA
const STORE_KEY = "r3d-conversation";

// Historique gardé ; [] si absent, illisible ou stockage bloqué (navigation privée stricte…)
function loadHistory() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY));
    return Array.isArray(saved)
      ? saved.filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      : [];
  } catch {
    return [];
  }
}

export function createChat({ listEl, speaker, state, onStatus }) {
  const history = loadHistory();
  let controller = null; // requête en cours, annulée si une nouvelle question arrive

  function persist() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(history));
    } catch {
      // stockage plein ou bloqué : la conversation continue, sans mémoire
    }
  }

  function addBubble(role, text) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    listEl.appendChild(bubble);
    listEl.scrollTop = listEl.scrollHeight;
    return bubble;
  }

  function remember(role, content) {
    history.push({ role, content });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    persist();
  }

  // Une question sans réponse est retirée (elle pourra être reposée telle quelle)
  function forgetLastQuestion() {
    if (history.at(-1)?.role === "user") history.pop();
    persist();
  }

  // Conversation restaurée : affichée sans la balise d'émotion
  for (const { role, content } of history) {
    addBubble(role, content.replace(/^\s*<\s*[a-zéè]+\s*>\s*/i, ""));
  }

  async function ask(question) {
    // Nouvelle question : on coupe la réponse précédente (texte et voix)
    controller?.abort();
    speaker.stop();
    controller = new AbortController();
    const { signal } = controller;

    addBubble("user", question);
    remember("user", question);
    const bubble = addBubble("assistant", "…");
    bubble.classList.add("pending");
    onStatus(t("thinking"));
    state.thinking = true;

    let emotion = null;
    let answer = "";
    let unspoken = "";
    const tags = createTagFilter((name) => {
      emotion = name;
      state.emotion = name;
      state.emotionAt = performance.now() / 1000;
    });

    // Ajoute du texte visible à la réponse : affichage et lecture phrase par phrase
    function append(text) {
      if (!answer) text = text.trimStart();
      if (!text) return;
      if (state.thinking) {
        state.thinking = false;
        if (!emotion) {
          state.emotion = "neutre";
          state.emotionAt = performance.now() / 1000;
        }
      }
      answer += text;
      unspoken += text;
      bubble.textContent = answer;
      bubble.classList.remove("pending");
      listEl.scrollTop = listEl.scrollHeight;

      const [sentences, rest] = splitSentences(unspoken);
      sentences.forEach((s) => speaker.say(s));
      unspoken = rest;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // lang : langue de l'interface, pour les messages du serveur et en cas de doute de l'IA
        body: JSON.stringify({ messages: history, lang: LANG }),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        state.thinking = false;
        if (res.status === 429 && data.error) {
          // Trop de questions d'un coup (limite du compte IA gratuit) : l'avatar le dit
          bubble.classList.remove("pending");
          bubble.textContent = data.error;
          state.emotion = "desole";
          state.emotionAt = performance.now() / 1000;
          speaker.say(data.error);
          forgetLastQuestion();
          onStatus(t("limitReached"));
          return;
        }
        throw new Error(data.error || t("serverError", { status: res.status }));
      }

      const decoder = new TextDecoder();
      for await (const chunk of res.body) {
        append(tags.push(decoder.decode(chunk, { stream: true })));
      }
      append(tags.flush());
      state.thinking = false;
      if (unspoken.trim()) speaker.say(unspoken);
      if (!answer.trim()) throw new Error(t("emptyAnswer"));

      // La balise est gardée dans l'historique pour que l'IA conserve ce format
      remember("assistant", `<${emotion || "neutre"}> ${answer}`);
      onStatus(t("ready"));
    } catch (err) {
      state.thinking = false;
      if (signal.aborted) {
        // Réponse interrompue : on garde ce qui a déjà été dit dans l'historique
        if (answer.trim()) remember("assistant", answer);
        bubble.classList.add("interrupted");
        return;
      }
      console.error("Erreur chat :", err);
      bubble.classList.remove("pending");
      bubble.classList.add("error");
      bubble.textContent = t("chatError", { error: err.message });
      // La question sans réponse est retirée pour ne pas fausser la suite
      forgetLastQuestion();
      onStatus(t("connectionError"));
    }
  }

  // Mode miroir : l'avatar répète simplement ce qu'on lui dit
  function echo(text) {
    controller?.abort();
    speaker.stop();
    addBubble("user", text);
    addBubble("assistant", t("echo", { text }));
    speaker.say(text);
  }

  // restored : une conversation reprend (l'avatar ne refait pas son salut)
  return { ask, echo, restored: history.length > 0 };
}
