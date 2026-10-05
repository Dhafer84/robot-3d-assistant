// chat.js — conversation avec l'assistant : historique, affichage du fil et réponse en streaming.
//
// La réponse arrive morceau par morceau : elle s'affiche au fil de l'eau et chaque phrase
// terminée part tout de suite à la synthèse vocale, sans attendre la fin de la réponse.

import { createTagFilter, splitSentences } from "./text.js";

const MAX_HISTORY = 20; // messages conservés et renvoyés à l'IA

export function createChat({ listEl, speaker, state, onStatus }) {
  const history = [];
  let controller = null; // requête en cours, annulée si une nouvelle question arrive

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
    onStatus("Je réfléchis… 🤔");
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
        body: JSON.stringify({ messages: history }),
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
          history.pop(); // la question pourra être reposée telle quelle
          onStatus("Limite de questions atteinte, réessaie dans un instant.");
          return;
        }
        throw new Error(data.error || `Erreur serveur (${res.status})`);
      }

      const decoder = new TextDecoder();
      for await (const chunk of res.body) {
        append(tags.push(decoder.decode(chunk, { stream: true })));
      }
      append(tags.flush());
      state.thinking = false;
      if (unspoken.trim()) speaker.say(unspoken);
      if (!answer.trim()) throw new Error("Réponse vide.");

      // La balise est gardée dans l'historique pour que l'IA conserve ce format
      remember("assistant", `<${emotion || "neutre"}> ${answer}`);
      onStatus("Prêt.");
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
      bubble.textContent = `Désolé, je n'arrive pas à joindre mon cerveau IA. (${err.message})`;
      // La question sans réponse est retirée pour ne pas fausser la suite
      if (history.at(-1)?.role === "user") history.pop();
      onStatus("Erreur de communication.");
    }
  }

  // Mode miroir : l'avatar répète simplement ce qu'on lui dit
  function echo(text) {
    controller?.abort();
    speaker.stop();
    addBubble("user", text);
    addBubble("assistant", `Je répète : ${text}`);
    speaker.say(text);
  }

  return { ask, echo };
}
