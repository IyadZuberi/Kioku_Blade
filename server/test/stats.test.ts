import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db";

let server: any;
afterEach(() => server?.close());
function boot(dataDir: string) {
  const app = createApp({ db: openDb(":memory:"), callPlan: async () => ({ out: undefined, ok: false, latencyMs: 0 }), dataDir });
  server = app.listen(0);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("GET /api/stats", () => {
  it("empty data dir returns no rows and zero calls", async () => {
    const base = boot(mkdtempSync(join(tmpdir(), "gr-st-")));
    const j: any = await (await fetch(base + "/api/stats")).json();
    expect(j.rows).toEqual([]);
    expect(j.calls.total).toBe(0);
  });
  it("reads summary.csv rows and aggregates calls.csv by served_by", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gr-st-"));
    mkdirSync(join(dir, "eval"));
    writeFileSync(join(dir, "eval", "summary.csv"), "label,iso,n,valid_rate,target_rate,agree_rate,violations,p50_ms,p95_ms,mean_in_tok,mean_out_tok,cost_per_1k,notes\nbaseline,t,60,1,1,,0,1,2,0,0,,\nprovider,t,60,0.95,0.9,1,0,800,1500,1500,100,5.2,\"Served by: X\"\n");
    writeFileSync(join(dir, "calls.csv"), "ts,task,task_hash,session_id,store,ok,latency_ms,prompt_tokens,completion_tokens,request_id,served_by,error\nt,general_plan,h,s1,true,true,100,10,5,mreq_a,unknown,\nt,general_plan,h,s2,true,true,300,10,5,mreq_b,unknown,\nt,general_plan,h,s3,true,false,50,,,,unknown,timeout\n");
    const base = boot(dir);
    const j: any = await (await fetch(base + "/api/stats")).json();
    expect(j.rows.map((r: any) => r.label)).toEqual(["baseline", "provider"]);
    expect(j.rows[1].notes).toBe("Served by: X");
    expect(j.calls.total).toBe(3);
    expect(j.calls.ok).toBe(2);
    expect(j.calls.byServedBy.unknown.n).toBe(3);
    expect(j.calls.byServedBy.unknown.p50).toBe(100);
    expect(j.calls.lastRequestId).toBe("mreq_b");
  });
  it("serves the dashboard page", async () => {
    const base = boot(mkdtempSync(join(tmpdir(), "gr-st-")));
    const r = await fetch(base + "/dashboard");
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("<html");
  });
});