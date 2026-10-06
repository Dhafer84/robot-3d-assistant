// embed.js — ajoute l'assistant 3D sur un autre site, dans une bulle flottante.
//
//   <script src="https://assistant.qualitycrew.fr/embed.js" defer></script>
//
// Options (attributs facultatifs de la balise <script>) :
//   data-lang="en"                         bouton, bulle ET assistant en anglais (sinon
//                                          langue de la page hôte, <html lang>)
//   data-label / data-title / data-close   textes du bouton, de l'en-tête et du bouton
//                                          de fermeture (remplacent ceux de data-lang)
//   data-position="left"                   bulle en bas à gauche au lieu de la droite
//   data-origin="https://assistant.…"      adresse de l'assistant, si ce fichier est servi
//                                          par le site hôte lui-même (copie locale)
//
// La bulle est une fenêtre flottante (aussi sur mobile, au-dessus du site) : on la déplace
// par son en-tête, on l'agrandit en plein écran d'un bouton, et elle se réduit pour rester
// visible quand le clavier du mobile s'ouvre. Le bouton rond se déplace aussi.
// Pendant la visite (sessionStorage du site hôte, onglet courant), la bulle reste ouverte
// d'une page à l'autre, à la même place ; l'assistant garde lui-même la conversation.
//
// L'assistant (modèle 3D de plusieurs Mo) n'est chargé qu'au premier clic sur le bouton.
(() => {
  const script = document.currentScript;
  if (!script || document.getElementById("r3d-launcher")) return;

  // Par défaut, l'assistant est sur le domaine d'où vient ce script
  const origin = new URL(script.dataset.origin || script.src).origin;
  const TEXTS = {
    fr: {
      label: "Parler à mon assistant",
      title: "Assistant de Dhafer",
      close: "Fermer",
      expand: "Agrandir",
      shrink: "Réduire",
      move: "Glisser pour déplacer",
    },
    en: {
      label: "Talk to my assistant",
      title: "Dhafer's assistant",
      close: "Close",
      expand: "Expand",
      shrink: "Shrink",
      move: "Drag to move",
    },
  };
  // Langue : data-lang, sinon celle de la page hôte ; transmise à l'assistant (?lang=)
  const asked = (script.dataset.lang || document.documentElement.lang || "").slice(0, 2).toLowerCase();
  const lang = asked in TEXTS ? asked : "fr";
  const base = TEXTS[lang];
  const { label: dataLabel, title: dataTitle, close: dataClose } = script.dataset;
  const texts = { ...base, label: dataLabel || base.label, title: dataTitle || base.title, close: dataClose || base.close };
  const label = texts.label;
  const side = script.dataset.position === "left" ? "left" : "right";

  // ====== État gardé pendant la visite : ouverte ?, agrandie ?, positions ======
  const STORE_KEY = "r3d-bubble";
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(STORE_KEY)) || {};
  } catch {
    // stockage bloqué (navigation privée stricte…) : la bulle marche, sans mémoire
  }
  function save(patch) {
    Object.assign(saved, patch);
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(saved));
    } catch {
      // idem
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    #r3d-launcher {
      position: fixed; bottom: 20px; ${side}: 20px; z-index: 2147483000;
      width: 64px; height: 64px; padding: 0; border: 2px solid #3b82f6; border-radius: 50%;
      background: #020617 url("${origin}/img/avatar-icon.jpg") center / cover;
      box-shadow: 0 6px 24px rgba(2, 6, 23, 0.45); cursor: pointer;
      transition: transform 0.15s ease; touch-action: none;
    }
    #r3d-launcher:hover { transform: scale(1.06); }
    #r3d-launcher.r3d-dragging { transform: scale(1.1); cursor: grabbing; transition: none; }
    #r3d-launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
    #r3d-launcher::after {
      content: ""; position: absolute; right: 2px; bottom: 2px; width: 14px; height: 14px;
      border-radius: 50%; background: #22c55e; border: 2px solid #020617;
    }
    #r3d-panel {
      position: fixed; z-index: 2147483000; box-sizing: border-box;
      border-radius: 16px; overflow: hidden; background: #020617;
      box-shadow: 0 12px 40px rgba(2, 6, 23, 0.55); border: 1px solid #1f2937;
      display: none; flex-direction: column;
    }
    #r3d-panel.r3d-open { display: flex; }
    #r3d-panel.r3d-max { border-radius: 0; border: none; }
    #r3d-header {
      display: flex; align-items: center; gap: 4px;
      padding: 6px 8px 6px 12px; background: #0f172a; color: #e5e7eb;
      font: 600 14px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
    }
    #r3d-panel.r3d-max #r3d-header { cursor: default; }
    #r3d-panel.r3d-dragging #r3d-header { cursor: grabbing; }
    #r3d-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #r3d-title::before { content: "⠿ "; color: #4b5563; }
    #r3d-panel.r3d-max #r3d-title::before { content: ""; }
    #r3d-header button {
      border: none; background: none; color: #9ca3af; font-size: 20px; line-height: 1;
      cursor: pointer; padding: 4px 8px; border-radius: 6px; min-width: 32px; min-height: 32px;
    }
    #r3d-header button:hover { color: #fff; background: #1f2937; }
    #r3d-expand { font-size: 16px !important; }
    #r3d-frame { flex: 1; width: 100%; border: none; background: #020617; }
    /* Pendant un déplacement, l'iframe ne doit pas capter le pointeur */
    #r3d-panel.r3d-dragging #r3d-frame { pointer-events: none; }
    @media (max-width: 480px) {
      /* La bulle ouverte couvre le bas de l'écran : le bouton rond est masqué, la croix suffit */
      #r3d-panel.r3d-open ~ #r3d-launcher { display: none; }
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
    <div id="r3d-header" title="${texts.move}">
      <span id="r3d-title">${texts.title}</span>
      <button id="r3d-expand" type="button" aria-label="${texts.expand}" title="${texts.expand}">⤢</button>
      <button id="r3d-close" type="button" aria-label="${texts.close}" title="${texts.close}">×</button>
    </div>`;
  const header = panel.querySelector("#r3d-header");
  const expandBtn = panel.querySelector("#r3d-expand");

  // ====== Taille et position ======
  // Calculées en pixels par rapport à la partie VISIBLE de l'écran (visualViewport) : sur
  // mobile, le clavier la réduit ; la bulle rapetisse alors pour rester au-dessus de lui
  // (l'assistant passe en mode compact, avatar réduit à la tête).
  const MARGIN = 8;
  const isMobile = () => window.innerWidth <= 480;
  function viewport() {
    const vv = window.visualViewport;
    return vv
      ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height }
      : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

  // Taille et position (relatives à la partie visible) de la bulle non agrandie
  function panelBox(view = viewport()) {
    const mobile = isMobile();
    const w = mobile ? view.w - 2 * MARGIN : Math.min(380, view.w - 2 * MARGIN);
    // Mobile : 62 % de la hauteur (le site reste visible au-dessus) ; si la partie visible est
    // basse (clavier ouvert, téléphone à l'horizontale), toute la hauteur disponible.
    const mobileH = view.h <= 560 ? view.h - 2 * MARGIN : Math.min(520, Math.round(view.h * 0.62));
    const h = Math.min(mobile ? mobileH : Math.min(620, view.h - 120), view.h - 2 * MARGIN);
    const defaultX = side === "left" || mobile ? MARGIN : view.w - w - 20;
    const defaultY = mobile ? view.h - h - MARGIN : view.h - h - 96;
    const pos = saved.panel || { x: defaultX, y: defaultY };
    return {
      w,
      h,
      x: clamp(pos.x, MARGIN, view.w - w - MARGIN),
      y: clamp(pos.y, MARGIN, view.h - h - MARGIN),
    };
  }

  function layoutPanel() {
    if (!panel.classList.contains("r3d-open")) return;
    const view = viewport();
    const box = saved.max ? { x: 0, y: 0, w: view.w, h: view.h } : panelBox(view);
    Object.assign(panel.style, {
      left: `${view.x + box.x}px`,
      top: `${view.y + box.y}px`,
      width: `${box.w}px`,
      height: `${box.h}px`,
    });
  }

  function layoutLauncher() {
    if (!saved.launcher) return; // position par défaut du CSS (en bas, à droite ou à gauche)
    const size = launcher.offsetWidth || 64;
    Object.assign(launcher.style, {
      left: `${clamp(saved.launcher.x, MARGIN, window.innerWidth - size - MARGIN)}px`,
      top: `${clamp(saved.launcher.y, MARGIN, window.innerHeight - size - MARGIN)}px`,
      right: "auto",
      bottom: "auto",
    });
  }

  function layout() {
    layoutPanel();
    layoutLauncher();
  }

  // ====== Déplacement au doigt ou à la souris ======
  // onStart() renvoie la position de départ ; au-delà de THRESHOLD px, c'est un déplacement
  // (sinon un simple clic, pour le bouton rond).
  const THRESHOLD = 6;
  function draggable(handle, { canStart, onStart, onMove, onEnd }) {
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !canStart(event)) return;
      drag = { startX: event.clientX, startY: event.clientY, from: onStart(), moved: false };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < THRESHOLD) return;
      drag.moved = true;
      onMove(drag.from.x + dx, drag.from.y + dy);
    });
    const finish = () => {
      if (!drag) return;
      if (drag.moved) onEnd();
      drag = null;
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  draggable(header, {
    canStart: (event) => !saved.max && !event.target.closest("button"),
    onStart: () => {
      const { x, y } = panelBox();
      panel.classList.add("r3d-dragging");
      return { x, y };
    },
    onMove: (x, y) => {
      saved.panel = { x, y };
      layoutPanel();
    },
    onEnd: () => {
      panel.classList.remove("r3d-dragging");
      save({ panel: panelBox() }); // position gardée telle qu'affichée (dans l'écran)
    },
  });
  header.addEventListener("pointerup", () => panel.classList.remove("r3d-dragging"));

  let launcherDragged = false; // le clic qui suit un déplacement ne doit pas ouvrir la bulle
  draggable(launcher, {
    canStart: () => true,
    onStart: () => {
      const rect = launcher.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    },
    onMove: (x, y) => {
      launcher.classList.add("r3d-dragging");
      launcherDragged = true;
      saved.launcher = { x, y };
      layoutLauncher();
    },
    onEnd: () => {
      launcher.classList.remove("r3d-dragging");
      const rect = launcher.getBoundingClientRect();
      save({ launcher: { x: rect.left, y: rect.top } });
      // Le « click » éventuel suit immédiatement ; au toucher, il n'a souvent pas lieu
      setTimeout(() => (launcherDragged = false), 0);
    },
  });

  // ====== Ouvrir, agrandir, fermer ======
  let frame = null;

  function open() {
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "r3d-frame";
      frame.title = texts.title;
      frame.src = `${origin}/?embed&lang=${lang}`;
      // Micro et caméra doivent être délégués explicitement à l'iframe
      frame.allow = "microphone; camera; autoplay";
      panel.appendChild(frame);
    }
    panel.classList.add("r3d-open");
    launcher.setAttribute("aria-expanded", "true");
    setMax(Boolean(saved.max));
    save({ open: true });
  }

  function close() {
    panel.classList.remove("r3d-open");
    launcher.setAttribute("aria-expanded", "false");
    // L'assistant se tait, coupe le micro et la caméra quand on ferme la bulle
    frame?.contentWindow?.postMessage({ type: "r3d:pause" }, origin);
    save({ open: false });
    launcher.focus();
  }

  function setMax(max) {
    save({ max });
    panel.classList.toggle("r3d-max", max);
    expandBtn.textContent = max ? "⤡" : "⤢";
    expandBtn.setAttribute("aria-label", max ? texts.shrink : texts.expand);
    expandBtn.title = max ? texts.shrink : texts.expand;
    layoutPanel();
  }

  launcher.addEventListener("click", () => {
    if (launcherDragged) {
      launcherDragged = false;
      return;
    }
    panel.classList.contains("r3d-open") ? close() : open();
  });
  expandBtn.addEventListener("click", () => setMax(!saved.max));
  panel.querySelector("#r3d-close").addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("r3d-open")) close();
  });

  // Rotation de l'écran, fenêtre redimensionnée, clavier du mobile qui s'ouvre ou se ferme
  window.addEventListener("resize", layout);
  window.visualViewport?.addEventListener("resize", layoutPanel);
  window.visualViewport?.addEventListener("scroll", layoutPanel);

  document.body.append(panel, launcher);
  layoutLauncher();
  // Bulle restée ouverte sur la page précédente : on la rouvre (le modèle 3D est en cache)
  if (saved.open) open();
})();
