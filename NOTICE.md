# NOTICE — third-party material

- **shinobi-duel** by Prasenjit Nayak (StarKnightt), MIT: https://github.com/StarKnightt/shinobi-duel — forked into `game/`. Original LICENSE kept at `game/LICENSE`.
  - TO VERIFY: that LICENSE file also lists assets (Poly Haven dust2 textures, Freesound CC0 audio, three.js "Soldier.glb", Barlow font) that do not match the README (Mixamo kunoichi/general, Poly Haven rooftop textures, synthesized audio). Treat asset terms as unverified until checked.
- **Mixamo** (Adobe): characters/animations used under Adobe's Mixamo terms (allowed in games; raw files must not be redistributed).
- **Poly Haven** textures/HDRI: CC0.
- **Three.js** (MIT), **pmndrs postprocessing** (Zlib), **N8AO** (ISC).
- **Mubit** (https://mubit.ai) is the LLM gateway; no Mubit code is bundled.

## Voice-over (game/public/assets/voice)
Spoken lines are synthesised offline with Piper TTS (MIT, github.com/OHF-Voice/piper1-gpl) using these voices from
huggingface.co/rhasspy/piper-voices, then pitch-shifted and given reverb (game/tools/voice-gen.py):
- en_US-norman-medium (narrator), en_US-john-medium (Masatora), en_US-bryce-medium (Kurogane): LibriVox, public domain
- en_US-joe-medium (Kazemaru): CC0
- en_GB-cori-high (Kaede): LibriVox, public domain
