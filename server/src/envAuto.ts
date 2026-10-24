import { loadEnv } from "./env";

// Import this FIRST in entry points: modules like prompts/general_plan read env at import time.
loadEnv();
