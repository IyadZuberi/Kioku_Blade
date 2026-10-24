import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

describe("loadEnv", () => {
  it("loads KEY=VALUE lines but never overrides a variable that is already set", () => {
    const f = join(mkdtempSync(join(tmpdir(), "gr-env-")), ".env");
    writeFileSync(f, "GR_TEST_A=from_file\nGR_TEST_B=from_file\n");
    process.env.GR_TEST_B = "already";
    delete process.env.GR_TEST_A;
    loadEnv(f);
    expect(process.env.GR_TEST_A).toBe("from_file");
    expect(process.env.GR_TEST_B).toBe("already");
    delete process.env.GR_TEST_A;
    delete process.env.GR_TEST_B;
  });
  it("a missing file is fine", () => {
    expect(() => loadEnv("/no/such/.env")).not.toThrow();
  });
});