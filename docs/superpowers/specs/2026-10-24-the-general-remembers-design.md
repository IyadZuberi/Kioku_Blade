# The General Remembers — Design

Status: approved by Iyad in chat (24 Oct 2026). Hackathon: Night Shift (Mubit), London, 23–25 Oct 2026. Code freeze Sun 25 Oct 10:00 GMT; our own submit target 09:30 GMT.

Tags used below: **[VERIFIED]** read in Mubit docs or in the base repo's code. **[UNVERIFIED]** assumption to check before relying on it. **[DECISION]** a call made by the design; change freely.

## 1. Intent

A browser samurai duel in which the boss, a general, learns. After every fight an LLM reads how the player fought and plans the general's next fight. The crowd's data makes the general stronger for everyone. That repeated planning call is the single task Mubit records, scores and (when it passes) distils into a small model.

Why this exists: Iyad wants a fun, good-looking game for the hackathon, not a tool. The hackathon scores Use of Mubit, Usefulness, Technical execution and Demo. Hard rule: every LLM call must go through Mubit, and all code must be written during the event.

One-line pitch: "A samurai general who studies every duel. He learns you, and he learns everyone who has ever fought him."

## 2. Goals, non-goals, anti-goals

Goals
- A playable, good-looking Sekiro-style duel that a judge can learn in under a minute.
- A visible "it learned me" moment between fights, using the player's real numbers.
- A general who gets harder as more players play, while staying beatable.
- A clean Mubit story: one frozen task, a held-out evaluation, version snapshots, honest status, real latency and cost numbers.
- Mouse and keyboard as the always-working path; hand gestures as an optional extra.

Non-goals
- Enemy waves, minions, multiplayer, new boss animations, a rebuilt Blender arena, voice, LLM calls per frame.

Anti-goals (a failure even if it technically works)
- The general feels unfair or unbeatable. Telegraphs and deflect windows must never be tightened below the tested values.
- A late or broken LLM call stalls a frame or blocks the fight.
- Numbers on screen that are not real (invented scores, latencies or costs).
- Changing the frozen prompt/schema/model after seeding starts, which silently starts a new Mubit task with 0 examples.

## 3. Base project

We fork `StarKnightt/shinobi-duel` (https://github.com/StarKnightt/shinobi-duel). Code is MIT [VERIFIED, LICENSE file]. Created Sep 2026, 7 stars, one author. Stack: Three.js 0.186, TypeScript, Vite, pnpm (not npm), postprocessing + N8AO, Web Audio, Blender-built arena GLB, Mixamo characters.

Known licence issue [VERIFIED]: the repo's LICENSE file mentions Counter-Strike "dust2" textures and a "Soldier.glb", which does not match the README (Mixamo kunoichi/general, Poly Haven textures). The MIT part covers the code. Asset terms must be checked before shipping. Mixamo terms allow use in games but forbid redistributing raw files. The README states the game wants a desktop GPU (measured on an RTX 4060, ~22 MB download).

Already in the base (not built by us) [VERIFIED by reading code/README]:
- Full duel loop: deflect → posture → deathblow, two phases, resurrection, healing gourd, perilous attacks (thrust, sweep, grab), lock-on third-person camera.
- Boss attacks: `leap`, `combo`, `comboDelay`, `overhead`, `thrust`, `sweep`, `grab`, `flurry` (`src/game/Boss.ts`).
- `src/game/difficulty.ts`: one object `DIFFICULTY` with every boss tuning knob (`picks.p1/p2` pick weights, `tempo`, `gap`, `counterFlurry`, `bossDeflect`, `recoverAfterAttack`, `deflectEarly/Late/Steps`, etc.), plus easy/medium/hard presets applied in place.
- `Boss.queue`: a queue of attack names consumed by `choose()`; `Boss.choose()` weights picks from `DIFFICULTY.picks`.
- `DuelStats` in `src/game/Game.ts`: deflects, lateDeflects, blocks, hitsTaken, dodged, nearMisses, playerHits, bossBlocks, bossDeflects, breaks, deathblows, finishers, mikiri, sweepsJumped, headKicks, kicks, grabbed, grabsEvaded, heals, punishes, resurrections, victory, deaths, defeats, timings[], contactErr[], hitLog[], maxPostureSeen.
- `src/core/Input.ts`: six actions (`attack`, `block`, `dodge`, `jump`, `lock`, `heal`) driven by `press(action, source)` / `release(action, source)`.
- Headless test tools in `tools/` (bot, mech, combat, deathloop, fairness, difficulty, soak, perf) that need a GPU-backed Chromium.

Not in the base: any server, database, network call, enemy waves or gestures. `Boss.ts`, `Game.ts` and `Player.ts` were only partly read; the exact wiring points must be confirmed by reading them in full during plan task 1.

## 4. What we add

1. A small server with a database and the Mubit client (shared module, server-side only).
2. `habits.ts`: turns `DuelStats` into habit labels with strengths.
3. The `general_plan` Mubit task: frozen prompt file, strict JSON schema, validator, deterministic rules-plan fallback.
4. A plan loader that applies a plan to the boss (opening strings via `Boss.queue`, pick weights, tempo, gap, counter behaviour).
5. Player memory and global (crowd) memory; a Boss Level derived from total fights.
6. The Council screen (between fights) and a short debrief.
7. Eval harness: seeding script, held-out set, snapshots, version dashboard.
8. Optional MediaPipe hand-gesture adapter feeding `Input.press/release`.
9. Visual retheme toward a Ghost of Tsushima mood (stretch): golden-hour grade, drifting leaves/petals replacing snow.

## 5. Player experience

First fight (~90 s): title → nickname → a normal duel against the base general → Council screen (the planning call ran in the background) saying what the general noticed, with real numbers → rematch against a plan built for that player.

Later fights: opening strings, mix-ups (feints via `comboDelay`), emphasis and tempo tuned to the player's habits.

Returning player: banner "The General has fought N duels since you left. Boss level L." plus the player's personal Grudge.

Losing: the base game already lets the player rise once at half vitality. On a full defeat the player's Grudge rises, so the next plan targets that player's habits more precisely. After two defeats in a row, raw tempo relaxes one step while targeting stays. [DECISION] Reason: a large randomised field experiment found lowering difficulty increased engagement and retention (Ascarza, Netzer, Runge; Columbia). A flat "lose → harder" rule risks quitting. The design makes it feel harder (smarter) without being less fair.

## 6. Learning model

Two layers, stated in every pitch:
1. Instant memory: player habits, past plans and what worked, plus crowd statistics go into the next `general_plan` user message. Live, next fight.
2. Mubit: the repeated call is recorded; the provider model's rule-following answers become kept examples; Mubit trains an adapter and tests it against the provider's answers. Shown as labelled version snapshots ("trained overnight"), never as a live switch unless Mubit staff confirm serving.

### Habits (`habits.ts`) — thresholds tuned in testing [DECISION]
| Habit | Signal from DuelStats | Counter emphasis |
|---|---|---|
| block_holder | many blocks, few deflects | thrust, grab, faster strings |
| deflect_expert | high deflects, tight timings | comboDelay feints, longer strings |
| dodge_spammer | high dodged | sweep, flurry |
| jump_dependent | high sweepsJumped | overhead, thrust |
| heal_greedy | early/many heals | quick punish, pressure |
| passive | low playerHits | pressure, shorter gaps |
| aggressive | high playerHits and hitsTaken | guard-turning (bossDeflect), counters |

## 7. The Mubit task: `general_plan`

One task only [DECISION]. A second task would need its own 25 kept examples and compete for the training limit.

Mubit facts relied on [VERIFIED in docs.mubit.ai]:
- Base URL for OpenAI SDK: `https://api.mubit.ai/openai/v1`. Send only the Mubit key (`mbt_...`); a second/provider key gives 401. Server-side only (no CORS).
- Starter credit serves a fixed model list (examples in docs: `gpt-6-luna`, `claude-haiku-4-5`, `gemini-3.8-flash`); other models give `400 starter_credit_model`; some paths give `403 starter_credit_route`.
- A task = same instructions (system prompt), tools, tool choice, output format and model. Messages after the instructions, `temperature`, etc. do not split it. Other varying words in the instructions do.
- Session = first of `metadata.thread_id`, `metadata.session_id`, `metadata.conversation_id`; Mubit sets test cases aside by session; values over 200 chars are hashed.
- First training at 25 kept examples (console count is authoritative). Statuses: Collecting examples, Reviewing examples, Training, Testing. Daily training limit resets 00:00 UTC (= 01:00 BST Sun 25 Oct; clocks go back at 02:00 BST); a pause between trainings; numbers and training duration not documented.
- Version results: Passed, Below target, Malformed tool calls, Prompt only, Not tested. "Passed" means agreement with the provider model, not ground truth.
- `x-middleware-store: false` keeps a call out of Requests and out of training. Every response carries `x-middleware-request-id` (`mreq_...`).
- No correction/feedback API. Console has Good/Bad rating (effect on training unknown).
- Try models: compare a passing adapter with the provider; calls not stored; 3 adapter starts per UTC day per organisation. No Mubit model ID exists; adapters cannot be called by name.
- The docs fetched do not say that adapters serve live traffic. Treat live switching as unknown; ask staff.

Unverified and to be tested with one real call before seeding [UNVERIFIED]: whether `response_format: json_schema` (strict) is accepted on the starter credit; whether `metadata` is passed correctly on Chat Completions. If json_schema is refused, use `json_object` plus schema text in the system prompt plus local validation, and never switch afterwards.

### Input (the user message, JSON)
Fight number, boss level, a DuelStats summary, top habits with strengths and short evidence strings, player memory (previous plans and outcomes), global memory (habit prevalence across players, which boss moves hurt players most), unlocked move set, designer rules (corrections), and bounds (max string length, tempo/gap step ceilings for this boss level).

### Output (strict JSON, enum-only so a small model can copy it)
- `focus_habit`: one habit id or `none`.
- `opening_strings`: up to 3 strings, each up to 4 attacks from the 8 real moves.
- `emphasis`: per move `low | normal | high`.
- `tempo_step`: integer 0–4. `gap_step`: integer 0–3.
- `intel`: one sentence, at most 25 words. `taunt`: at most 12 words.
The LLM never writes raw numbers; code maps steps and emphasis onto `DIFFICULTY` knobs.

### Validator (server and client) — clamp, never crash
JSON/schema valid; moves legal; string and count caps; tempo/gap steps within the boss-level ceiling; deflect windows never tightened; no two perilous attacks back to back outside strings (the base already enforces this in `choose`); text length and a profanity filter. `valid` is "zero failures before clamping" (this is the valid-plan metric). If empty after clamping or the call fails/times out, use the deterministic rules plan (habit table) and log it.

### Correction loop
Invalid plans and operator overrides become designer rules (max ~15, dedupe, stored in the DB). The same input is re-sent with the rules and a new `session_id` (storage on), so the corrected answer is recorded as a kept example.

### Frozen files and hygiene
System prompt, schema and model live in one file (`server/prompts/general_plan.ts`), hashed at startup and logged; alarm if the hash changes. Everything variable goes in the user message. Every call has a unique `session_id` (`gr-seed-<i>`, `gr-live-<player>-<fight>`, `gr-fix-<uuid>`, `gr-eval-<label>-<i>`). Held-out eval calls always send `x-middleware-store: false`. No browser code ever imports the Mubit client. Never block a render frame on an LLM call.

## 8. Difficulty escalation (fair)

- Boss Level = f(total fights across all players), stored globally [DECISION]. Each level raises the allowed string variety, the `tempo_step` ceiling and mix-up weight.
- The base's HARD preset (tested against its frame-perfect bot) is the known-fair ceiling. Beyond it is untested. Either stay within HARD-level knobs or certify a higher envelope once with the bots [stretch].
- Telegraphs and deflect windows never shrink. The player always has a valid answer.
- The base's bots run in real time on a GPU-backed headless Chromium (roughly 1–2 minutes per fight) [UNVERIFIED timing], so they cannot gate every live plan. We certify the envelope of allowed knobs once; the validator keeps every plan inside it.

## 9. Evaluation (the Use-of-Mubit score)

- Seed: 80 synthetic fights generated from parameterised archetypes (blocker, expert, dodger, jumper, greedy-healer, passive, aggressive, plus mixed and "no strong habit"), habits computed by `habits.ts`, sent with storage on, unique session each, concurrency ≤ 4. Acceptance: Mubit console shows exactly one task, kept count rising toward 25.
- Held-out: 60 different items (different RNG seed, hash-checked against seed), never stored.
- Metrics per version (`baseline` rules table, `provider`, `v1`, `v2`): valid-plan rate; habit-target accuracy (plan's emphasis/strings include an accepted counter for the top habit); agreement with the provider (same focus and same emphasized moves); bound violations (must be 0); p50 and p95 latency; cost per 1,000 plans from logged tokens × published prices + Mubit's $5 per 1,000 runs. Honest framing: Mubit's run fee is higher than a cheap model's tokens, so savings are against a frontier model, plus latency and owning a downloadable model.
- Record the console's "Served by" value and adapter History status manually per snapshot.
- Self-grading caveat to state aloud: habit labels come from our own table. The baseline is shown; the LLM's value is combining several habits, memory, bounds and writing intel/taunt.

## 10. Controls and gestures

Mouse and keyboard work in the base and are the default demo path. Gestures are optional: a MediaPipe Hand Landmarker adapter calls `Input.press/release`. Proposed mapping [DECISION]: right-hand slash = attack, left fist held = block, quick left-hand flick = deflect tap, sideways lean/swipe = dodge, fast raise = jump, open palm held = heal; lock-on automatic. Risk: the deflect window is 0.25 s on Medium and webcam latency eats part of it; widen `deflectEarly` in gesture mode and measure on the demo laptop. Hand tracking runs locally; video never leaves the browser.

## 11. Architecture and stack

- Client: the forked Vite + TypeScript + Three.js game. New client modules: `net/api.ts` (fetch to our server), `learn/habits.ts`, `learn/planLoader.ts`, `ui/Council.ts`, optional `input/gestures.ts`.
- Server [DECISION]: Node + TypeScript, Express-style routes, SQLite (`better-sqlite3`) for the hackathon; a hosted database is an option if a public URL is needed. Routes: `POST /api/fight-end` (stats → plan), `POST /api/override`, `GET /api/stats`, `GET /api/global`.
- Shared package: `packages/mubit` (client, eval, cost) per the handover.
- Dashboard: reads `data/eval/summary.csv` and `data/calls.csv` through `/api/stats`.
- Deployment: local server with phone hotspot as primary; optional public deploy. [DECISION] Decide after the game runs.

## 12. Scope

MVP: fork running with a measured frame rate; server + DB; habits; `general_plan` + validator + rules plan + loader; Council screen; player + global memory; Boss Level; seeding + held-out eval; version dashboard.
Nice: debrief bars (fight 1 vs 2); Hall of Fame; gestures; leaves/petals + golden-hour grade; "what Mubit saw" panel (live Requests count, kept count, version status).
Stretch: certified higher ceiling; retinue mooks; daily duel; spectator view.
Cut: waves, new boss animations, PvP, per-frame LLM, rebuilt arena.

## 13. Demo (3 minutes)

0:00–0:15 hook ("Game bosses never learn you. Ours does, and its brain gets cheaper."). 0:15–1:30 a judge plays a fight. 1:30–1:50 Council screen with their numbers and the general's plan. 1:50–2:20 short rematch showing the new strings. 2:20–2:50 version slide (labelled "trained overnight"): baseline, provider, v1, v2 on the metrics above; Mubit console Requests shows the judge's live call. 2:50–3:00 close. Backup: mouse mode; replay of stored plans (labelled "replay"); recorded video; console History screenshots; phone hotspot.

## 14. Judging self-assessment (honest)

Use of Mubit 4 (5 only if a version passes); Usefulness 2–3 (games-industry AI director affordable at scale); Technical 4; Demo 5 if the GPU laptop holds frame rate. Track: Own your intelligence layer.

## 15. Risks

- "It is just difficulty knobs with a chatbot": defend with habit-targeted strings, crowd memory, and the measured versioned eval.
- Self-graded labels (see section 9).
- Small single-author base with an inconsistent LICENSE file; verify asset terms.
- Desktop-GPU requirement; test on the demo laptop first.
- A duel is short; the judge sees one or two fights, so seeded history and the dashboard must carry the learning story.
- Mubit "small model takes over" cannot be promised; training time and limits unknown.
- Gestures under hall lighting and webcam latency.
- Unverified items listed in section 7.
- pnpm is not installed on this machine (Node v24.21.0, git 2.55.0 present); install via corepack or npm before running the base.

## 16. Left to the builder

File layout within the given modules; exact threshold values in `habits.ts`; exact mapping from emphasis/steps to `DIFFICULTY` values (within validator bounds); UI styling of the Council screen in the base's ink style; database schema details.
