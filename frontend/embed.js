// embed.js — ajoute l'assistant 3D sur un autre site, dans une bulle en bas à droite.
//
//   <script src="https://assistant.qualitycrew.fr/embed.js" defer></script>
//
// Options (attributs facultatifs de la balise <script>) :
//   data-lang="en"                         textes du bouton et de la bulle en anglais
//   data-label / data-title / data-close   textes du bouton, de l'en-tête et du bouton
//                                          de fermeture (remplacent ceux de data-lang)
//   data-position="left"                   bulle en bas à gauche au lieu de la droite
//   data-origin="https://assistant.…"      adresse de l'assistant, si ce fichier est servi
//                                          par le site hôte lui-même (copie locale)
//
// L'assistant (modèle 3D de plusieurs Mo) n'est chargé qu'au premier clic sur le bouton.
(() => {
  const script = document.currentScript;
  if (!script || document.getElementById("r3d-launcher")) return;

  // Par défaut, l'assistant est sur le domaine d'où vient ce script
  const origin = new URL(script.dataset.origin || script.src).origin;
  const TEXTS = {
    fr: { label: "Parler à mon assistant", title: "Assistant de Dhafer", close: "Fermer" },
    en: { label: "Talk to my assistant", title: "Dhafer's assistant", close: "Close" },
  };
  const { label: dataLabel, title: dataTitle, close: dataClose } = script.dataset;
  const base = TEXTS[script.dataset.lang] || TEXTS.fr;
  const texts = { label: dataLabel || base.label, title: dataTitle || base.title, close: dataClose || base.close };
  const label = texts.label;
  const side = script.dataset.position === "left" ? "left" : "right";

  const style = document.createElement("style");
  style.textContent = `
    #r3d-launcher {
      position: fixed; bottom: 20px; ${side}: 20px; z-index: 2147483000;
      width: 64px; height: 64px; padding: 0; border: 2px solid #3b82f6; border-radius: 50%;
      background: #020617 url("${origin}/img/avatar-icon.jpg") center / cover;
      box-shadow: 0 6px 24px rgba(2, 6, 23, 0.45); cursor: pointer;
      transition: transform 0.15s ease;
    }
    #r3d-launcher:hover { transform: scale(1.06); }
    #r3d-launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
    #r3d-launcher::after {
      content: ""; position: absolute; right: 2px; bottom: 2px; width: 14px; height: 14px;
      border-radius: 50%; background: #22c55e; border: 2px solid #020617;
    }
    #r3d-panel {
      position: fixed; bottom: 96px; ${side}: 20px; z-index: 2147483000;
      width: 380px; height: min(620px, calc(100vh - 120px));
      border-radius: 16px; overflow: hidden; background: #020617;
      box-shadow: 0 12px 40px rgba(2, 6, 23, 0.55); border: 1px solid #1f2937;
      display: none; flex-direction: column;
    }
    #r3d-panel.r3d-open { display: flex; }
    #r3d-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #0f172a; color: #e5e7eb;
      font: 600 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    #r3d-close {
      border: none; background: none; color: #9ca3af; font-size: 22px; line-height: 1;
      cursor: pointer; padding: 2px 6px; border-radius: 6px;
    }
    #r3d-close:hover { color: #fff; background: #1f2937; }
    #r3d-frame { flex: 1; width: 100%; border: none; background: #020617; }
    @media (max-width: 480px) {
      #r3d-panel { inset: 0; width: auto; height: auto; border-radius: 0; }
    }
  `;
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.id = "r3d-launcher";
  launcher.type = "button";
  launcher.title = label;
  launcher.setAttribute("aria-label", label);
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.id = "r3d-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", texts.title);
  panel.innerHTML = `
    <div id="r3d-header">
      <span>${texts.title}</span>
      <button id="r3d-close" type="button" aria-label="${texts.close}">×</button>
    </div>`;

  let frame = null;

  function open() {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "r3d-frame";
      frame.title = texts.title;
      frame.src = `${origin}/?embed`;
      // Micro et caméra doivent être délégués explicitement à l'iframe
      frame.allow = "microphone; camera; autoplay";
      panel.appendChild(frame);
    }
    panel.classList.add("r3d-open");
    launcher.setAttribute("aria-expanded", "true");
  }

  function close() {
    panel.classList.remove("r3d-open");
    launcher.setAttribute("aria-expanded", "false");
    // L'assistant se tait, coupe le micro et la caméra quand on ferme la bulle
    frame?.contentWindow?.postMessage({ type: "r3d:pause" }, origin);
    launcher.focus();
  }

  launcher.addEventListener("click", () => (panel.classList.contains("r3d-open") ? close() : open()));
  panel.querySelector("#r3d-close").addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("r3d-open")) close();
  });

  document.body.append(panel, launcher);
})();
