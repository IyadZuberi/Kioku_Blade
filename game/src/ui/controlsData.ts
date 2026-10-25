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

/** The moves list (Settings, Moves tab): what Kaede can do, and what each general does and how to answer it. */
export interface MoveRow {
  name: string;
  how: string;
  tip: string;
}
export const PLAYER_MOVES: MoveRow[] = [
  { name: "Strike", how: "Strike", tip: "Up to three cuts in a string. He turns long strings aside, so cut two or three and step back." },
  { name: "Charged cut", how: "Hold Strike", tip: "Slow, but it drives through his guard for heavy posture damage." },
  { name: "Deflect", how: "Tap Guard as the blow lands", tip: "The heart of the duel. Each deflect builds his posture; chained deflects build it faster." },
  { name: "Block", how: "Hold Guard", tip: "Safe but it fills your own posture bar. A full bar leaves you open." },
  { name: "Mikiri counter", how: "Step into a thrust", tip: "Step toward him as a thrust comes in: you stamp on the blade and he reels." },
  { name: "Jump kick", how: "Jump, then Jump again at him", tip: "Over a sweep or a ring, then off his head." },
  { name: "Deathblow", how: "Strike at the red dot", tip: "When his posture breaks or his health is gone. Two deathblows end the duel." },
  { name: "Gourd", how: "Gourd key", tip: "Heals. He punishes it if you drink in reach." },
];
export const BOSS_MOVES_LIST: { boss: string; style: string; moves: MoveRow[] }[] = [
  {
    boss: "Masatora, the Garden Duelist",
    style: "Katana. Patient and exact, like a Sekiro swordmaster: he waits for you, then punishes the cut you should not have made.",
    moves: [
      { name: "Riposte stance", how: "Do NOT cut into it. Wait, or step round", tip: "His steel glows bright blue and he stands guarded. Any cut into it is parried and answered. When the glow fades he steps in with a delayed cut or a thrust." },
      { name: "Three-cut string", how: "Deflect each cut", tip: "Even rhythm." },
      { name: "Delayed string", how: "Wait for the third cut", tip: "The third cut hangs. Pressing early is what he wants." },
      { name: "Thrust (red !)", how: "Deflect, sidestep or step in (mikiri)", tip: "Cannot be blocked." },
      { name: "Sweep (red !)", how: "Jump", tip: "At the ankles." },
      { name: "Grab (red !)", how: "Step away or jump", tip: "Missed, it leaves him open." },
    ],
  },
  {
    boss: "Kazemaru, the Spear of the Wind",
    style: "Yari. Fast and far-reaching: he attacks from across the room, springs away and comes straight back, and parries strings.",
    moves: [
      { name: "Spear lunge (red !)", how: "Deflect, sidestep or step in", tip: "A thrust from the far side of the room. Watch the glint, not his feet." },
      { name: "Backflip", how: "Hold your ground, then answer the lunge", tip: "He springs away and the lunge follows at once. Do not chase him." },
      { name: "Whirling spear", how: "Deflect", tip: "One wide spin all round him; stepping rarely clears it." },
      { name: "Wind cut", how: "Jump or deflect", tip: "An overhead that throws a blade of wind along the ground." },
      { name: "Waterfowl", how: "Deflect five cuts", tip: "A leap straight into a five-cut flurry; the last cut is late." },
    ],
  },
  {
    boss: "Kurogane, the Hollow Shogun",
    style: "Odachi and shinobi tricks, in the manner of Sekiro's Owl: smoke, thrown stars, and a kick for the guard.",
    moves: [
      { name: "Smoke bomb", how: "Turn, then deflect the cut from behind", tip: "He vanishes in smoke and reappears behind you with an overhead. Listen for the whoosh and watch the smoke." },
      { name: "Shuriken fan", how: "Jump or step out of the fan", tip: "Three stars in a spread. Thrown from range." },
      { name: "Stamp kick", how: "Deflect or step aside", tip: "Crushes a held block. Never just hold guard against it." },
      { name: "Shockwave slam", how: "Jump the ring", tip: "A leaping slam that sends a ring across the ground." },
      { name: "Great overhead", how: "Deflect", tip: "Slow wind-up, enormous posture damage if blocked." },
      { name: "Grab (red !)", how: "Step away", tip: "He throws you into the ground." },
    ],
  },
];

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
    { name: "Hands and menus", how: ["G", "F1", "M"], tip: "G turns webcam hand control on or off, F1 opens Settings, M mutes.", actions: [] },
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
    { name: "Fight: your own poses", how: ["Guard, strike, step, jump, gourd, lock on"], tip: "Press Train my poses, pick an action and hold the hand shape you want for it. Poses react in a blink and stay in this browser. Teach a Rest pose too so a relaxed hand does nothing. Guard stays on while you hold its pose.", actions: ["block", "attack", "dodge", "jump"] },
    { name: "Setup", how: ["Camera at chest height", "Even light", "Keep each hand on its side"], tip: "Your left hand stays on the left half of the camera view and your right on the right. Press G to start, G again to stop. Video never leaves your browser.", actions: [] },
  ],
};
