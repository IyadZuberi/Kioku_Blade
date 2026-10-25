import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeSay } from "../src/voice";

const wav = Buffer.from("RIFFfake");
const okFetch = (log: string[]) => (async (_u: unknown, init?: { body?: string }) => (log.push(JSON.parse(init!.body!).voice), new Response(wav, { status: 200 }))) as unknown as typeof fetch;

describe("makeSay", () => {
  it("asks the sidecar with the speaker's voice and caches by text", async () => {
    const log: string[] = [];
    const say = makeSay({ cacheDir: mkdtempSync(join(tmpdir(), "gr-voice-")), fetchFn: okFetch(log) });
    expect((await say("kurogane", "The owl waits."))?.equals(wav)).toBe(true);
    expect((await say("kurogane", "The  owl   waits."))?.equals(wav)).toBe(true); // same text after trimming: cached
    expect(log).toEqual(["am_onyx"]);
  });
  it("returns null for an unknown speaker, empty text, a down sidecar or beyond the per-minute cap", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gr-voice-"));
    const log: string[] = [];
    const say = makeSay({ cacheDir: dir, fetchFn: okFetch(log), perMinute: 1 });
    expect(await say("nobody", "hi")).toBeNull();
    expect(await say("kaede", "  ")).toBeNull();
    expect(await say("kaede", "One.")).not.toBeNull();
    expect(await say("kaede", "Two.")).toBeNull(); // over the cap
    const down = makeSay({ cacheDir: dir, fetchFn: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
    expect(await down("masatora", "Anything new.")).toBeNull();
  });
});
