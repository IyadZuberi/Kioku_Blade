# Demo script (3 minutes)

Run order before going on stage: server up, game open in Chrome on the demo laptop (`?quality=low` if integrated GPU), mouse mode, `?name=` set to something short, sound on. Keep `?replay=1` ready in a second tab as the offline backup.

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