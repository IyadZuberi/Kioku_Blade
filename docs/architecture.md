# Architecture

```mermaid
flowchart TD
  subgraph Browser["Browser (static build on Vercel)"]
    CAM[Webcam] --> MP[MediaPipe hands<br/>in-browser, video never leaves]
    MP --> GL[gestureLogic<br/>landmarks to key events]
    KB[Keyboard / mouse / gamepad] --> IN[Input]
    GL --> IN
    IN --> SIM[Fixed 120 Hz fight sim<br/>Player + Boss + Game]
    SIM --> STATS[Duel stats<br/>deflects, blocks, hits, dodges...]
    MEM[learn/remembers<br/>local memory per general] --> KNOBS[bossKnobs<br/>guard, parry, answer speed,<br/>openings, tempo, gaps]
    KNOBS --> SIM
    STATS --> MEM
    SIM --> R3[Three.js render<br/>60 fps]
    PLAN[Plan + lines + dossier] --> SIM
    PLAN --> COUNCIL[Council screen<br/>intel, taunt, his notes on you]
  end

  STATS -- POST /api/fight, never blocks a frame --> API

  subgraph Server["Server (Express, SQLite)"]
    API[app.ts] --> HAB[computeHabits<br/>deterministic code,<br/>NOT an LLM]
    HAB --> BLEND[blend with player history<br/>+ playerLevel limits + dossier]
    BLEND --> P1[general_plan call]
    BLEND --> P2[general_speech call]
    P1 --> VAL[validatePlan<br/>enums only, clamped to limits]
    P2 --> CLEAN[cleanSpeech<br/>word caps, profanity filter]
    VAL --> DB[(SQLite: fights, dossier)]
    CLEAN --> DB
  end

  P1 -- compact JSON ~700 tok --> MUBIT
  P2 -- JSON ~550 tok --> MUBIT

  subgraph MUBIT["Mubit middleware (api.mubit.ai)"]
    RT[OpenAI-compatible route] --> TASKS[Task general_plan<br/>Task general_speech<br/>examples kept]
    TASKS --> AD[Adapter trains at 25 kept examples<br/>cheaper small model later]
    RT --> M1[gpt-6-luna primary]
    RT --> M2[gpt-oss-120b via Groq backup]
  end

  VAL -- fails or offline --> RULES[rulesPlan fallback<br/>same code runs in browser]
  CLEAN -- fails --> CANNED[canned lines]
  DB --> RESP[plan + lines + dossier + model + request id]
  RESP --> PLAN
  RULES --> PLAN
  CANNED --> PLAN
```

## What each model call gets and returns

| | `general_plan` | `general_speech` |
|---|---|---|
| Input | boss, streak, level, win/loss, duel counts (deflects, blocks, hits, dodges, cuts), moves that hurt, top 3 habits with power, his notes on the player, losses in a row, caps for the player's level, designer rules | boss, fight number, win/loss, level, habits with evidence, previous dossier, council intel |
| Output | `focus` habit, `strings` (opening move strings), `high` / `low` moves, `tempo`, `gap`, `intel` (20 words), `taunt` (10 words) | `dossier` (30 words), `greeting`, `parry`, `fall`, `win` |
| Game uses it for | difficulty knobs and openings (after validation), council text | subtitles in the duel, and the dossier fed into the next plan |
| Without it | rules table plan | canned lines |

Habit detection, difficulty maths, validation and all gameplay are plain code. The models choose and write; they never run a frame.
