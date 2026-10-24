# CLAUDE.md — The General Remembers
Spec: docs/superpowers/specs/2026-10-24-the-general-remembers-design.md
Plan: docs/superpowers/plans/2026-10-24-the-general-remembers.md  (Global Constraints apply to every task)
Wiring notes: docs/notes/wiring.md
Rules: every LLM call via server/src/mubit/client.ts only; NO live Mubit call without the user's OK (credits limited); frozen prompt file never edited after seeding; plans are enums only; deflect windows never tightened; never block a frame on the network.
Run: `pnpm -C game dev` (5411), `pnpm -C server dev` (8787), tests `pnpm test`.
