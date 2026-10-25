# The story: why a samurai duel needs a language model, and what Mubit is for

## The problem

Game bosses do not learn you. A scripted boss is beaten once by pattern, then never again. A model that watches how *you* fight can pick what to throw at *you*. But a large model on every fight costs money and adds delay, and you cannot ship a game that waits on a chatbot. So the question the project answers is: **how do you get a model's judgement into a game cheaply, safely and fast?**

## The answer in three layers

1. **Code does everything that must be instant and fair.** Frames, hit windows, deflect timing, the difficulty maths and the habit detector (blocks too much, dodges too much, ...) are plain code. Your deflect windows are never tightened.
2. **A model makes the one judgement code is bad at.** After a duel it gets a compact report (about 700 tokens: the duel's counts, your top habits, the general's notes on you, the difficulty caps) and returns a small structured plan: which counters to favour, how to open, tempo and gap, plus an intel line and a taunt. It chooses from enums only. A validator clamps whatever comes back, and if the call fails the same rules code runs locally. The model can make the fight more interesting; it can never make it unfair or break it.
3. **A second model call gives him a voice and a memory.** It writes his greeting, his parry shout, his last words and his gloat, and rewrites a short private dossier on you. The dossier goes back into the next plan, so the general carries a picture of you from fight to fight.

Everything also learns without a model: every duel pulls his parry rate, answer speed, openings and tempo toward HARD, so he is harder after every fight, won or lost.

## Where Mubit fits

Mubit sits between the game's server and the model provider (the OpenAI-compatible route). It:

- **records every call** (request id, tokens, latency) so the project can show real evidence;
- **groups calls into tasks** (same model, instructions and output format): `general_plan` and `general_speech`;
- **keeps examples** from those calls and, at 25 kept examples, **trains a small adapter** for the task and tests it against the provider model's answers;
- lets you **compare the adapter with the big model** (Try models).

That is the "own your intelligence layer" idea: the game's live traffic becomes the training data for a small model that does this one job. The plan task was made small on purpose (enum-only output, compact input, no free numbers) because that is exactly what a small adapter can copy. Mubit does not make the boss smarter in the moment; it is how the project stops renting a large model for a job a small one can do.

**Status, honestly.** The calls go through Mubit and return valid plans with request ids (80 of 80 seeded). Whether Mubit has kept them and started training has to be read in the console (Requests, Tasks, Adapters); per Mubit's docs, training must be switched on for the workspace before an Adapters page exists.

## Architecture

See [`architecture.md`](architecture.md) for the flowchart and [`llm.md`](llm.md) for each call's inputs and outputs.

## Judging criteria, scored honestly

The brief's tracks and criteria (from the design spec): **Use of Mubit, Usefulness, Technical execution, Demo.**

| Criterion | What we have | What is missing | Honest score |
|---|---|---|---|
| Use of Mubit | Two real tasks, live calls with request ids, 80 stored seed examples, compact enum-only task designed for adapter training, backup-model path, call log | No adapter shown yet; console state unverified; held-out comparison against the provider not run | 3-4 (5 only with a passing adapter on screen) |
| Usefulness | A game director that adapts to each player; a pattern any studio could use (cheap specialist model for an AI director) | Single game, no real players yet | 3 |
| Technical execution | Fixed-step sim, 58 fps fights, per-boss moves, validator-clamped model output, 250+ tests, frozen-task hash test, fallbacks everywhere | Server is not hosted: on a static Vercel deploy the boss learns locally but the Mubit-planned fights need the server running | 4 |
| Demo | Three arenas, three fighters with finishers, story, voices and music, two-minute script | A recorded video with the Mubit console in frame | 4 |

## Gaps and what to add next

1. **Host the server** (a small Node host) so the deployed game shows "planned by mubit" for judges. Biggest gap.
2. **Show Mubit learning**: console screenshots of Requests, the Tasks page with the kept count, and an Adapter (or the clear "training is off for this workspace" answer from Mubit). Record it in the demo video.
3. **Run the held-out evaluation** on the provider (60 calls, not stored) for a real comparison row once rate limits allow.
4. Real-player evidence: have ten people play and show the dossier changing.
5. Gestures and voices tested on more machines (browser voices differ).
6. Trim: unused exports and one-off tools (see the ponytail audit in the project history).
