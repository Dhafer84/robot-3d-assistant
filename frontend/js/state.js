// state.js — état partagé entre le suivi webcam, la voix et les avatars.
//
// Les bras sont nommés du point de vue de l'utilisateur ("right" = ton bras droit).
// Les avatars les affichent en miroir, comme dans une glace.

export const state = {
  mode: "assistant", // "assistant" | "miroir"
  isSpeaking: false,
  lastWordAt: 0, // instant (s) du dernier mot prononcé (voix du navigateur), pour le lip-sync
  audioDriven: false, // vrai quand la voix Piper joue : la bouche suit alors son volume
  voiceLevel: 0, // volume de la voix Piper (0 à 1)
  thinking: false, // en attente de la réponse de l'IA
  emotion: "neutre", // "neutre" | "joie" | "reflexion" | "surprise" | "desole"
  emotionAt: 0, // instant (s) où l'émotion a été fixée
  head: { yaw: 0, pitch: 0 },
  arms: {
    left: { raised: false, elbowBend: 0 },
    right: { raised: false, elbowBend: 0 },
  },
};
