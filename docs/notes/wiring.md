# Wiring notes (Task 0) — read from game/src, 24 Oct 2026

Base: StarKnightt/shinobi-duel (MIT code). Builds clean: `pnpm -C game build` OK (vite 8.3.5, TS 7.0.2). pnpm 12.15.0, Node v24.21.0.

## Seams (file:line in game/src)
- **Fight start** (two entries, both: `applyDifficulty(this.difficulty)` then `resetActors()`): `game/Game.ts:431 beginIntro()` (title/defeat -> fight, boss opens with `leap`), `game/Game.ts:452 startFight()` (tests). `resetActors()` (329) calls `boss.reset()` which **overwrites the queue** (`Boss.ts:293`: `["leap","combo","thrust","comboDelay","overhead","sweep"]`). => a plan must be applied AFTER `resetActors()` in both functions: knobs into DIFFICULTY, strings into the boss queue.
- **Boss.queue** is `private queue: string[]` (`Boss.ts:257`), consumed FIFO by `choose()` (`Boss.ts:378`, `queue.shift()`); a queued `leap` within 4.5 m becomes `combo`; a non-leap/thrust beyond 4.4 m becomes `thrust`/`leap`. Need a public setter (`setQueue(moves)`). `beginIntro` calls `boss.startAttack("leap")` itself, so queue should not start with a duplicate leap.
- **Attack names** (`Boss.ts:74 ATTACKS`): combo, comboDelay, overhead, thrust, leap, sweep, grab, flurry. = spec Move list. CONFIRMED. `flurry` and `grab` are phase-2 style in the base picks; fine to queue.
- **Pick weights**: `weighted(DIFFICULTY.picks.p1|p2, r)` at `Boss.ts:392-394` (mid range only). Keys p1: combo, comboDelay, overhead, thrust, sweep, grab, idle. p2 adds flurry.
- **Phase-1 tempo must stay 1** (`difficulty.ts` comment). Phase-2 tempo max in HARD preset = 1.12.
- **Fight end**: defeat -> `Game.trueDeath()` `Game.ts:1175` (`go("defeat")`, `stats.defeats++`, `hud.showEnd("defeat")`); victory -> `Game.ts:1341-1349` (`go("victory")`, `stats.victory = true`, `hud.showEnd("victory")`). Resurrection: `Game.resurrect()` `Game.ts:1157` (not a fight end).
- **DuelStats is CUMULATIVE** for the Game instance (`freshStats()` Game.ts:264, created once). Per-fight numbers = delta from a snapshot taken at fight start (`fightStartT`, `fightStartDeaths` already exist at 438-439). `hitLog` also accumulates: slice from the start length. Need `fightStartStats` snapshot.
- **hitLog line format** (Game.ts:1001): `` `${p.state}@${p.stateT.toFixed(2)} ${boss.attack?.name ?? "?"} press-${pt===undefined?"none":(gameTime-pt).toFixed(3)} win=${deflectWindow.toFixed(3)}` ``. Attack name is the 2nd whitespace token.
- **Input**: `core/Input.ts` actions `attack|block|dodge|jump|lock|heal`; private-ish `press(a, src)` / `release(a, src)` (check visibility in Task 10). Mouse: 0 attack, 1 lock, 2 block. Keys: J attack, K/L block, Shift dodge, Space jump, Q/Tab lock, R heal.
- **End-screen UI**: `ui/Hud.ts` `showEnd(kind)` (447) uses brushText (canvas ink lettering) images; `hideEnd()` (466). Council overlay can be a sibling element in `#hud` (index.html) using `brushText` from `ui/brush.ts`.
- **main.ts**: `window.__duel` test hooks (line 144+): game, rules, setDifficulty, scene(name), startFight, toTitle.
- No `fetch`/network use except `wavedash.ts` (platform shim, harmless). localStorage used only for difficulty (`shinobi-duel.difficulty`).

## Spec contradictions / notes
- Spec says Input uses `press(action, source)`; confirm it is public in Task 10.
- Spec assumed `DuelStats` per fight; it is cumulative -> summary.ts takes (current, snapshot).
- LICENSE file mentions dust2/Soldier.glb (mismatch with README); see NOTICE.md.
