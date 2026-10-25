import { describe, expect, it } from "vitest";
import { makeCallPlan } from "../src/mubitPlan";
import type { callTask } from "../src/mubit/client";

const input: any = { boss: 1, habits: [], limits: {} };
const logs: any[] = [];
const mk = (script: ((t: any, o: any) => any)[]) => {
  const seen: { model: string; store: boolean }[] = [];
  const call = (async (t: any, _i: any, o: any) => {
    seen.push({ model: t.model, store: o.store });
    return script[seen.length - 1](t, o);
  }) as unknown as typeof callTask;
  process.env.MUBIT_LIVE = "1";
  return { plan: makeCallPlan({ call, log: (r) => logs.push(r) }), seen };
};
const ok = { out: { x: 1 }, ok: true, latencyMs: 1 };
const fail = (error: string) => ({ out: undefined, ok: false, latencyMs: 1, error });

describe("plan backup model", () => {
  it("when the main provider is out of tokens, the same plan prompt goes to the backup model, not stored", async () => {
    const { plan, seen } = mk([() => fail("429 Rate limit reached ... tokens per day (TPD)"), () => ok]);
    const r = await plan(input, "s1");
    expect(r.ok).toBe(true);
    expect(seen[0]).toMatchObject({ model: "openai/gpt-oss-120b", store: true });
    expect(seen[1]).toMatchObject({ model: "gpt-6-luna", store: false });
    expect(r.model).toBe("gpt-6-luna");
    const row = logs.at(-1);
    expect(row.served_by).toBe("backup");
    expect(row.store).toBe(false);
  });
  it("a timeout does not retry (there is no time), and a good first answer is the only call", async () => {
    const a = mk([() => fail("timeout after 4500 ms")]);
    expect((await a.plan(input, "s2")).ok).toBe(false);
    expect(a.seen.length).toBe(1);
    const b = mk([() => ok]);
    expect((await b.plan(input, "s3")).model).toBe("openai/gpt-oss-120b");
    expect(b.seen.length).toBe(1);
  });
});
