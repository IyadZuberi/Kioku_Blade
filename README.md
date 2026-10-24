# The General Remembers

A browser samurai duel (a fork of [shinobi-duel](https://github.com/StarKnightt/shinobi-duel), MIT) whose general learns. After every fight his next fight is re-planned from how you fought and from everyone who fought him before. The planning call is one frozen task, `general_plan`, that goes through [Mubit](https://mubit.ai).

Built for the Night Shift hackathon (London, 23-25 Oct 2026). Design: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/`. Evidence: `docs/verification.md`. Demo: `docs/demo-script.md`.

## Run it

```powershell
pnpm install
pnpm -C server start        # http://localhost:8787  (API + /dashboard)
pnpm -C game dev            # http://localhost:5411  (the game; /api is proxied to the server)
pnpm test                   # shared + game + server tests
```

Node 22+ (uses built-in `node:sqlite`) and pnpm. The game plays without the server: it falls back to the same rules code locally.

## Mubit is OFF by default (credits are limited)

Nothing is sent to Mubit unless **both** are set: `MUBIT_LIVE=1` in the server's environment and a key in `.env` (`MUBIT_API_KEY=mbt_...`, copy `.env.example`). Without them the server answers with the deterministic rules plan and says so on screen ("planned by the rules table").

Live scripts refuse to run without `MUBIT_LIVE=1` **and** `--yes-live`:

```powershell
cd server
pnpm gen:seed; pnpm gen:heldout                         # local, free: data/seed.json (80), data/heldout.json (60)
pnpm eval --label baseline                              # local, free: the rules table as a baseline row
# LIVE (spends credits; do these in order, after reading docs/notes/wiring.md):
#   tsx scripts/smoke.ts                                 one call: does strict json_schema work on starter credit?
#   tsx scripts/send_seed.ts --yes-live                  80 calls, storage ON: this is what Mubit trains on
#   pnpm eval --label provider --yes-live --notes "..."  60 calls, storage OFF
```

`server/src/prompts/general_plan.ts` (system prompt + schema + model) is **frozen once the seed is sent**: any edit silently starts a new, empty Mubit task.

## Controls

Mouse and keyboard (from the base): LMB / J strike, RMB / K guard (tap just before a blow lands to deflect), Shift step, Space jump, R gourd, WASD move, Q lock-on.

Optional hand gestures (`G`, or `?gestures=1`): a fist is the guard, a fast sideways swipe strikes, a fast downward swipe steps, a fast upward flick jumps. Movement and the gourd stay on the keyboard. Video never leaves the browser. Needs a webcam and has not been tested with a real hand yet (see `docs/verification.md`).

URL options: `?name=` player name, `?quality=low|high`, `?theme=snow` (original look), `?replay=1` (serve stored plans, labelled replay), `?gestures=1`, `?difficulty=easy|medium|hard`.

Host key: `H` on the end screen teaches the General a rule and re-sends that fight with it. It needs `HOST_TOKEN` set on the server (the game asks for it once per tab); without a token the endpoint is disabled.

## What is where

```
game/      the forked duel + learn/ (summary, session, planLoader), ui/Council, input/gestures
shared/    pure logic used by game and server: habits, plan contract + validator, knob tables, grader
server/    Express API, node:sqlite memory, Mubit client + frozen task, eval harness, dashboard
data/      seed.json, heldout.json (committed); calls.csv and eval/ (git-ignored)
```

See `NOTICE.md` for third-party credits and the unresolved asset-licence note.