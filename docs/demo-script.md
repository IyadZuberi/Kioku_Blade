# Demo script (3 minutes)

Run order before going on stage: server up, game open in Chrome on the demo laptop (`?quality=low` if integrated GPU), mouse mode, `?name=` set to something short, sound on. Keep `?replay=1` ready in a second tab as the offline backup.

## The 2-minute video (lead with the learning, not the scenery)

| Time | Show | Say |
|---|---|---|
| 0:00-0:12 | A duel already running: Masatora in his riposte stance, glowing blue; the player deflects and the red "!" lands | "A boss that learns you. This is Kioku." |
| 0:12-0:45 | Finish one duel (win or lose, it does not matter): the finisher, then the **council screen**: your own numbers, "You blocked 14 times...", what he will favour, "He has fought you 1 time. Next duel he parries 47% of long strings and moves +6% faster." | "After every duel the numbers go to Mubit. The model reads my habit and plans his next fight." |
| 0:45-1:15 | Rematch: he opens with the string the council named; show the parry glow and "PARRIED" | "Same general, new plan: he is faster, parries more, and opens with the counter to my habit." |
| 1:15-1:35 | The duel after that, **lost on purpose**: council screen again, level higher | "Win or lose, he gets harder. Losses never make him easier; after three in a row he holds, he does not drop." |
| 1:35-1:55 | Mubit console: Requests (real calls, request ids), Tasks (one task, kept examples), Adapters | "One task, 80 seeded examples; Mubit trains a small adapter for it and tests it against the big model." |
| 1:55-2:00 | Title: "The General remembers N duels against you" | "Blades that remember." |

## Live demo order (3 minutes)

| Time | Do | Say |
|---|---|---|
| 0:00-0:15 | Title screen with the crowd banner ("The General has fought N duels") | "Game bosses never learn you. Ours does, and its brain gets cheaper." |
| 0:15-1:30 | A judge plays one fight (mouse) | (let them play; point at deflect timing if they struggle) |
| 1:30-1:50 | Council screen appears with their numbers | Read one real line: "You blocked 14 times and deflected 2, so he comes with thrust and grab." |
| 1:50-2:20 | Rematch, short | "Same general, new plan: watch for the opening string." |
| 2:20-2:50 | `/dashboard` scoreboard + Mubit console Requests | Say exactly what the rows are. Label overnight rows "trained overnight". Say Mubit "passed" means agreement with the big model, not ground truth. |
| 2:50-3:00 | Close | "Your fights today are tomorrow's general: fast, cheap and owned." |

Honest lines to keep ready:
- "Mubit trains the small model overnight; during the demo the plan comes from the provider model (or the rules table if Mubit is off). Both are labelled on screen."
- "The labels for the held-out set come from our own habit table. The baseline row shows that table alone."
- If asked "is it just difficulty knobs?": "The model picks habit-targeted opening strings and emphasis; code maps them to the base game's tested knobs, and a validator keeps every plan fair."

Backup: `?replay=1` (stored real plans, labelled replay), recorded video, screenshots of the Mubit console History.