// state.js — état partagé entre le suivi webcam, la voix et les avatars.
//
// Les bras sont nommés du point de vue de l'utilisateur ("right" = ton bras droit).
// Les avatars les affichent en miroir, comme dans une glace.

export const state = {
  mode: "assistant", // "assistant" | "miroir"
  isSpeaking: false,
  head: { yaw: 0, pitch: 0 },
  arms: {
    left: { raised: false, elbowBend: 0 },
    right: { raised: false, elbowBend: 0 },
  },
};
