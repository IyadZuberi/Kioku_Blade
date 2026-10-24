import { describe, expect, it } from "vitest";
import { pickQuality, settingsFor } from "../src/render/quality";

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

