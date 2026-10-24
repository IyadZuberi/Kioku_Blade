import { describe, expect, it } from "vitest";
import { ResolutionGovernor, pickQuality, settingsFor } from "../src/render/quality";

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
    expect(settingsFor("low")).toEqual({ pixelRatio: 1, ao: false, msaa: 0 });
    expect(settingsFor("high")).toEqual({ pixelRatio: 1.5, ao: true, msaa: 4 });
  });
});

describe("ResolutionGovernor", () => {
  it("drops the pixel ratio by 0.15 after 3 low readings in a row", () => {
    const g = new ResolutionGovernor(1, 0.6);
    expect([g.update(20), g.update(20), g.update(20)]).toEqual([null, null, 0.85]);
  });
  it("a single dip, or a recovery in between, does nothing", () => {
    const g = new ResolutionGovernor(1, 0.6);
    expect([g.update(20), g.update(20), g.update(45), g.update(20), g.update(20)]).toEqual([null, null, null, null, null]);
  });
  it("never goes below the floor and never raises the ratio again", () => {
    const g = new ResolutionGovernor(0.7, 0.6);
    const out: (number | null)[] = [];
    for (let i = 0; i < 12; i++) out.push(g.update(15));
    expect(out.filter((x) => x !== null)).toEqual([0.6]);
    for (let i = 0; i < 12; i++) expect(g.update(60)).toBeNull();
  });
  it("ignores a 0 reading (paused or not rendering)", () => {
    const g = new ResolutionGovernor(1, 0.6);
    expect([g.update(0), g.update(0), g.update(0), g.update(0)]).toEqual([null, null, null, null]);
  });
});
