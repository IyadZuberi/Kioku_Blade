# Verification (24 Oct 2026)

Everything below was run in this session; nothing is inferred. "NOT verified" lists what could not be checked.

## Automated

| Check | Result |
|---|---|
| `pnpm -r test` | shared 42/42, game 45/45, server 74/74 pass |
| `pnpm -C game typecheck`, `pnpm -C server typecheck`, `pnpm -C shared typecheck` | clean |
| `pnpm -C game build` | builds (vite 8, TS 7) |

## In a real browser (Playwright Chromium, Intel Iris Xe, 1038x791 at DPR 2.5)

- Base game at its own settings: about 14 fps on this laptop's integrated GPU. With `?quality=low` (pixel ratio 1, AO off, MSAA off) about 20-27 fps in fights. Auto-selected for Intel integrated GPUs. Peak measured 56 fps in a calm scene; treat 20-30 fps as the honest number here.
- Full loop with the server up, Mubit off: a fight ends, `POST /api/fight-end` returns a plan (`source: "rules"`), the Council screen shows the player's real numbers, the next fight loads the plan (opening queue `[thrust, grab]`, pick weights sum to 1, `deflectEarly` unchanged).
- Three consecutive fights with the base's test bot (`autoPlay`): all won in 23-26 s, 0 console errors; `learn.state` reached `ready` each time. (A frame-perfect bot is not a fairness test of the plan; see below.)
- `?replay=1`: stored real plans are served round-robin and labelled "replay".
- MediaPipe hand model and wasm load in about 1.4 s and the detection loop runs with a fake camera stream; 0 errors.
- Screenshots: `docs/notes/task0-title.png`, `council-title.png`, `council-defeat.png`, `theme-tsushima.png`, `dashboard.png`.

## NOT verified

- **Mubit live path**: no live call has been made (credits). Unverified: strict `json_schema` on the starter credit, `metadata.session_id` handling, real latency and token counts, kept-example counting, training, version results, "Served by". The mocked client tests prove our code, not Mubit's behaviour.
- **Gestures with a real hand and webcam.** Only the pure logic (synthetic landmarks) and model loading were tested.
- **The base's own tools** (`tools/bot.mjs`, `fairness.mjs`): they need Playwright's `chromium-1234` browser, which is not installed here. Not run.
- **Fairness of plans against humans.** The validator keeps plans inside the base's HARD-preset bounds, but no human or varied-skill bot has played the generated plans. The ceiling is the base's HARD preset, not an independently certified one.
- **Real Chrome window on the demo laptop**, hall lighting, hall Wi-Fi.
- **Asset licence**: the base repo's LICENSE file lists assets that do not match its README (see `NOTICE.md`).
- **Public hosting** (judges' URL): not set up; local server + hotspot only.

## Known simplifications

- Habit labels in the held-out set come from our own habit table, so the rules baseline scores 100% by construction. The Mubit rows are only meaningful as agreement with the provider model and as latency/cost numbers.
- The `H` host override uses `window.prompt`.
- Gesture mode covers combat only; movement and the gourd stay on the keyboard.
## Update 24 Oct (second pass)
- QA via in-page auto-player on the production build: easy/medium/hard each go fight>deathblow>finisher>victory (26 s / 26 s / 38 s), end screen 'victory' shown, 0 errors. Defeat path: death prompt (resurrect) > rise at 50% hp > second death > defeat screen > plan ready > Council shown > back to title cleans both. 0 errors.
- Loading: dev build ~10-13 s to ready (unbundled), production build ~5 s to ready on this laptop; the page was blank until then. Added a static loading screen (docs/notes/boot-screen.png).
- Gestures: swipe threshold lowered 6 -> 3.5 hand-lengths/s, tracks survive dropped frames, ?gdebug=1 shows live speed. NOT yet re-tested with a real hand.

## Arena rebuild (24 Oct)
- Replaced the base game's rooftop (Blender GLB, ~520k triangles, backlit by a low sun) with three code-built arenas of our own design. Triangles per frame 605k -> 105k, draw calls 206 -> 123. Real Chrome on this Iris Xe, vsync off: idle-scene 63 fps (p95 32 ms, judder) -> ~128 fps (p50 7.6 ms, p95 9.5 ms). Screenshots: docs/notes/arena1.png, arena2b.png, arena3b.png.
