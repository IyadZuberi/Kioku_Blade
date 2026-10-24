import { describe, expect, it } from "vitest";
import { QualityGovernor, pickQuality, settingsFor, withOverrides } from "../src/render/quality";

describe("quality", () => {
  it("picks low for Intel integrated GPUs", () => {
    expect(pickQuality("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)", "")).toBe("low");
    expect(pickQuality("ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)", "")).toBe("low");
  });
  it("picks high for discrete NVIDIA/AMD GPUs", () => {
    expect(pickQuality("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11)", "")).toBe("high");
    expect(pickQuality("ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11)", "")).toBe("high");
  });
  it("does not downgrade Intel Arc", () => {
    expect(pickQuality("ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)", "")).toBe("high");
  });
  it("?quality= overrides the GPU guess", () => {
    expect(pickQuality("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)", "?quality=high")).toBe("high");
    expect(pickQuality("ANGLE (NVIDIA, GeForce RTX 4060)", "?quality=low")).toBe("low");
    expect(pickQuality("ANGLE (NVIDIA, GeForce RTX 4060)", "?quality=bogus")).toBe("high");
  });
  it("low turns off AO and MSAA and caps the pixel ratio at 1", () => {
    const lo = settingsFor("low"), hi = settingsFor("high");
    expect(lo).toMatchObject({ pixelRatio: 1, ao: false, msaa: 0 });
    expect(hi).toMatchObject({ pixelRatio: 1.5, ao: true, msaa: 4, shadowMap: 4096, pointLights: 99, raySamples: 60, bloomLevels: 8 });
    expect(lo.shadowMap).toBeLessThan(hi.shadowMap);
    expect(lo.pointLights).toBeLessThan(hi.pointLights);
    expect(lo.raySamples).toBeLessThan(hi.raySamples);
    expect(lo.bloomLevels).toBeLessThan(hi.bloomLevels);
  });
});

describe("QualityGovernor", () => {
  const hi = { ...settingsFor("high"), pixelRatio: 1.5 };
  it("sheds AO first, after 3 slow readings in a row (below 50 fps)", () => {
    const g = new QualityGovernor(hi);
    expect([g.update(45), g.update(45), g.update(45)]).toEqual([null, null, { kind: "ao" }]);
  });
  it("then MSAA, then halves the shadow map down to 2048, then lowers the pixel ratio to a 0.7 floor", () => {
    const g = new QualityGovernor(hi);
    const steps = [];
    for (let i = 0; i < 60; i++) {
      const s = g.update(30);
      if (s) steps.push(s);
    }
    expect(steps).toEqual([
      { kind: "ao" },
      { kind: "msaa" },
      { kind: "shadow", value: 2048 },
      { kind: "pr", value: 1.35 },
      { kind: "pr", value: 1.2 },
      { kind: "pr", value: 1.05 },
      { kind: "pr", value: 0.9 },
      { kind: "pr", value: 0.75 },
      { kind: "pr", value: 0.7 },
    ]);
  });
  it("skips what the low preset already has off", () => {
    const g = new QualityGovernor(settingsFor("low"));
    const steps = [];
    for (let i = 0; i < 30; i++) {
      const s = g.update(30);
      if (s) steps.push(s);
    }
    expect(steps).toEqual([{ kind: "pr", value: 0.85 }, { kind: "pr", value: 0.7 }]);
  });
  it("a single dip, or a recovery in between, does nothing", () => {
    const g = new QualityGovernor(hi);
    expect([g.update(40), g.update(40), g.update(58), g.update(40), g.update(40)]).toEqual([null, null, null, null, null]);
  });
  it("waits for the change to settle before judging again", () => {
    const g = new QualityGovernor(hi);
    [g.update(40), g.update(40), g.update(40)];
    expect([g.update(40), g.update(40)]).toEqual([null, null]);
  });
  it("ignores a 0 reading (paused or not rendering)", () => {
    const g = new QualityGovernor(hi);
    expect([g.update(0), g.update(0), g.update(0), g.update(0)]).toEqual([null, null, null, null]);
  });
});

describe("withOverrides", () => {
  it("applies ?shadow= ?lights= ?rays= ?bloom= ?pr= for tuning on a real machine", () => {
    const s = withOverrides(settingsFor("high"), "?shadow=1024&lights=2&rays=20&bloom=4&pr=0.8");
    expect(s).toMatchObject({ shadowMap: 1024, pointLights: 2, raySamples: 20, bloomLevels: 4, pixelRatio: 0.8 });
  });
  it("ignores junk and out-of-range values", () => {
    const base = settingsFor("high");
    expect(withOverrides(base, "?shadow=abc&lights=-3&rays=0&bloom=99&pr=9")).toEqual(base);
  });
});
