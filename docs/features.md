# Features

Everything listed here is exercised by `game/tools/fullcheck.mjs` (a real-browser pass with the bot fighting), the unit
tests, or both. Unverified items are in the last section.

## The learning boss
- A **brain per general per player**, saved in the browser: style, move scores, level without a ceiling.
- **Reads you**: how much you attack, guard, deflect, dodge, jump, heal, and **where you stand** (close or far).
- **Learns what works on you**: moves that land are picked more; moves that never land are dropped.
- **Range tactic**: a close fighter is made to chase (he keeps away and cuts from range); a kiter is crowded. He tries the
  other distance first and keeps the one that hurt you more.
- **Arsenal**: 12 named combos from the hardest fights, each with why it is hard and what answers it; **new moves** at set levels.
- **Skills**: feints, uneven swing speed, delayed strikes, instant answer to a dodge, longer and more varied combos.
- **Conditions**: he can only be hurt after a deflect, after a dodge, only while open, or once his posture is broken; aimed at
  your favourite style, changed when you beat it. Deflects build his posture at a third of the rate when he is shielded.
- **Remembered form** (phase three feel): below 30 health, for a general who has learned enough, with a slow-motion
  turn, a shout, faster and longer strings.
- **War council screen**: what he read, what he learned, what the model designed.

## The language model (Mubit, three tasks)
- `general_plan`: how he opens next duel. `general_speech`: his words and his notes on you. `general_forge`: his next arsenal.
- Strict JSON, validated twice, with fallbacks. Calls are capped per minute, never in the frame loop.

## The game
- Three chapters, three generals (Masatora, Kazemaru, Kurogane), three arenas, each with its own music theme.
- Different moves per general: riposte stance, lunge and backflip, smoke vanish and shuriken fan, plus the learned ones.
- Deflect, guard, step, jump, gourd, lock on, finisher per general, deathblow and posture system.
- Story: narrated prologue, parley before each duel, narrated chapter cards and gate walks, last words, finisher.
- Human-sounding **voices** for every character (Kokoro): story lines pre-rendered, the model's lines through a local sidecar.
- **Pause menu** (Esc / button): resume, keyboard or hands, four volumes, controls and moves, main menu (forfeit).
- **Settings** (F1): controls, moves list, sound (master, music, effects, voices, mute).
- **Hand poses**: train your own pose per action, either hand or both at once, one frame to react, kept in the browser.
- Keyboard and mouse, controller, hand poses. Difficulty (Easy, Medium, Hard) that the learning scales from.

## Quality
- Fixed 120 Hz logic, 60 Hz skeleton, quality governor, about 58 fps in fights on an integrated GPU.
- Tests: shared, game and server suites; `fullcheck`, `pause-check`, `brain-run`, `flowperf`.

## Not verified here (needs you)
- Hand poses with a real camera (everything but the camera is tested: classification, two hands, mirror, replace rules).
- How fun and fair level 5, 10 and 20 generals feel for a human (the bot is far too precise to judge).
- Mubit console state: kept examples, task count and adapters (needs your sign-in).
- Voice and music quality by ear.
