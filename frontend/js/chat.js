// chat.js — conversation avec l'assistant : historique, affichage du fil et réponse en streaming.
//
// La réponse arrive morceau par morceau : elle s'affiche au fil de l'eau et chaque phrase
// terminée part tout de suite à la synthèse vocale, sans attendre la fin de la réponse.

const MAX_HISTORY = 20; // messages conservés et renvoyés à l'IA
const MIN_SENTENCE_LENGTH = 25; // évite de lire des bouts de phrase trop courts séparément

// Fin de phrase : ponctuation forte suivie d'un espace ou d'un retour à la ligne
const SENTENCE_END = /[.!?…;:]+["»)]?\s+|\n+/g;

export function createChat({ listEl, speaker, onStatus }) {
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

  // Découpe le texte reçu en phrases complètes ; renvoie [phrases, reste non terminé]
  function takeSentences(buffer) {
    const sentences = [];
    let start = 0;
    for (const match of buffer.matchAll(SENTENCE_END)) {
      const end = match.index + match[0].length;
      if (end - start >= MIN_SENTENCE_LENGTH) {
        sentences.push(buffer.slice(start, end));
        start = end;
      }
    }
    return [sentences, buffer.slice(start)];
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

    let answer = "";
    let unspoken = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429 && data.error) {
          // Trop de questions d'un coup (limite du compte IA gratuit) : l'avatar le dit
          bubble.classList.remove("pending");
          bubble.textContent = data.error;
          speaker.say(data.error);
          history.pop(); // la question pourra être reposée telle quelle
          onStatus("Limite de questions atteinte, réessaie dans un instant.");
          return;
        }
        throw new Error(data.error || `Erreur serveur (${res.status})`);
      }

      const decoder = new TextDecoder();
      for await (const chunk of res.body) {
        const text = decoder.decode(chunk, { stream: true });
        answer += text;
        unspoken += text;
        bubble.textContent = answer;
        bubble.classList.remove("pending");
        listEl.scrollTop = listEl.scrollHeight;

        const [sentences, rest] = takeSentences(unspoken);
        sentences.forEach((s) => speaker.say(s));
        unspoken = rest;
      }
      if (unspoken.trim()) speaker.say(unspoken);
      if (!answer.trim()) throw new Error("Réponse vide.");

      remember("assistant", answer);
      onStatus("Prêt.");
    } catch (err) {
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
