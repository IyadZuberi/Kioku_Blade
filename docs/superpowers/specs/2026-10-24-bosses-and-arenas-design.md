# Kioku: three bosses, three arenas (design for approval)

Status: DRAFT for Iyad's approval. Nothing here is built yet. Tags: **[VERIFIED]** read in a source this session. **[UNVERIFIED]** must be checked before use. **[DECISION]** my call, change freely.

## 1. What changes

- The game is renamed **Kioku (記憶, "memory")**, tagline "Blades that remember" [DECISION; the user has not confirmed the name].
- Three bosses, three arenas. A player must beat boss 1 **3 times in a row** to reach boss 2, and boss 2 **6 times in a row** to reach boss 3. Losing a fight resets that boss's streak to 0; the player stays on the same boss.
- Every boss gets harder with the crowd (Boss Level, as today) and with the player's own record, and has its own move set. All bosses are planned by the same Mubit task `general_plan` (the boss is a field in the user message, so training examples are shared, not split).

## 2. Progression

| Rule | Detail |
|---|---|
| Streak | Wins in a row against the current boss. A defeat sets it to 0. Resurrecting inside a fight does not break it. |
| Gates | Boss 1 -> 2 at streak 3. Boss 2 -> 3 at streak 6. Boss 3 has no gate (a win shows the ending and a "Rematch" option). |
| Persistence | Stored on the server per player (new columns) and mirrored in localStorage. |
| Demo and host | `?boss=1|2|3` jumps to a boss. A judge cannot play 3 + 6 fights in a 3-minute slot, so this is required, and the on-screen streak counter shows the real gate. |
| Retention note | Resetting a streak on a loss is harsh. Counterweight: the Council screen always tells the player exactly what to fix, and a defeat still teaches the General (Grudge logic stays). |

## 3. The bosses (recombined from documented mechanics, not copied)

Move patterns come from public boss guides: Sekiro's Genichiro (thrust to mikiri, palm-strike grab, long flurry, arrow shot when you heal, unblockable slash, lightning phase) [VERIFIED: PC Gamer, Twinfinite, GameWith guides]; Ghost of Tsushima's Lord Shimura duel (red attacks are unblockable and must be dodged, blue attacks can be parried) [VERIFIED: Fextralife and Gamer Guides]; Elden Ring's Malenia and Margit (leap then four dashing slashes, long delayed slams designed to bait panic rolls) [VERIFIED as community descriptions, not official]. Mechanics are not copyrightable; names, models, art and audio are all our own or CC0/Mixamo.

### Boss 1: Onikage Masatora (exists), "the Rooftop General"
Existing 8 attacks: `leap, combo, comboDelay, overhead, thrust, sweep, grab, flurry`. Arena 1: snowy castle rooftop (existing), golden-hour theme.

### Boss 2: Kaze-no-Tomoe, "the Reed Duelist" [DECISION name]
Fast, fluid, lots of delay and feints. Recombined from: Malenia (waterfowl), Genichiro (arrow when you heal; wind/lightning slash), Shimura (colour-coded red/blue).

| Move | How it works | New work |
|---|---|---|
| `waterfowl` | leap, then four dashing slashes, the last one delayed | recombination: `leap` + `flurry` + `comboDelay` timing (no new clip) |
| `windSlash` | a crescent travels along the ground; jump or deflect | one new effect + reuse `overhead` clip |
| `reedFeint` | long wind-up that is cancelled into a different blow | recombination (scripted cancel), no new clip |
| `bolo` | thrown shot when the player drinks the gourd or backs off | **one new clip** (throw) [UNVERIFIED which Mixamo clip] |
| Red/blue telegraph | red glyph = unblockable (dodge), blue = deflectable | UI only, reuses the base's danger glyph |
| Phase 2 | faster tempo ceiling, more feints, windSlash in strings | knob changes |

Look: slimmer build, long layered coat and wide straw hat or half-mask in marsh green and ash white (built from procedural parts like the base's `generalBuild.ts`) [DECISION]. Body: a Mixamo character [UNVERIFIED which; candidates must be checked on mixamo.com].

### Boss 3: The Hollow Shogun, "the Final Duel"
Slow, enormous, punishing mistakes. Recombined from: Margit (delayed charged slam), Godrick/Radahn-style shockwave, Isshin (third life, all earlier tricks), Shimura (stance cycle).

| Move | How it works | New work |
|---|---|---|
| `delayedSlam` | very long hold then a heavy overhead; baits panic | recombination of `overhead` with a long hold |
| `shockwave` | jump slam sends a ring along the ground; jump it | one new effect + reuse `leap` clip |
| `stanceCycle` | stone / water / wind / moon stance changes his string and which answer works (guard, dodge, jump, deflect) | recombination + stance banner UI |
| Echo | in phase 3 he replays moves from bosses 1 and 2 | uses existing moves |
| Three lives | like Isshin: three deathblows | the base has 2 markers; needs a third marker (small change in `Boss.ts`/`Hud.ts`) |

Look: huge, hollow-eyed armour, cracked lacquer, cold blue fire at the seams, no face [DECISION].

Budget: at most 3 new animation clips in total (throw, plus up to two) and 3 new effects. Every new move must have a telegraph of at least 0.35 s and a stated answer (deflect, dodge, jump or guard); this is enforced by the same validator and a per-move table.

## 4. Arenas: combine what exists, do not start from scratch

Rule: only MIT, CC0 or CC-BY (credited) material, licence checked per asset. No assets ripped from commercial games. REA and the replicate skill are used only on permitted targets (open-source or CC0 demos and our own build), to study how a technique is done.

| Arena | Mood | Built from |
|---|---|---|
| 1 Rooftop | snowy castle, golden hour (exists) | the base arena |
| 2 Meadow | windswept grass field, torii gate, blossom wind (Tsushima mood) | MIT `Steve245270533/three-stylized` (instanced grass + wind, 65 stars) [VERIFIED MIT in repo metadata; check its assets], MIT `leoawen/fluffytree-threejs` (anime trees), a torii built from simple boxes or a CC0 model [no CC0 torii glTF found; paid and unclear-licence ones excluded], Poly Haven CC0 HDRI |
| 3 Ruined shrine | moonlit stone ruin, fog, braziers (Elden Ring mood) | CC0 "Gothic-Like Structures" glTF pack by loafbrr on itch.io (CC0 stated on the page) [VERIFIED on the search result; re-check at download], Poly Haven CC0 stone textures, base fog and our own brazier particles |

Assembly: Blender (tools available in this session) to combine and bake, then glTF-Transform pack to under about 8 MB per arena, loaded only when that boss starts. Reuse the base's sky, mist, bloom and golden-hour grade so the three arenas feel like one game.

## 5. LLM and Mubit

- Still one frozen task `general_plan`. New input fields: `boss` (`masatora | kaze | shogun`), the boss's move list in `unlocked`, and per-boss limits. New output: the move enum grows (`waterfowl, windSlash, reedFeint, bolo, delayedSlam, shockwave`); the validator keeps every plan inside that boss's move set and tempo ceiling.
- **The prompt and schema are not frozen yet (the seed has not been sent), so this is the moment to change them.** After the seed is sent, any change starts a new task. So: finish the boss design, then change the schema once, then seed.
- Seed and held-out generators gain a `boss` dimension (the habit archetypes are the same). Cost: about the same number of Mubit calls.
- Mubit credits are unchanged: nothing here spends any; live steps stay behind `MUBIT_LIVE=1` and your OK.

## 6. Build phases (each ends testable)

1. **Data-driven bosses:** boss registry (name, move set, tuning, arena, look), streak and progression with persistence, streak UI, `?boss=`. No new art yet. Acceptance: streak gates work in tests and in the browser.
2. **Boss 2 + arena 2.** Acceptance: all moves fire with correct telegraphs, a scripted playthrough, fps measured.
3. **Boss 3 + arena 3.** Same acceptance, plus the third life.
4. **LLM schema + seed generators for three bosses**, mocked tests. Live Mubit after your OK.
5. **Full QA, smoothness, loading per arena, README/demo update.**

## 7. Roast and risks

- **Scope.** This is 3 to 4 times the original build. With a code freeze at 10:00 GMT Sunday, I recommend boss 2 and arena 2 first; boss 3 only if time remains. If boss 3 is cut, boss 2's gate stays and the final fight becomes a harder boss-2 rematch.
- **Animation work is the long pole.** Every new attack needs a clip plus hand-tuned hit windows. Mixamo needs your Adobe login to download; I cannot do that. I will give you an exact list of clips.
- **Streak gates vs a 3-minute demo.** Judges will never earn them; `?boss=` is not optional.
- **Fairness untested.** New moves have no human playtests. The validator and the bot only cover bounds.
- **Event rule.** The base game predates the event. Ask the organisers whether a forked open-source base is allowed, and disclose it.
- **Licences.** Each external asset must be checked at download time; anything unclear is dropped.

## 8. Sources
- Sekiro Genichiro guides: https://www.pcgamer.com/uk/how-to-beat-genichiro-in-sekiro-shadows-die-twice , https://twinfinite.net/guides/sekiro-genichiro-ashina-how-beat/ , https://gamewith.net/sekiro/article/show/8582
- Ghost of Tsushima, Lord Shimura: https://ghostoftsushima.wiki.fextralife.com/Lord+Shimura , https://www.gamerguides.com/ghost-of-tsushima-directors-cut/guide/walkthrough/act-3-kill-the-khan/the-tale-of-lord-shimura
- Elden Ring discussion of delayed attacks: https://steamcommunity.com/app/1245620/discussions/0/3177859358958778356
- three-stylized: https://github.com/Steve245270533/three-stylized ; fluffytree: https://github.com/leoawen/fluffytree-threejs ; Gothic-Like Structures: https://loafbrr.itch.io/gothic-like-structures
