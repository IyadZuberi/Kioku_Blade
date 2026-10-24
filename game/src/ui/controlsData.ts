/** What the player can press, for the Controls window. Kept as data so a test can check it against the real bindings. */
export type Listed = "move" | "attack" | "block" | "dodge" | "jump" | "heal" | "lock";
export const ACTIONS_LISTED: Listed[] = ["move", "attack", "block", "dodge", "jump", "heal", "lock"];

export interface ControlRow {
  name: string;
  /** Each alternative way to do it (key caps, buttons, gestures). */
  how: string[];
  /** Plain-words tip shown under the name. */
  tip: string;
  actions: Listed[];
}

export const CONTROLS: Record<"keyboard" | "pad" | "hands", ControlRow[]> = {
  keyboard: [
    { name: "Move", how: ["WASD", "Arrow keys"], tip: "Relative to the camera. You circle him when locked on.", actions: ["move"] },
    { name: "Strike", how: ["Left mouse", "J"], tip: "Hold for a charged cut that drives through his guard.", actions: ["attack"] },
    { name: "Guard / deflect", how: ["Right mouse", "K", "L"], tip: "Hold to block. Tap just before a blow lands to deflect it and break his posture.", actions: ["block"] },
    { name: "Step", how: ["Shift"], tip: "A quick sidestep with a moment of safety. Hold to run. Step into a thrust to counter it.", actions: ["dodge"] },
    { name: "Jump", how: ["Space"], tip: "Clears sweeps and rings. Jump again at him to kick off his head.", actions: ["jump"] },
    { name: "Gourd", how: ["R"], tip: "Heal. He notices, so pick your moment.", actions: ["heal"] },
    { name: "Lock on", how: ["Q", "Tab", "Middle mouse"], tip: "Frames both of you. Press again to look freely.", actions: ["lock"] },
    { name: "Chapters", how: ["[", "]"], tip: "On the title: pick an unlocked general. Click the chips too.", actions: [] },
    { name: "Difficulty", how: ["A", "D", "1", "2", "3"], tip: "On the title: easy, medium or hard.", actions: [] },
    { name: "Hands and menus", how: ["G", "F1", "M"], tip: "G turns webcam hand control on or off, F1 opens this window, M mutes.", actions: [] },
  ],
  pad: [
    { name: "Move", how: ["Left stick"], tip: "Push up to walk toward him.", actions: ["move"] },
    { name: "Strike", how: ["X / Square", "RB", "RT"], tip: "Hold for a charged cut.", actions: ["attack"] },
    { name: "Guard / deflect", how: ["LB", "LT"], tip: "Hold to block. Tap just before a blow lands to deflect.", actions: ["block"] },
    { name: "Step", how: ["B / Circle"], tip: "A quick sidestep. Hold the stick and press to step that way.", actions: ["dodge"] },
    { name: "Jump", how: ["A / Cross"], tip: "Clears sweeps and rings.", actions: ["jump"] },
    { name: "Gourd", how: ["Y / Triangle"], tip: "Heal.", actions: ["heal"] },
    { name: "Lock on", how: ["Left stick click", "Right stick click"], tip: "Press the stick in.", actions: ["lock"] },
    { name: "Menus", how: ["A / Cross"], tip: "Start a duel, rise again, go back to the title.", actions: [] },
  ],
  hands: [
    { name: "Move: left hand", how: ["Raise to walk forward", "Lower to back off", "Move sideways to strafe"], tip: "Hold your left hand up where it is comfortable. That spot is the centre. Close the fist to set a new centre. It works like a thumbstick in the air.", actions: ["move"] },
    { name: "Guard: right fist", how: ["Close your right fist"], tip: "Hold it closed to block. Close it just before a blow lands to deflect.", actions: ["block"] },
    { name: "Strike: right hand swipe", how: ["Swipe sideways, open hand"], tip: "A quick flick across your view. Faster than a wave.", actions: ["attack"] },
    { name: "Step: right hand down", how: ["Swipe down, open hand"], tip: "A quick downward chop.", actions: ["dodge"] },
    { name: "Jump: right hand up", how: ["Flick up, open hand"], tip: "A quick upward flick.", actions: ["jump"] },
    { name: "Setup", how: ["Camera at chest height", "Even light", "Keep each hand on its side"], tip: "Your left hand stays on the left half of the camera view and your right on the right. Press G to start, G again to stop. Video never leaves your browser. Gourd and lock-on stay on keys or the pad.", actions: [] },
  ],
};
