"""Serveur de synthèse vocale (Piper) pour le Robot 3D Assistant.

Lancé automatiquement par backend/server.js. N'écoute qu'en local : c'est le serveur
Node qui relaie les requêtes du navigateur (POST /api/tts).

    POST /synthesize  {"text": "...", "lang": "fr" | "en"}  ->  audio/wav
    GET  /health                                           ->  "ok"

Configuration (variables d'environnement, voir backend/.env.example) :
    TTS_PORT       port local (défaut 5005)
    TTS_VOICE_FR   voix française, "modele" ou "modele:locuteur" (défaut fr_FR-upmc-medium:1)
    TTS_VOICE_EN   voix anglaise (défaut en_US-ryan-high)
    TTS_SPEED      vitesse de parole, 1.0 = normale, 1.1 = 10 % plus rapide (défaut 1.0)
"""

import io
import json
import os
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

VOICES_DIR = Path(__file__).parent / "voices"
PORT = int(os.environ.get("TTS_PORT", "5005"))
SPEED = float(os.environ.get("TTS_SPEED", "1.0"))
MAX_TEXT_LENGTH = 1000

VOICE_SPECS = {
    "fr": os.environ.get("TTS_VOICE_FR", "fr_FR-upmc-medium:1"),
    "en": os.environ.get("TTS_VOICE_EN", "en_US-ryan-high"),
}


def load_voice(spec):
    """'fr_FR-upmc-medium:1' -> (PiperVoice, config avec le locuteur n°1)."""
    name, _, speaker = spec.partition(":")
    path = VOICES_DIR / f"{name}.onnx"
    if not path.exists():
        print(f"⚠️  Voix introuvable : {path}")
        return None
    config = SynthesisConfig(
        speaker_id=int(speaker) if speaker else None,
        length_scale=1.0 / SPEED,
    )
    return PiperVoice.load(path), config


VOICES = {lang: voice for lang, spec in VOICE_SPECS.items() if (voice := load_voice(spec))}


def synthesize(text, lang):
    voice, config = VOICES.get(lang) or VOICES["fr"]
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        voice.synthesize_wav(text, wav, syn_config=config)
    return buffer.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.reply(200, b"ok", "text/plain")
        else:
            self.reply(404, b"not found", "text/plain")

    def do_POST(self):
        if self.path != "/synthesize":
            return self.reply(404, b"not found", "text/plain")
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
            text = str(data.get("text", "")).strip()[:MAX_TEXT_LENGTH]
            lang = data.get("lang", "fr")
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, b"requete invalide", "text/plain")
        if not text:
            return self.reply(400, b"texte vide", "text/plain")
        self.reply(200, synthesize(text, lang), "audio/wav")

    def reply(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # pas de log par requête


if __name__ == "__main__":
    if "fr" not in VOICES:
        raise SystemExit("Aucune voix française chargée : voir tts/README.md")
    print(f"🔊 Voix prêtes ({', '.join(f'{k}={VOICE_SPECS[k]}' for k in VOICES)}) sur 127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
