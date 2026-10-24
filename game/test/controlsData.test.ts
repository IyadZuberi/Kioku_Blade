import { describe, expect, it } from "vitest";
import { CONTROLS, ACTIONS_LISTED } from "../src/ui/controlsData";

describe("controls list", () => {
  it("lists every action for keyboard + mouse and for the controller", () => {
    for (const tab of ["keyboard", "pad"] as const) {
      const acts = new Set(CONTROLS[tab].flatMap((r) => r.actions));
      for (const a of ACTIONS_LISTED) expect(acts, `${tab} is missing ${a}`).toContain(a);
    }
  });
  it("hands cover move, block, attack, dodge and jump (the gourd and lock-on stay on keys and pad)", () => {
    const acts = new Set(CONTROLS.hands.flatMap((r) => r.actions));
    for (const a of ["move", "block", "attack", "dodge", "jump"] as const) expect(acts).toContain(a);
  });
  it("every row has a name and at least one way to do it", () => {
    for (const tab of ["keyboard", "pad", "hands"] as const)
      for (const r of CONTROLS[tab]) {
        expect(r.name.length).toBeGreaterThan(0);
        expect(r.how.length).toBeGreaterThan(0);
      }
  });
  it("the keyboard rows match the real bindings in Input.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/core/Input.ts", import.meta.url), "utf8");
    for (const code of ["KeyJ", "KeyK", "KeyL", "ShiftLeft", "Space", "KeyQ", "KeyR"]) expect(src).toContain(code);
    const keys = CONTROLS.keyboard.flatMap((r) => r.how).join(" ");
    for (const k of ["J", "K", "Shift", "Space", "Q", "R", "WASD"]) expect(keys).toContain(k);
  });
});