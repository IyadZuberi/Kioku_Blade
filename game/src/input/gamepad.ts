/** Polls the first connected standard controller each frame and feeds Input (mapping lives in gamepadLogic.ts). */
import type { Input } from "../core/Input";
import { PadMapper } from "./gamepadLogic";

export function startGamepad(input: Input): () => void {
  const mapper = new PadMapper();
  let raf = 0;
  const tick = (): void => {
    raf = requestAnimationFrame(tick);
    const pad = (navigator.getGamepads?.() ?? []).find((p) => p && p.connected) ?? null;
    const snap = pad ? { axes: pad.axes, buttons: pad.buttons.map((b) => b.pressed) } : null;
    const { axis, events } = mapper.update(snap);
    input.setAnalog("pad", axis.x, axis.y);
    for (const e of events) {
      if (e.type === "press") input.press(e.action, "pad");
      else input.release(e.action, "pad");
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}