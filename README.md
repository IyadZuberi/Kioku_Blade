# Kioku: Blades That Remember (the project is called The General Remembers)

A browser samurai duel (a fork of [shinobi-duel](https://github.com/StarKnightt/shinobi-duel), MIT) whose generals learn. After **every** duel, won or lost, the general is harder the next time, and he has read how you fight. Two layers:

1. **Memory in the game** (works offline): every duel is counted (`game/src/learn/remembers.ts`). Each one pulls his guard-and-answer knobs toward the HARD preset: he parries more of your long strings, answers a deflect faster, leaves fewer openings, moves faster and rests less (`bossKnobs` in `game/src/game/bosses.ts`). Never past HARD (the fair, bot-tested ceiling); your deflect windows are never touched. The title and the council screen say it in numbers ("he parries 47% of long strings").
2. **The war council** (Mubit): after the duel your numbers go to one frozen task, `general_plan`, through [Mubit](https://mubit.ai). It reads your habits (blended with your history) and answers with an enum-only plan: which moves to favour, an opening string, tempo and gap steps, a line of intel and a taunt. Code maps it onto the knobs; a validator keeps it inside the level's limits. If the call fails the same rules code runs locally and the screen says so.

Each general fights differently (katana duelist with a riposte stance, spear fighter who lunges across the room and springs away, shinobi-style shogun who vanishes in smoke and throws shuriken). Those Sekiro-style tricks are the game's own picks; the model never plans them (the frozen Mubit task names only the shared move list).

Built for the Night Shift hackathon (London, 23-25 Oct 2026). Design: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/`. Evidence: `docs/verification.md`. Demo: `docs/demo-script.md`. Walkthrough: `docs/walkthrough.md`.

## Run it

```powershell
pnpm install
pnpm -C server start        # http://localhost:8787  (API + /dashboard)
pnpm -C game dev            # http://localhost:5411  (the game; /api is proxied to the server)
pnpm test                   # shared + game + server tests
```

Node 22+ (uses built-in `node:sqlite`) and pnpm. The server listens on 127.0.0.1 only; set `HOST=0.0.0.0` to let phones on the same network reach it (then also keep `MUBIT_LIVE` off or rely on the 30-live-calls-per-minute cap). The server reads `.env` from the repo root. The game plays without the server: it falls back to the same rules code locally.

## Mubit is OFF by default (credits are limited)

Nothing is sent to Mubit unless **both** are set: `MUBIT_LIVE=1` in the server's environment and a key in `.env` (`MUBIT_API_KEY=mbt_...`; copy `.env.example`, which also says where each value comes from). Without them the server answers with the deterministic rules plan and says so on screen.

This project's provider key in Mubit is Groq, so calls go to `https://api.mubit.ai/compat/groq/v1` with model `openai/gpt-oss-120b` (`.env.example`). Groq's free tier allows about 8,000 tokens a minute (about 3 plans), so set `MUBIT_PER_MINUTE=3` for live play; beyond that the rules plan answers and the screen says "planned locally".

Live scripts refuse to run without `MUBIT_LIVE=1` **and** `--yes-live`:

```powershell
cd server
pnpm gen:seed; pnpm gen:heldout                         # local, free: data/seed.json (80), data/heldout.json (60)
pnpm eval --label baseline                              # local, free: the rules table as a baseline row
# LIVE (spends credits; in order):
#   tsx scripts/smoke.ts --yes-live                      one call
#   tsx scripts/send_seed.ts --yes-live                  80 calls, storage ON: this is what Mubit trains on (done once; ~25 min, paced to the token window)
#   pnpm eval --label provider --yes-live --notes "..."  60 calls, storage OFF
$env:MUBIT_LIVE="1"; $env:MUBIT_PER_MINUTE="3"; pnpm -C server start   # live play
```

`server/src/prompts/general_plan.ts` (system prompt + schema + model) is **frozen** now that the seed is sent: any edit starts a new, empty Mubit task. `server/test/frozen.test.ts` pins its hash. Mubit trains an adapter (a small model for this one task) once it keeps 25 examples, and tests it against the provider model's answers; watch Tasks and Adapters in the Mubit console. Whether an adapter then serves live traffic is not documented by Mubit; the game does not depend on it.

Check the whole loop with real fights: `node game/tools/learncheck.mjs 3 mix` (needs the server live and the preview on 5410).

## Controls

Mouse and keyboard (from the base): LMB / J strike, RMB / K guard (tap just before a blow lands to deflect), Shift step, Space jump, R gourd, WASD move, Q lock-on. F1 opens Settings: every control, the moves list (Kaede and each general, with how to answer), sound (master, music, effects, mute).

Optional hand control (`G`, or `?gestures=1`): your left hand is a movement stick; for everything else you train your own hand poses (F1 > Hands > Train my poses): one pose per action, read from a single camera frame. Poses and video stay in the browser.

URL options: `?name=` player name, `?quality=low|high`, `?replay=1` (serve stored plans, labelled replay), `?gestures=1`, `?difficulty=easy|medium|hard`.

Host key: `H` on the end screen teaches the General a rule and re-sends that fight with it. It needs `HOST_TOKEN` set on the server (the game asks for it once per tab); without a token the endpoint is disabled.

## What is where

```
game/      the forked duel + learn/ (summary, session, planLoader), ui/Council, input/gestures
shared/    pure logic used by game and server: habits, plan contract + validator, knob tables, grader
server/    Express API, node:sqlite memory, Mubit client + frozen task, eval harness, dashboard
data/      seed.json, heldout.json (committed); calls.csv and eval/ (git-ignored)
```

See `NOTICE.md` for third-party credits and the unresolved asset-licence note.