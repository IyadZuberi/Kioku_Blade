# How the language models are used

Two Mubit tasks, each a real model call per duel, plus code that does the maths.

| | `general_plan` | `general_speech` |
|---|---|---|
| Job | Plan the next duel against this player | Write what he says, and rewrite his private notes on this player |
| Model | `openai/gpt-oss-120b` on Groq, through Mubit (`/compat/groq/v1`), reasoning effort low | `gpt-6-luna` on Mubit's starter credit (`/openai/v1`) |
| Input | The duel's numbers, this player's habits blended with their history, the notes (dossier), crowd stats, limits for this player's level | Which general, how the duel went, the habits, the previous dossier |
| Output | Strict JSON, **enums only**: focus habit, opening strings, emphasis per move, tempo and gap steps; plus one line of intel and a taunt | Strict JSON, free text with word caps: dossier (30 words), greeting (18), parry shout (6), last words (12), gloat (12) |
| What the game does with it | Maps enums onto the boss's tested difficulty knobs; a validator clamps anything out of bounds | Shows the lines (greeting before the duel, a shout when he parries, last words, a gloat), keeps the dossier and sends it back into the next plan |
| If it fails | Rules table, same code runs locally; backup model when the main provider is out of tokens (not stored) | Canned lines; dossier built from habit evidence |
| Frozen? | Yes: 80 seeded examples; `server/test/frozen.test.ts` pins the hash | Same rule once examples are kept |

## The third task: the general designs his own arsenal (`general_forge`)

After every duel the game sends a small numeric digest (his level, how the player fights, where they stand, which of his moves land and which never do, his move list) and the model **designs his next arsenal**: up to three new combos from his moves (each named, inspired by the hardest fights: Isshin, the Owl, Malenia, Artorias, Lord Shimura...), a tactic (keep away from a close fighter, press in on a kiter), the condition he can be hurt under, and one new move to teach him. The server and the game both check the answer (only moves he can play, bounded length, no spam, no three perils in a row); a bad answer is dropped and the game's own deterministic arsenal is used.

What the game does with it, with or without the model:

| | Deterministic brain (`learn/brain.ts`, `learn/arsenal.ts`) | Model design (`general_forge`) |
|---|---|---|
| Level | Grows every duel, no ceiling | Reads it |
| Style | Deflect / guard / dodge / aggression shares | Reads it, aims combos at it |
| Moves | Learns windSlash, lunge, backflip, waterfowl, shockwave, vanish, stance at set levels | Can teach one more per duel |
| Combos | 12 named combos from famous bosses, plus ones generated from what lands on this player | Invents new named ones |
| Range | Times where the player stands and which distance hurt them more; tries the other one first | Chooses kite or crowd |
| Condition | He is only hurt after a deflect / a dodge / while open / once his posture is broken, aimed at their favourite style | Can change it |
| Skills | Feints, uneven swing speed, delayed strikes, answering a dodge, a remembered form below 30 health | |

## Is it a classifier?

The **habit classification** (blocks too much, dodges too much, ...) is plain code: thresholds in `shared/src/habits.ts`. It is not a model call. The model is then used for what code cannot do well: choosing a combination of counters from several habits and the player's history, writing the intel and taunt in the general's voice, and, in the second task, summarising the player across duels into a short note the next call reads. The plan task is constrained to enums so a small model can copy it, which is also what lets Mubit train a small adapter for it.

## Learning, in three layers

1. **Memory in the game** (offline, deterministic): every duel counted; his guard, parry, answer speed, openings, tempo and gaps climb toward HARD after every duel, won or lost.
2. **The plan** (`general_plan`): what he favours and how he opens, from your habits and history.
3. **The dossier** (`general_speech`): the model rewrites its own notes on you each duel; the next plan and the next lines are conditioned on them. This is how the general carries a picture of you from fight to fight.

## Size of the calls

Plan: about 1,300-1,700 prompt tokens (instructions about 650, response schema about 410, the duel's JSON about 300) and about 350-650 completion tokens, of which the reply itself is about 250 and the rest is hidden reasoning. Speech: about 550 prompt, 250-500 completion. Mubit's docs name an "examples too long to train on" outcome but give no number; the console's kept-example count is the check.

## What Mubit adds over calling a model directly

Honest version. The game's **learning** (he gets harder, he remembers you) comes from our own code plus the dossier the model rewrites each duel. That works with any model. Mubit adds a different thing:

1. **It records every call** (request id, tokens, latency) and groups calls with the same model + instructions + output format into a **task**. `general_plan` is one task, `general_speech` another.
2. **It keeps examples** from those calls and, once a task has enough (25), **trains a small adapter** for it, then tests that adapter against our provider model's answers. A passing adapter is a cheaper, faster model made for exactly this job. Today's plan call costs about 700 input tokens on a large model; the adapter is the way to stop paying that.
3. **Try models** compares the provider's answer with the adapter's side by side.

So Mubit does not make the boss smarter in the moment; it turns our live traffic into a cheaper specialist model.

**Why the console may show nothing learned.** Per Mubit's docs, training has to be switched on for the workspace: until it is, the console shows no Adapters page and training does not start. Calls made through `compat/groq` also need time to appear, and each task needs 25 kept examples. Check, in order: Requests (are our calls there), Tasks (is there a `general_plan` task and how many kept), Adapters (does the page exist). If there is no Adapters page, the fix is to ask Mubit to turn training on (their "Get help" page). Admin and organization endpoints are refused through the API, so this cannot be checked from code.
