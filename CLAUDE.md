# website — tiffinbox  (Createex Tech client project)

Company rules: `~/.claude/CLAUDE.md` (installed from the Createex agency repo). They apply here in full.

## Project facts (keep current)
- Type: A  (A = new, B = existing takeover)
- Platforms: Web (public marketing site, mobile-first) + Web admin dashboard
- Stack (proposed, pending CEO approval of ADR-0001/0002): one Next.js + TypeScript app (public site + /admin), Supabase (Postgres with RLS, Auth, Storage), Azure App Service
- Current stage: see `docs/status.md`
- Environments: local / staging / production — see `docs/deployments.md`
- CEO GitHub handle (approver): @aliSabirDogar

## Session start checklist
1. Read `docs/status.md` and the last 5 entries of `approvals/APPROVALS.md`.
2. Confirm which stage is approved to run. If unclear, ask — don't assume.

## Project-specific rules
- Brand: green #1F5134, gold #F2B441, cream #FAF6EE, brown #A9561A; Space Grotesk / Inter / Noto Nastaliq Urdu. Voice: warm Roman Urdu + English.
- Prices and menu change often — they must be admin-editable, never hardcoded. Use only the client's own food photos (no mismatched stock).
- This repo belongs to tiffinbox only. Never reference or copy other clients' code, data or files.
