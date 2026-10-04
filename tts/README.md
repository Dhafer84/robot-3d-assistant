# Voix naturelle (Piper)

Le serveur Node lance automatiquement `tts/server.py` s'il trouve l'environnement Python
`tts/.venv`. Sans lui, l'assistant utilise la voix du navigateur.

## Installation

```bash
cd tts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m piper.download_voices --data-dir voices fr_FR-tom-medium en_US-ryan-high
```

Redémarre ensuite le serveur (`./stop_robot.sh` puis `./start_robot.sh`). Le serveur de voix
met une trentaine de secondes à démarrer ; ensuite chaque phrase est prête en ~0,2 s.

## Changer de voix

Les voix disponibles sont listées sur https://huggingface.co/rhasspy/piper-voices.
Télécharge-la avec la commande ci-dessus, puis règle `TTS_VOICE_FR` / `TTS_VOICE_EN` dans
`backend/.env` (format `modele` ou `modele:numero_de_locuteur` pour les voix à plusieurs locuteurs).
