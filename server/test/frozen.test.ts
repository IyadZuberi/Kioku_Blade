import { describe, expect, it } from "vitest";
import { taskHash } from "../src/mubit/client";
import { generalPlanTask } from "../src/prompts/general_plan";

// The Mubit task is the model + the system prompt + the schema. The 80 seeded examples (and the adapter
// trained on them) belong to THIS hash; changing the moves list, the habit counters, the prompt text or the
// plan schema starts a new, empty task. If you mean to do that, change the hash here on purpose.
describe("the Mubit task is frozen", () => {
  it("has the seeded hash", () => {
    expect(taskHash(generalPlanTask)).toBe("1983d052a53a");
  });
});

import { generalSpeechTask } from "../src/prompts/general_speech";

describe("the speech task is its own task", () => {
  it("has its own hash, different from the plan's", () => {
    expect(taskHash(generalSpeechTask)).toBe("3d1812e9ba5d");
    expect(taskHash(generalSpeechTask)).not.toBe(taskHash(generalPlanTask));
  });
});
