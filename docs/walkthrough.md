# Kioku: Blades That Remember — walkthrough

## The story

Twelve winters ago three generals of the **Order of the Remembering Blade** burned the mountain village of
Kiri. The Order's creed: a warrior is a pattern, and a pattern can be learned. They study every opponent and
never forget one. **Kaede**, the only survivor, takes up her father's sword and hunts them through three gates.
Every time she falls, they remember a little more of how she fights. That memory is real: after each duel the
war council (the LLM task `general_plan`, served through Mubit) reads her numbers and plans the general's next
fight against her habits.

## Flow of a new game

1. **Loading screen** (the only place with Japanese: 記憶).
2. **Title**: KIOKU, Blades That Remember; pick Easy / Medium / Hard; any key.
3. **Prologue** (first time only): five narrated lines over ink. Enter = next, Esc = skip.
4. **Chapter card**: Chapter I, Masatora, The Garden Duelist, the place.
5. **Words before the duel**: over Kaede's shoulder, the general speaks; she answers (voiced). On a rematch he
   says one line: the war council's taunt when it has one.
6. **The duel**. He opens with his signature moves.
7. **Finisher** (break his posture twice): each general dies his own way, the finisher's name in large letters,
   his last words and Kaede's answer while he falls, then **Victory** and the war council's read of the fight.
8. After the win that opens the next chapter (3 in a row on Masatora, 6 on Kazemaru): a **torii gate rises**, its
   light fills, she walks through, the screen whitens, the next chapter card, the next arena.
9. **Defeat**: his gloating line; the general remembers.

## The three generals

| | Masatora | Kazemaru | Kurogane |
|---|---|---|---|
| Epithet | The Garden Duelist | The Spear of the Wind | The Hollow Shogun |
| Arena | Shrine courtyard, autumn maples | Coastal pampas at golden hour | Ruined castle in morning mist |
| Weapon | Katana | Yari (spear, longest reach) | Odachi (great sword) |
| Look | Black lacquer, horned kabuto | Indigo-teal armour, straw kasa | Crimson lacquer, gold crescent crest, black sashimono banner |
| Style | Measured: feints (delayed third cut), thrusts | Swift and watchful: parries strings, answers fast, rarely open | Armoured and relentless: posture holds, crushes a held guard |
| Signature | comboDelay, thrust | **spin** (whirling cut), windSlash, waterfowl | **kick** (guard-breaking stamp), shockwave slam, grab |
| Difficulty | The preset | Leans 35% toward Hard | Leans 60% toward Hard, more knobs |
| Finisher | *Through the Heart* (plunge) | *Wind's End* (turning cut, he falls back) | *Fall of the Keep* (leaping cleave, he staggers and topples) |

**Reading him:** a red **!** = perilous (thrust: deflect or sidestep; sweep: jump; grab: dodge). A cold blue glow
along his steel = his **parry stance**: the more cuts you chain into his guard, the brighter it gets and the more
likely he turns the next one aside. When he does, **PARRIED** flashes over him and he answers with a string:
stop swinging and guard.

## The learning (Mubit)

- One frozen task, `general_plan` (server/src/prompts/general_plan.ts). Input: the fight's numbers, habits,
  memory, the boss and his moves. Output: enum-only plan (focus habit, opening strings, emphasis per move,
  tempo/gap steps, intel line, taunt). Code maps it onto the boss; deflect windows are never tightened.
- Without a key or with `MUBIT_LIVE` unset, the server answers with the same rules plan locally (marked
  "planned locally (offline)" on the council screen).
- Mubit records every stored call; at 25 kept examples it trains an adapter for the task and tests it against
  the provider model. The 80-fight seed (data/seed.json, all three bosses) is what gets it there.

### Turning it on

1. Mubit console → API keys → create a key (starts with `mbt_`). Never paste it in chat or commit it.
2. Create `the-general-remembers/.env` (gitignored) from `.env.example`:
   `MUBIT_API_KEY=mbt_...`, `MUBIT_BASE_URL=https://api.mubit.ai/openai/v1`, `MUBIT_MODEL=gpt-6-luna`.
3. One smoke call (1 credit): `cd server && MUBIT_LIVE=1 pnpm exec tsx scripts/smoke.ts --yes-live`.
4. Seed (80 calls): `MUBIT_LIVE=1 pnpm exec tsx scripts/send_seed.ts --yes-live`. From here the prompt file is frozen.
5. Live play: `MUBIT_LIVE=1 pnpm -C server dev` and `pnpm -C game dev`.

## Controls

Keyboard + mouse, gamepad, or hands (camera). Press **F1** in game for the full list.

## Credits for this round

Voices: Piper TTS with public-domain / CC0 voices (see NOTICE.md). Skies, textures and rocks: Poly Haven (CC0).
