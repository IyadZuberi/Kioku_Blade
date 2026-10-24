import { resolve } from "node:path";

/** Load the repo's .env (never overrides variables already set; a missing file is fine). */
export function loadEnv(path: string = resolve(process.cwd(), "..", ".env")): void {
  try {
    process.loadEnvFile(path);
  } catch {
    /* no .env */
  }
}