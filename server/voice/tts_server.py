"""
Local text-to-speech for the generals' model-written lines: Kokoro (open-source neural TTS, Apache-2.0)
through kokoro-onnx, on CPU, bound to 127.0.0.1 only. The Node server calls it (server/src/voice.ts).

  pip install kokoro-onnx soundfile
  curl -L -o server/voice/models/kokoro-v1.0.int8.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx
  curl -L -o server/voice/models/voices-v1.0.bin       https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
  python server/voice/tts_server.py            # http://127.0.0.1:8788/say  (POST {"voice","speed","text"} -> audio/wav)
"""
import io
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("KOKORO_DIR", os.path.join(HERE, "models"))
PEAK = 0.46  # the pre-rendered story lines peak here; the game applies one gain to both
VOICES = {"bm_fable", "af_heart", "bm_george", "am_puck", "am_onyx"}

kokoro = Kokoro(os.path.join(MODELS, "kokoro-v1.0.int8.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
lock = Lock()  # one synthesis at a time: the CPU is shared with the game


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n = int(self.headers.get("content-length", "0"))
            if n > 4096:
                return self.send_error(413)
            body = json.loads(self.rfile.read(n))
            voice, text = str(body["voice"]), str(body["text"]).strip()[:240]
            speed = min(1.3, max(0.6, float(body.get("speed", 1))))
            if voice not in VOICES or not text:
                return self.send_error(400)
            with lock:
                samples, sr = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
            samples = np.asarray(samples, dtype=np.float32)
            peak = float(np.max(np.abs(samples))) or 1.0
            buf = io.BytesIO()
            sf.write(buf, samples * (PEAK / peak), sr, format="WAV", subtype="PCM_16")
            data = buf.getvalue()
            self.send_response(200)
            self.send_header("content-type", "audio/wav")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # a bad request must never take the sidecar down
            print("tts error:", e, file=sys.stderr)
            self.send_error(500)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    with lock:
        kokoro.create("Ready.", voice="am_onyx", lang="en-us")  # warm up (the first call is slow)
    print("tts on 127.0.0.1:8788", flush=True)
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("TTS_PORT", "8788"))), H).serve_forever()
