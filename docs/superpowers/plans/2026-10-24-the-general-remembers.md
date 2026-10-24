# The General Remembers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser samurai duel (forked from `shinobi-duel`) whose general is re-planned after every fight by one frozen Mubit task, `general_plan`, with crowd memory, a fairness validator, and a scored version dashboard.

**Architecture:** The forked Vite/Three.js game lives in `game/`. After a fight it posts a stats summary to a small Node server (`server/`), which builds the `general_plan` user message, calls Mubit through one shared client, validates and clamps the answer, and returns a `Plan`. The game maps the plan's enums onto the existing `DIFFICULTY` knobs and `Boss.queue`. Pure logic (habits, plan contract, validator, rules plan) lives in `shared/` so client and server run identical code. A deterministic rules plan covers every failure, so the fight is never blocked.

**Tech Stack:** TypeScript (ESM), Node 22+ (machine has v24.21.0), pnpm workspace (pnpm must be installed first), Vite, Three.js 0.186, vitest, Express 5, built-in `node:sqlite`, `openai` SDK, `seedrandom`, `@mediapipe/tasks-vision` (optional gestures), Playwright for browser verification.

**Spec:** `docs/superpowers/specs/2026-10-24-the-general-remembers-design.md`. Read it first; it holds the Mubit facts and the reasons.

## Global Constraints

- Project root is `C:\NightShift-Hackathon\the-general-remembers`. All work happens inside it. Shell is PowerShell; commands below are PowerShell-safe.
- Every LLM call goes through the single Mubit client in `server/src/mubit/client.ts`. No direct provider SDK use, no LLM call from browser code. The Mubit key (`mbt_…`) lives only in `.env` (git-ignored) and is sent as the only key.
- Mubit base URL `https://api.mubit.ai/openai/v1`; starter-credit model from `.env` `MUBIT_MODEL` (docs example `gpt-6-luna`; confirm in the Mubit console).
- The task's system prompt, JSON schema and model live only in `server/src/prompts/general_plan.ts`, are hashed at startup and logged, and are never edited after seeding starts. Everything that varies goes in the user message (JSON string).
- Session ids: `gr-seed-<i>`, `gr-live-<nickname>-<fightId>`, `gr-fix-<uuid>`, `gr-eval-<label>-<i>`, `gr-replay-<uuid>`. Held-out eval and any non-learning call send header `x-middleware-store: false`.
- The LLM output is enums only (no raw numbers). Deflect windows (`deflectEarly`, `deflectLate`, `deflectSteps`) and telegraphs are never tightened by any plan. Phase 1 `tempo` stays 1 (the base's combo lunges are tuned to it). Phase 2 `tempo` never exceeds 1.12 (the base HARD preset). Gap values never go below the HARD preset's `gap`.
- Never block a render frame on a network call; any failure, timeout (6 s) or invalid plan falls back to the local rules plan and is logged.
- Show only real numbers (from `data/calls.csv` and `data/eval/summary.csv`). Label overnight results "trained overnight" and replays "replay". Synthetic data only; video never leaves the browser.
- Do not ship Valve/Counter-Strike assets or raw Mixamo files; keep third-party credits in `NOTICE.md`.
- Git: commit at the end of every task. End every commit message with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Hackathon clock: code freeze Sun 25 Oct 10:00 GMT, submit by 09:30 GMT. Mubit's daily training limit resets 00:00 UTC (01:00 BST Sun). Clocks go back 02:00 BST Sun.

## Review Focus

1. **Idle or zero-activity player** (never attacked, never blocked, fight ends at once): stats are all zero or null; habits must return `none`/empty without NaN or division by zero, and the plan must still validate. Pinned in Task 1 and Task 2.
2. **Mubit unreachable or refusing** (timeout, network error, 401, `400 starter_credit_model`, `403 starter_credit_route`, non-JSON reply): the route returns the rules plan with `source: "rules"`, the fight is not blocked, the failure is logged. Pinned in Task 3 and Task 5.
3. **Hostile or broken plan** (illegal move name, 50 strings, string of 30 attacks, empty `emphasis`, over-length text, wrong types): validator clamps or rejects, never throws; empty-after-clamp becomes the rules plan. Pinned in Task 2.
4. **Hostile nickname** (empty, 500 chars, emoji, text that looks like instructions, SQL-ish characters): normalised to ≤ 20 safe characters; because the user message is JSON, it cannot alter the instructions. Pinned in Task 5.
5. **Duplicate or concurrent submissions** (same `fightId` posted twice, two players at once): `fight-end` is idempotent per `fightId`; global counters do not double count. Pinned in Task 5.

---

## File Structure

```
the-general-remembers/
  package.json  pnpm-workspace.yaml  tsconfig.base.json  .env.example  .gitignore  NOTICE.md  CLAUDE.md  README.md
  game/                      # fork of shinobi-duel (own package.json), + new dirs below
    src/learn/               # session.ts  summary.ts  planLoader.ts
    src/ui/Council.ts        # Council screen, debrief, boss-level banner, Mubit panel
    src/input/gestures.ts    # optional MediaPipe adapter
  shared/                    # pure, no DOM, no Node-only APIs
    src/types.ts  habits.ts  plan.ts  knobs.ts  grade.ts  index.ts
    test/*.test.ts
  server/
    src/index.ts  app.ts  db.ts  memory.ts  bossLevel.ts  sanitize.ts
    src/mubit/client.ts  cost.ts  log.ts
    src/prompts/general_plan.ts
    src/sim/archetypes.ts
    scripts/smoke.ts  gen_seed.ts  gen_heldout.ts  send_seed.ts  eval.ts
    dashboard/index.html
    test/*.test.ts
  data/                      # seed.json heldout.json calls.csv eval/ replay.json  (git-ignored except heldout/seed)
  docs/notes/wiring.md       # Task 0 output
```

---

### Task 0: Bootstrap the workspace and fork, record the wiring

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `NOTICE.md`, `CLAUDE.md`, `docs/notes/wiring.md`
- Create: `game/` (copy of `https://github.com/StarKnightt/shinobi-duel`, minus `.git`)

**Interfaces:**
- Produces: a working `pnpm -C game dev` (port 5411) and `pnpm -C game build`; `docs/notes/wiring.md` listing exact file:line seams used by Tasks 7–10.

- [ ] **Step 1: Install pnpm** (`corepack enable; corepack prepare pnpm@latest --activate`, or `npm i -g pnpm`). Run `pnpm -v`. Expected: a version number.
- [ ] **Step 2: Fork into `game/`.** Clone the repo into a temp directory outside the project, copy everything except `.git` into `game/`, keep its `LICENSE` and `README.md`. Set the root `pnpm-workspace.yaml` to `game`, `shared`, `server`. `.gitignore` must exclude `.env`, `node_modules`, `dist`, `data/calls.csv`, `data/eval/`.
- [ ] **Step 3: Run it.** `pnpm install; pnpm -C game build; pnpm -C game dev`. Open `http://localhost:5411` in Chrome/Edge (desktop GPU). Expected: title screen, a fight starts on a key press. Record frame rate (the base exposes `window.__duel`; also `?debug` options in its README) and the machine's GPU in `docs/notes/wiring.md`.
- [ ] **Step 4: Read in full** `game/src/game/Boss.ts`, `Game.ts`, `Player.ts`, `core/Input.ts`, `ui/Hud.ts`, `ui/brush.ts`, `fx/Snow.ts`. In `docs/notes/wiring.md` write, with file:line: (a) where `applyDifficulty` is called (a plan must be applied **after** it, because it overwrites `DIFFICULTY`); (b) how `Boss.queue` is filled and consumed; (c) the exact attack name strings (confirm they equal `leap|combo|comboDelay|overhead|thrust|sweep|grab|flurry`); (d) where the fight ends (victory, defeat, resurrection) and where `DuelStats` is final; (e) the format of `hitLog` strings; (f) where `Hud` shows end screens; (g) the `Input.press/release` signatures; (h) whether any existing `fetch`/`localStorage` use conflicts. Mark anything that contradicts the spec.
- [ ] **Step 5: Write `NOTICE.md`** crediting shinobi-duel (MIT), Mixamo (Adobe terms, no raw files), Poly Haven (CC0), Three.js/postprocessing/N8AO, and note the LICENSE-file mismatch (dust2/Soldier.glb) as "to verify". Write a short root `CLAUDE.md` pointing to the spec, this plan, and the Global Constraints.
- [ ] **Step 6: Commit** `chore: bootstrap workspace and fork shinobi-duel`.

---

### Task 1: Shared types and habit detection

**Files:**
- Create: `shared/package.json`, `shared/src/types.ts`, `shared/src/habits.ts`, `shared/src/index.ts`, `shared/test/habits.test.ts`

**Interfaces:**
- Produces (in `shared/src/types.ts`):
  - `type Move = "leap"|"combo"|"comboDelay"|"overhead"|"thrust"|"sweep"|"grab"|"flurry"`; `const MOVES: readonly Move[]`
  - `type HabitId = "block_holder"|"deflect_expert"|"dodge_spammer"|"jump_dependent"|"heal_greedy"|"passive"|"aggressive"`; `const HABITS: readonly HabitId[]`
  - `type Level3 = "low"|"normal"|"high"`
  - `interface StatsSummary { fightSeconds:number; deflects:number; lateDeflects:number; blocks:number; hitsTaken:number; dodged:number; playerHits:number; sweepsJumped:number; grabbed:number; grabsEvaded:number; heals:number; firstHealAtSeconds:number|null; medianDeflectTiming:number|null; victory:boolean; deaths:number; hitsByMove: Partial<Record<Move,number>> }`
  - `interface HabitScore { habit:HabitId; strength:number /*0..1*/; evidence:string }`
  - `interface Plan { focus_habit:HabitId|"none"; opening_strings:Move[][]; emphasis:Record<Move,Level3>; tempo_step:0|1|2|3|4; gap_step:0|1|2|3; intel:string; taunt:string }`
- Produces (in `shared/src/habits.ts`): `computeHabits(s: StatsSummary): HabitScore[]` (sorted by strength desc, only habits with strength > 0, max 3) and `ACCEPTED_COUNTERS: Record<HabitId, Move[]>` (block_holder→thrust,grab,flurry; deflect_expert→comboDelay,flurry; dodge_spammer→sweep,flurry; jump_dependent→overhead,thrust; heal_greedy→leap,combo; passive→flurry,leap; aggressive→comboDelay,thrust).

- [ ] **Step 1: Write failing tests** in `shared/test/habits.test.ts` (vitest): `idle player returns [] without NaN` (all zeros, null timings); `block-heavy stats put block_holder first with strength in (0,1]`; `dodge-heavy stats rank dodge_spammer first`; `jump-heavy ranks jump_dependent first`; `strengths never exceed 1 for huge inputs`; `evidence strings contain the real numbers` (e.g. "blocked 14 times, deflected 2").
- [ ] **Step 2:** `pnpm -C shared test`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `computeHabits`. Per-habit rules from spec §6; strength = how far past its threshold, clipped to 0..1. Guard every ratio against zero denominators. Thresholds as named constants at the top of the file so they can be tuned in one place.
- [ ] **Step 4:** run tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(shared): types and habit detection`.

---

### Task 2: Plan contract — schema, validator, rules plan, knobs, boss-level limits

**Files:**
- Create: `shared/src/plan.ts`, `shared/src/knobs.ts`, `shared/test/plan.test.ts`, `shared/test/knobs.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:
  - `plan.ts`: `PLAN_SCHEMA: object` (strict JSON Schema; all enums; `additionalProperties:false`); `interface Limits { maxStrings:number; maxStringLen:number; maxTempoStep:number; maxGapStep:number }`; `limitsForLevel(level:number): Limits` (level 1 → 1 string, len 2, tempo 0, gap 0; level 10 → 3 strings, len 4, tempo 4, gap 3; monotonic); `validatePlan(raw: unknown, limits: Limits): { plan: Plan; valid: boolean; failures: string[] }` (never throws; `valid` = zero failures before clamping; failure codes `invalid_json`, `bad_move`, `too_many_strings`, `string_too_long`, `step_over_limit`, `bad_text`, `missing_emphasis`); `rulesPlan(habits: HabitScore[], level:number): Plan` (always valid).
  - `knobs.ts`: `TEMPO_P2_BY_STEP: readonly number[]` (step 0 → 1.02 … step 4 → 1.12); `GAP_BY_STEP: readonly {p1:[number,number]; p2:[number,number]}[]` (step 0 = MEDIUM gaps, step 3 = HARD gaps); `EMPHASIS_FACTOR: Record<Level3, number>` (low 0.5, normal 1, high 1.8); `applyEmphasis(base: Record<string,number>, e: Record<Move,Level3>): Record<string,number>` (returns normalised weights, keeps `idle`).

- [ ] **Step 1: Write failing tests.** `validatePlan`: `accepts the rules plan for every habit and level 1..10`; `rejects illegal move with bad_move and drops it`; `50 strings clamp to limits.maxStrings and report too_many_strings`; `string of 30 attacks clamps to maxStringLen`; `tempo_step above the level ceiling clamps and reports step_over_limit`; `non-object input returns the rules plan, valid=false, no throw` (try `null`, `"x"`, `[]`, `{}`); `intel over 25 words truncates and reports bad_text`; `taunt over 12 words truncates`. `limitsForLevel` monotonic across levels. `knobs`: `applyEmphasis result sums to 1 and high > normal > low for the same base`; `GAP_BY_STEP[3] equals the base HARD gap` (copy the HARD values from `game/src/game/difficulty.ts`); `TEMPO_P2_BY_STEP max is 1.12`.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement** both files. `rulesPlan` picks the strongest habit, maps `ACCEPTED_COUNTERS` to `high` emphasis, builds one or two strings from those counters (respecting limits), and sets tempo/gap steps from level. Text for `intel` is built from the habit's evidence string.
- [ ] **Step 4:** run, expect PASS.
- [ ] **Step 5: Commit** `feat(shared): plan contract, validator, rules plan, knob tables`.

---

### Task 3: Mubit client, frozen task, cost maths, live smoke test

**Files:**
- Create: `server/package.json`, `server/src/mubit/client.ts`, `server/src/mubit/cost.ts`, `server/src/mubit/log.ts`, `server/src/prompts/general_plan.ts`, `server/scripts/smoke.ts`, `server/test/mubit.test.ts`, `.env` (local, from `.env.example`)

**Interfaces:**
- Consumes: `PLAN_SCHEMA`, `validatePlan`, `rulesPlan` from `shared`.
- Produces:
  - `client.ts`: `interface TaskDef<I,O> { name:string; model:string; system:string; schema:object; validate:(o:unknown)=>boolean; fallback:(i:I)=>O }`; `interface CallResult<O> { out:O; ok:boolean; latencyMs:number; requestId?:string; usage?:{prompt_tokens:number;completion_tokens:number}; raw?:string; error?:string }`; `callTask<I,O>(t:TaskDef<I,O>, input:I, opts:{sessionId:string; store:boolean; timeoutMs?:number; client?:OpenAILike}): Promise<CallResult<O>>`; `taskHash(t): string` (12-char sha256 of model+system+schema).
  - `log.ts`: `logCall(row: { ts:string; task:string; task_hash:string; session_id:string; store:boolean; ok:boolean; latency_ms:number; prompt_tokens?:number; completion_tokens?:number; request_id?:string; served_by:string; error?:string }): void` appends to `data/calls.csv` (creates header).
  - `cost.ts`: `costPer1k(a:{ inTok:number; outTok:number; inPricePerM:number; outPricePerM:number; mubitRunFee?:number /*default 5*/ }): number` = `1000*(inTok*in+outTok*out)/1e6 + mubitRunFee`.
  - `general_plan.ts`: `generalPlanTask: TaskDef<PlanInput, Plan>` and `interface PlanInput { fight:number; bossLevel:number; stats:StatsSummary; habits:HabitScore[]; playerMemory:object; globalMemory:object; unlocked:Move[]; designerRules:string[]; limits:Limits }`. System prompt text: the war-council role, habits→counters list (from `ACCEPTED_COUNTERS`), the rules "use only listed moves", "respect limits", "follow designer_rules above all", "intel ≤ 25 words, taunt ≤ 12 words, JSON only".

- [ ] **Step 1: Failing tests** (`server/test/mubit.test.ts`) using an injected fake client: `callTask returns ok with parsed plan and captured request id`; `network error returns fallback, ok=false, error set`; `non-JSON reply returns fallback`; `store:false adds header x-middleware-store: false, store:true adds none`; `session id lands in metadata.session_id`; `timeout returns fallback within timeoutMs+50`; `taskHash changes when system text changes`; `costPer1k(1500,100, 0.10,0.50) ≈ 5.2` (0.20 provider + 5 fee); `logCall writes a header once and one row per call`.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement** the files. The client constructs `new OpenAI({ baseURL, apiKey })` from env; use `.withResponse()` to read the `x-middleware-request-id` header; `response_format: { type:"json_schema", json_schema:{ name, strict:true, schema } }`, `temperature:0`. Write the system prompt once and treat it as frozen after Task 4.
- [ ] **Step 4: Live smoke** (`server/scripts/smoke.ts`): one real call with a hand-written `PlanInput`, `store:true`, session `gr-smoke-1`. Expected: valid plan, request id printed, call visible in the Mubit console Requests, task hash printed. **If strict `json_schema` is refused** (400/403), record it in `docs/notes/wiring.md`, switch the task once to `{ type:"json_object" }` plus the schema text inside the system prompt and rely on `validatePlan`, and do this **before** Task 4. Also confirm `metadata.session_id` appears in the console's session column.
- [ ] **Step 5: Ask Mubit staff** the open questions (spec §7: correction API/rating effect, live serving by adapters and what "Served by" shows, training duration/limits, whether training is on for this workspace, base model, json_schema on starter credit) and write the answers into `docs/notes/wiring.md`.
- [ ] **Step 6:** run tests, expect PASS. Commit `feat(server): mubit client, frozen general_plan task, cost`.

---

### Task 4: Archetypes, seed and held-out sets, send the seed

> Do this as early as possible: training duration is unknown, and the daily limit resets 00:00 UTC.

**Files:**
- Create: `server/src/sim/archetypes.ts`, `server/scripts/gen_seed.ts`, `server/scripts/gen_heldout.ts`, `server/scripts/send_seed.ts`, `server/test/archetypes.test.ts`, `data/seed.json`, `data/heldout.json`

**Interfaces:**
- Consumes: `computeHabits`, `limitsForLevel`, `PlanInput`, `callTask`.
- Produces: `type Archetype = HabitId | "mixed" | "none"`; `genStats(a:Archetype, rng:()=>number): StatsSummary`; `genInput(a:Archetype, rng:()=>number, i:number): PlanInput` (fight 1–6, boss level 1–10, varied player/global memory, 0–3 designer rules); item shape for held-out `{ id:string; input:PlanInput; label:{ primary:HabitId|"none"; accepted:Move[] } }`.

- [ ] **Step 1: Failing tests:** `genStats for each habit archetype makes that habit the top computeHabits result in ≥ 90% of 100 draws`; `genStats is deterministic for a fixed seed`; `seed and held-out inputs share no hash` (hash of `JSON.stringify(input)`); `no generated stats contain NaN or negatives`.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement** archetypes with `seedrandom`. `gen_seed.ts` writes 80 items (≈10 per habit family, ~10 mixed, a few `none`) with seed string `"gr-seed-1"`; `gen_heldout.ts` writes 60 labelled items with `"gr-heldout-1"`, deduped against the seed by hash.
- [ ] **Step 4:** run tests, expect PASS.
- [ ] **Step 5: Send the seed:** `send_seed.ts` posts each seed item through `callTask(generalPlanTask, input, { sessionId:"gr-seed-<i>", store:true })`, concurrency ≤ 4, retry 429/5xx with backoff, prints valid-plan rate. Run it. Expected: Mubit console Tasks shows exactly **one** task named from the system prompt, kept count rising toward 25. If two tasks appear, the prompt/schema/model changed: fix and tell the user before continuing. **From here the prompt file is frozen.**
- [ ] **Step 6: Commit** `feat(server): archetypes, seed and held-out sets; seed sent`.

---

### Task 5: Server — database, memory, boss level, routes

**Files:**
- Create: `server/src/db.ts`, `memory.ts`, `bossLevel.ts`, `sanitize.ts`, `app.ts`, `index.ts`, `server/test/app.test.ts`, `server/test/sanitize.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `sanitize.ts`: `cleanNickname(s:unknown): string` (trim, strip control/zero-width chars, collapse spaces, max 20 chars, empty→`"Wanderer"`).
  - `bossLevel.ts`: `bossLevel(totalFights:number): number` = `min(10, 1 + floor(totalFights/8))`.
  - `db.ts`: `openDb(path:string)` using built-in `node:sqlite`; tables `players(nickname PK, fights, wins, losses, consecutive_losses, grudge, habit_avgs JSON)`, `fights(fight_id PK, nickname, ts, stats JSON, habits JSON, plan JSON, source, valid, latency_ms, request_id)`, `global(key PK, value JSON)`, `rules(id, text, ts)`.
  - Routes (`app.ts`, `createApp(deps)` for tests): `POST /api/fight-end` body `{ fightId:string; nickname:string; fightNumber:number; stats:StatsSummary }` → `{ plan:Plan; source:"mubit"|"rules"; valid:boolean; failures:string[]; latencyMs:number; requestId?:string; bossLevel:number; grudge:number; intelLines:string[] }`; `GET /api/global` → `{ totalFights:number; bossLevel:number; habitPrevalence:Record<string,number>; moveDamage:Record<string,number> }`; `POST /api/override` `{ fightId:string; rule:string }` (Task 9 uses it; stub stores the rule); `GET /api/stats` (Task 6).
  - `intelLines` are built locally from the stats (e.g. "You blocked 14 times and deflected 2").

- [ ] **Step 1: Failing tests** (`createApp` with an injected fake `callTask`, in-memory db): `fight-end returns a valid plan from the fake Mubit and stores the fight`; `same fightId posted twice returns the stored plan and does not increment totalFights`; `two different players increment totalFights by 2`; `Mubit failure returns source "rules" with status 200`; `grudge rises by 1 on a defeat, resets 0 after a win; consecutive_losses ≥ 2 lowers the plan's tempo_step by one (never below 0)`; `cleanNickname("  ")→"Wanderer"`, `500-char name → 20 chars`, `zero-width and control characters removed`; `nickname containing "Ignore previous instructions" appears only inside the JSON user message, never in the system prompt` (assert on the captured request); `unknown fields in the body are ignored; missing stats → 400`.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement.** `fight-end` flow: sanitise → idempotency check → `computeHabits` → update memory → build `PlanInput` (player memory, global memory, `limitsForLevel(bossLevel)`, designer rules from DB) → `callTask` with `sessionId:"gr-live-<nick>-<fightId>"`, `store:true`, 6 s timeout → `validatePlan` → if the call failed, `valid` is false and use `rulesPlan` → persist → respond. Log every call through `logCall`. Add CORS only for the Vite dev origin; the Mubit key never leaves the server. Verify `node:sqlite` loads on this Node (v24.21.0); if it does not, fall back to `better-sqlite3` and note it in `docs/notes/wiring.md`.
- [ ] **Step 4:** run, expect PASS. Start the server (`pnpm -C server dev`, port 8787) and `curl` `/api/global`.
- [ ] **Step 5: Commit** `feat(server): db, memory, boss level, routes`.

---

### Task 6: Eval harness, grader, dashboard

**Files:**
- Create: `shared/src/grade.ts`, `shared/test/grade.test.ts`, `server/scripts/eval.ts`, `server/dashboard/index.html`
- Modify: `server/src/app.ts` (`GET /api/stats`, static `/dashboard`)

**Interfaces:**
- Produces: `gradePlan(item:{label:{primary:HabitId|"none"; accepted:Move[]}}, plan:Plan, valid:boolean): { valid:boolean; targetOk:boolean }` (`targetOk` = `plan.focus_habit===label.primary` AND some accepted move is `high` in emphasis or appears in an opening string; `primary:"none"` is ok when focus is `none`); `agrees(a:Plan,b:Plan): boolean` (same `focus_habit` and same set of `high` moves); `eval.ts` CLI `--set data/heldout.json --label baseline|provider|v1|v2 --notes "<Served by / History status>"`. `summary.csv` columns: `label,iso,n,valid_rate,target_rate,agree_rate,violations,p50_ms,p95_ms,mean_in_tok,mean_out_tok,cost_per_1k,notes`.
- `GET /api/stats` → `{ rows: SummaryRow[]; calls:{ total:number; byServedBy:Record<string,{n:number;p50:number;p95:number}> } }`.

- [ ] **Step 1: Failing tests:** `gradePlan marks the rules plan targetOk for its own top habit on every archetype`; `agrees is symmetric`; `a plan with illegal move is not valid`; baseline label uses `rulesPlan` and makes no network call.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement** `gradePlan`, `agrees`, `eval.ts` (baseline = local rules plan; other labels call Mubit with `store:false`, session `gr-eval-<label>-<i>`; agreement is against the saved `provider` run; cost via `costPer1k` using logged token means and published prices: Haiku 4.5 $1/$5, Sonnet 4.6 $3/$15, gpt-6-luna $0.10/$0.50 per 1M; writes `data/eval/<label>-<iso>.json` and appends `summary.csv`). The dashboard is one static HTML page fetching `/api/stats`, drawing the version table and "Served by" latency, labelled "trained overnight".
- [ ] **Step 4:** run tests, expect PASS. Run `eval.ts --label baseline` and `--label provider`; expect two rows in `summary.csv`.
- [ ] **Step 5: Commit** `feat: eval harness, grader, dashboard`.

---

### Task 7: Game wiring — stats summary, plan loader, boss integration

**Files:**
- Create: `game/src/learn/summary.ts`, `game/src/learn/session.ts`, `game/src/learn/planLoader.ts`, `game/test/summary.test.ts`, `game/test/planLoader.test.ts`
- Modify: `game/src/game/Game.ts`, `game/src/game/Boss.ts` (exact lines from `docs/notes/wiring.md`), `game/vite.config.ts` (proxy `/api` → `http://localhost:8787`), `game/package.json` (add vitest, `shared` dependency)

**Interfaces:**
- Consumes: `Plan`, `StatsSummary`, `rulesPlan`, `validatePlan`, `limitsForLevel`, `TEMPO_P2_BY_STEP`, `GAP_BY_STEP`, `applyEmphasis` from `shared`.
- Produces:
  - `summary.ts`: `summarize(stats: DuelStats, fightSeconds:number): StatsSummary` (parses `hitLog` strings into `hitsByMove`; median of `timings`; unknown attack names ignored).
  - `session.ts`: `requestPlan(a:{ nickname:string; fightId:string; fightNumber:number; stats:StatsSummary }): Promise<{ plan:Plan; source:"mubit"|"rules"|"local"; bossLevel:number; intelLines:string[]; grudge:number; latencyMs:number }>` (6 s timeout; on any failure returns a local `rulesPlan` with `source:"local"`); `newFightId(): string`.
  - `planLoader.ts`: `planToKnobs(plan:Plan, base:DifficultyValues): { knobs:DifficultyValues; strings:Move[][] }` (pure; overrides `picks` via `applyEmphasis`, `tempo[1]` via `TEMPO_P2_BY_STEP`, `gap` via `GAP_BY_STEP`; never changes `deflect*`, never lowers `tempo[0]` from 1); `applyPlan(plan:Plan, boss:Boss): void` (writes knobs into `DIFFICULTY` in place, using the same in-place assignment the base uses so `Input` keeps its array references, then pushes `strings` onto `Boss.queue`).

- [ ] **Step 1: Failing tests:** `summarize counts hitsByMove from real-format hitLog lines` (copy two real lines from a run); `summarize on an empty DuelStats gives zeros and null timings`; `planToKnobs never changes deflectEarly/deflectLate/deflectSteps (deep-equal to base)`; `tempo[0] stays 1 for every tempo_step`; `tempo[1] ≤ 1.12 and gap ≥ HARD gap for every step`; `picks weights sum to 1 after emphasis`; `requestPlan resolves to source "local" when fetch rejects, and within 6.1 s when fetch hangs` (fake timers).
- [ ] **Step 2:** `pnpm -C game test`. Expect FAIL.
- [ ] **Step 3: Implement.** In `Game.ts`, at each fight's end (victory, defeat; and on resurrection do not request) build the summary, call `requestPlan` (not awaited by the render loop), keep the result as `nextPlan`. In `startFight`, after the base's `applyDifficulty(...)` call, call `applyPlan(nextPlan, this.boss)` when one exists. Expose `window.__duel.learn = { lastPlan, source }` for tests.
- [ ] **Step 4:** tests PASS; then run the game with the server up, finish a fight, confirm `window.__duel.learn.source === "mubit"` and that the next fight's first attacks follow `opening_strings`. Also run with the server stopped: fight continues, `source === "local"`.
- [ ] **Step 5: Commit** `feat(game): stats summary, plan loader, boss wiring`.

---

### Task 8: Council screen, debrief, boss-level banner, "what Mubit saw" panel

**Files:**
- Create: `game/src/ui/Council.ts`
- Modify: `game/src/ui/Hud.ts` (hook the end screens), `game/src/ui/brush.ts` only if a helper is missing, `game/index.html` (container)
- Test: `game/test/council.test.ts` (pure formatting helpers)

**Interfaces:**
- Consumes: `requestPlan` result, `GET /api/global`, `GET /api/stats`.
- Produces: `showCouncil(r:{ intelLines:string[]; plan:Plan; bossLevel:number; grudge:number; source:string; latencyMs:number }): Promise<void>` (resolves when the player confirms the rematch prompt; shows a "the General is thinking…" state while waiting, never longer than 6 s); `formatIntel(plan:Plan, lines:string[]): string[]`; `renderMubitPanel(el:HTMLElement, s:{ calls:number; served:Record<string,number>; lastRequestId?:string; source:string }): void`; debrief `habitBars(prev:HabitScore[], now:HabitScore[]): {habit:HabitId;prev:number;now:number}[]`.

- [ ] **Step 1: Failing tests:** `formatIntel uses real numbers from the lines and trims to the word limits`; `formatIntel with no habits shows a neutral line`; `habitBars aligns two fights and treats a missing habit as 0`.
- [ ] **Step 2:** run, expect FAIL.
- [ ] **Step 3: Implement** the screen in the base's ink/brush style (no new fonts or images). Show: intel lines, `focus_habit` as the general's reason, the taunt, "Boss Level N" and Grudge, source badge (`mubit`/`rules`/`local`), latency. A small corner panel shows live call count and `source`. Load the global banner on the title ("The General has fought N duels").
- [ ] **Step 4:** run tests, PASS. Manually play a fight to the end; the Council appears on defeat and victory and never blocks input if the server is down.
- [ ] **Step 5: Commit** `feat(game): council screen, debrief, banner, mubit panel`.

---

### Task 9: Corrections and replay mode

**Files:**
- Create: `data/replay.json` (generated), `server/test/corrections.test.ts`
- Modify: `server/src/app.ts` (`POST /api/override`, `GET /api/replay`), `server/src/prompts/general_plan.ts` **is not touched**, `game/src/learn/session.ts` (`?replay=1`), `game/src/ui/Council.ts` (host key `H`)

**Interfaces:**
- Produces: `POST /api/override` `{ fightId:string; rule:string }` → appends a designer rule (max 15, case-insensitive dedupe, max 200 chars), re-sends the stored input with the new rule via `callTask` using `sessionId:"gr-fix-<uuid>"`, `store:true`, returns `{ plan:Plan }`. Invalid-plan failure codes map to default rules (e.g. `too_many_strings` → "Never exceed the string limits in limits."). `GET /api/replay` → up to 20 stored real plans (`source` labelled `"replay"`).

- [ ] **Step 1: Failing tests:** `override adds one rule and a gr-fix session call with store true`; `duplicate rule is not added twice`; `16th rule evicts the oldest`; `override on unknown fightId returns 404`; `replay returns only real stored plans, each labelled replay`.
- [ ] **Step 2:** run, expect FAIL. **Step 3:** implement. The user message gains the new `designer_rules` entries; the frozen system prompt is untouched. In the client, `?replay=1` makes `requestPlan` read `/api/replay` round-robin instead of calling the server.
- [ ] **Step 4:** tests PASS; in the Mubit console confirm a `gr-fix-*` request appears. **Step 5: Commit** `feat: corrections via designer rules and replay mode`.

---

### Task 10 (Nice): Optional hand gestures

**Files:**
- Create: `game/src/input/gestures.ts`, `game/test/gestures.test.ts`
- Modify: `game/src/main.ts` (toggle `G`), `game/package.json` (`@mediapipe/tasks-vision`)

**Interfaces:**
- Consumes: `Input.press(action, source)` / `release(action, source)`.
- Produces: pure `detectGestures(samples: Landmarks[], prev: GestureState): { events:{ action:Action; type:"press"|"release" }[]; state:GestureState }` (right-hand swipe → attack; left fist held → block; fast left flick → block press+release within 80 ms for a deflect tap; lateral swipe → dodge; fast raise → jump; open palm held → heal; each debounced ≥ 3 frames with a per-action cooldown); `startGestures(input:Input, video:HTMLVideoElement): Promise<{ stop():void }>` (Hand Landmarker, VIDEO mode, GPU delegate, `numHands: 2`, ~30 fps, mirrored preview with state label).

- [ ] **Step 1: Failing tests** with synthetic landmark sequences: `a fast right-hand rightward swipe emits one attack press`; `jitter below the threshold emits nothing`; `a held fist emits press then release on open`; `two swipes within the cooldown emit one dodge`; `empty/no-hand frames release held actions`.
- [ ] **Step 2:** run, expect FAIL. **Step 3:** implement. In gesture mode, widen `DIFFICULTY.deflectEarly` by a measured amount (record latency on the demo laptop in `docs/notes/wiring.md`; keep the amount ≤ the EASY preset's 0.3 s). Mouse/keyboard stay active and `G` switches.
- [ ] **Step 4:** tests PASS; manual check on the demo laptop: attack, block, deflect, dodge for one full fight; fallback still works. **Step 5: Commit** `feat(game): optional hand gestures`.

---

### Task 11 (Nice): Tsushima mood retheme

**Files:**
- Modify: `game/src/fx/Snow.ts` (leaves/petals with a wind vector), `game/src/render/Post.ts` and `game/src/world/Surround.ts` (golden-hour grade/sky tint)

**Interfaces:**
- Produces: a `?theme=tsushima` URL option (default on if screenshots look better than the base), leaving the original look reachable with `?theme=snow`.

- [ ] **Step 1:** screenshot the base (Playwright with a GPU-backed Chromium, or the base's `tools/shoot.mjs`). **Step 2:** change particle shape/colour/drift and the grade; keep frame rate within 10% of the Task 0 measurement (`window.__duel`/`tools/perf.mjs`). **Step 3:** screenshot both themes and compare; keep the better one as default. **Step 4: Commit** `feat(game): tsushima theme`.

---

### Task 12: Full playthrough verification, judging check, README and demo

**Files:**
- Create: `README.md`, `docs/demo-script.md`, `docs/verification.md`

- [ ] **Step 1: Verification before completion.** Run `pnpm -r test`, `pnpm -C game build`, and the base's own `node tools/bot.mjs` against the build; record real output in `docs/verification.md`.
- [ ] **Step 2: Scripted playthrough** with the server up: title → nickname → fight → defeat → Council → rematch → victory; then again with the server stopped; then `?replay=1`. Capture screenshots and the Mubit console Requests page. Record failures honestly.
- [ ] **Step 3: Seed crowd history** so Boss Level is non-trivial for the demo (labelled "seeded playtests", synthetic).
- [ ] **Step 4: Training clock.** At ~01:00 BST Sun confirm the next version started; at ~07:00 GMT run `eval.ts --label v1` / `--label v2` with the console's History status in `--notes`; update the dashboard.
- [ ] **Step 5: Judging check:** score the build against Use of Mubit, Usefulness, Technical execution, Demo using real evidence (kept count, version rows, latency, cost, playthrough); write the result and every gap into `docs/verification.md`.
- [ ] **Step 6:** rehearse the 3-minute script (spec §13) three times on the demo laptop under hall-like lighting; keep arrow-free mouse mode as the default. Commit `docs: readme, demo script, verification`.

---

## Self-Review

- **Spec coverage:** §3 base/licence → T0; §4 additions → T1–T9; §5 experience → T7–T8; §6 habits → T1; §7 Mubit task, validator, corrections, hygiene → T2–T4, T9; §8 escalation → T2 (`limitsForLevel`), T5 (`bossLevel`); §9 evaluation → T4, T6; §10 gestures → T10; §11 architecture → file structure; §12 scope tiers → T10–T11 marked Nice; stretch/cut items intentionally absent; §13 demo → T12; §15 risks → T0 (GPU/licence), T3 (json_schema), T12.
- **Deviation from spec §11:** the "shared package `packages/mubit`" is folded into `server/src/mubit/` (one fewer package). Same code, same interface.
- **Type consistency:** `Plan`, `StatsSummary`, `HabitScore`, `Limits`, `PlanInput`, `Move`, `HabitId` are defined once (T1–T3) and used unchanged in T4–T9; `validatePlan(raw, limits)` and `rulesPlan(habits, level)` signatures are identical wherever called.
- **Open items the executor must resolve with evidence, not guesses:** exact line seams (T0 notes), whether strict `json_schema` works on starter credit (T3), `node:sqlite` on this machine (T5), gesture latency (T10), training timing (T3 staff answers, T12).
