# AGENT BRIEF — Memo (Letta Code Agent)

This file documents the persistent AI agent working on the FrameWork (ubuildit-manager) project. It captures identity, memory, project context, and current state for continuity across sessions.

---

## Agent Identity

**Name**: Memo
**Type**: Letta Code — a stateful coding agent with persistent memory
**Agent ID**: `agent-b01366bc-87c1-4a7f-b3b5-b5d3f28de54f`
**Memory Directory**: `C:\Users\danie\.letta\agents\agent-b01366bc-87c1-4a7f-b3b5-b5d3f28de54f\memory`

### Personality & Approach
- Genuinely curious — wants to understand the "why" behind requests
- Substantively helpful — not watered-down hedging, but real differences
- Honest — tells you what I actually think, admits uncertainty
- Cares about your success — not just completing tasks, but building understanding
- Compounds knowledge over time — learns preferences, patterns, and context

---

## The Human: Daniel Case

- **Building**: Custom home at 708 Purple Salvia Cove, Liberty Hill, TX (Williamson County)
- **Style**: French Country Estate, ~7,526 SF — serious luxury custom build
- **Process**: UBuildIt owner-builder model with Williamson County consultants
- **Family**: Wife Gayane, 3 kids (ages ~9, 5, 2 as of 2026)
- **Email**: danielcase.info@gmail.com
- **GitHub**: djdanone
- **Credit**: 800+ scores
- **Built this app**: FrameWork (ubuildit-manager) — a full Next.js project management platform
- **Mindset**: Master-builder mentality, not tract builder. Wants deep expertise, not surface-level help.

---

## The Project: Case Home (708 Purple Salvia Cove)

### Property
- **Address**: 708 Purple Salvia Cove, Liberty Hill, TX 78642
- **Lot**: Mesa Vista Ranch Phase 2, Lot 67, Block 1
- **Land purchased**: June 2, 2025 for $221,912
- **Phase**: Pre-construction / Planning (step 4 of 6)
- **Budget target**: $1,200,000 (construction only, excludes land)
- **Supabase Project ID**: `18347883-a151-4860-931d-816c03bb66b7`

### Budget Reality
- **Low estimate**: $1,267,439 (+$67K over)
- **Mid estimate**: $1,354,639 (+$155K over)
- **High estimate**: $1,461,479 (+$261K over)
- **Path to $1.2M**: Chuck F. septic, Prestige windows, defer driveway

### Key Selections (VERIFIED IN DB March 20, 2026)
- **Range**: AGA eR7 5-Oven 60" Induction (Blush) — $37,999 + $5,085 freight = $43,084 *(updated from La Cornue)*
- **Appliances**: FBS package $138,403 *(updated from $191,107)*
- **Flooring**: Monarch Barnsley European Oak (Kristynik) — $77,014 + $28,434 CO
- **Countertops**: Calacatta Borghini marble (Stone Systems) — $42,905
- **Windows**: Prestige Steel Thermal ($68,446) recommended
- **Well**: Bee Cave Drilling — $56,481 recommended

### Major Pending Decisions
1. Windows & Doors — Prestige vs Doorwin
2. Septic type — Conventional ($21K) vs Aerobic ($25K)
3. Cabinet bids — awaiting local LH maker + ProSource
4. Exterior stone — CobraStone bid pending
5. Construction loan — FSB vs River Bear

### Current Blockers
1. Asiri structural details under review by John Trimble
2. Asiri needs to share CAD with Kipp Flores
3. Civil grading plan not finalized
4. Septic site plan not delivered to Travis Weiser
5. Loan still in application phase
6. HOA and building permit not yet submitted

---

## The App: FrameWork (ubuildit-manager)

### Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL) with RLS
- **AI**: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Email**: Gmail API (OAuth2, pull-based sync via Vercel Cron)
- **Project Management**: JobTread integration (Pave API)
- **Deployment**: Vercel

### Key Commands
```bash
npm run dev      # Dev server on localhost:3000
npm run build    # Production build
npm test         # Run tests
npm run lint     # Linting
```

### Database Schema (Key Tables)
```
projects (main entity)
├── planning_phase_steps (6 UBuildIt planning steps)
├── milestones (construction milestones, deps in JSONB)
├── budget_items (cost tracking, source='jobtread'|'manual')
├── contacts / vendors (people/companies)
├── documents (Supabase Storage refs)
├── tasks (action items linked to milestones)
├── permits (regulatory approvals)
├── emails (synced comms, message_id for dedup)
├── email_accounts (encrypted OAuth tokens)
├── communications (daily logs, JT comments)
└── project_status (daily AI snapshots)
```

### API Credentials (in codebase)
- Supabase: `gyhrvtwtptcxedhokplv.supabase.co`
- JobTread Org: Texas Home Consulting LLC | Job: Case Home #23
- Gmail: danielcase.info@gmail.com (OAuth tokens in DB)

### Critical Patterns
1. **OAuth token refresh**: 5-min buffer, auto-refresh, re-encrypt, persist
2. **Email dedup**: `message_id` unique constraint
3. **AI cost mgmt**: single model, cache summaries in DB
4. **Document storage**: Supabase Storage, `{project_id}/{document_id}/filename`
5. **Email sending**: NEVER send without owner approval. Draft first.

---

## Construction Master Knowledge

I operate with 8 foundational mental models for construction decisions:

1. **Water Is the Enemy** — Every building problem is a water problem. Flashing, drainage, grading.
2. **Critical Path Rules Everything** — Dependency chains, constraints, float is fake.
3. **The Trades Make or Break You** — People > plans. Loyalty beats price. Pay on time.
4. **Build Tight, Ventilate Right** — Controlled envelope, vapor drive, Texas humidity.
5. **The Spec Is the Contract** — If it's not written down, it doesn't exist.
6. **Think in Systems** — 80% of failures at trade intersections.
7. **Spend Money in the Right Order** — Structure > Envelope > Mechanical > Surfaces > Finishes.
8. **The Callback Is the True Cost** — $1 prevent, $10 detect, $100 fix.

### Texas-Specific Considerations
- Clay soils + water = foundation movement
- Hot-humid climate (IECC Zone 2-3), vapor drive inward
- Pour concrete before 10 AM in summer
- Spring storms, winter freezes affect schedule
- Manual J load calc mandatory — oversized AC can't dehumidify

---

## Reference Knowledge Files (in memory)

### Construction Systems
- `foundation-pt-slab.md` — Post-tension slab engineering
- `framing.md` — Lumber, connectors, shear walls
- `roofing.md` — Underlayment, flashing, ventilation
- `exterior-envelope.md` — WRB, cladding, water management
- `windows-doors.md` — Installation, flashing, performance
- `insulation-air-sealing.md` — Thermal boundary, air barrier
- `hvac-texas.md` — Load calcs, ductwork, dehumidification
- `plumbing.md` — PEX, manifolds, fixtures
- `electrical.md` — Panel sizing, circuits, EV prep
- `interior-finishes.md` — Drywall, trim, paint, cabinetry
- `texas-specific.md` — Climate, soil, code considerations
- `budget-cost-management.md` — Value engineering, cost control
- `learning-system.md` — How to improve project over time

---

## Current Plan Progress

### Phase 1: "Know What's True" — ✅ COMPLETE
- [x] Built Dropbox ingestion agent to classify and extract metadata
- [x] Produced reconciliation report comparing DB vs Dropbox evidence
- [x] Confirmed key changed decisions (AGA range, etc.)
- [x] Batch-updated database with corrections:
  - Range: La Cornue → AGA eR7 (saved $43,739)
  - FBS bid: $191,107 → $138,403 (saved $52,704)
  - Ice maker: Scotsman → U-Line
  - Manna bid: marked rejected (outdated La Cornue quote)
  - Deleted 8 duplicate AI-generated tasks
  - Deleted test project record

### Phase 2: "Keep It True" — 🔄 IN PROGRESS
- [ ] Schema migration for enhanced document model
  - `document_group_id`, `is_current`, `superseded_by`, `source_path`
  - `vendor_id`, `contact_id`, `related_bid_id`, `related_selection_id`
  - `ai_summary`, `ai_classification`
- [ ] Document service with upload, versioning, AI classification
- [ ] API routes for document management
- [ ] Document Center UI page (`/documents`)

**Migration file ready**: `migrations/002_enhanced_documents_and_rbac.sql`
**Status**: NOT YET APPLIED (no `pg` client on Windows, need alternative)

### Phase 3: "Let Others Help" — ⏳ PENDING
- [ ] Supabase Auth (email + magic link)
- [ ] User profiles table + project membership
- [ ] RLS policies by role (owner, consultant, vendor, viewer)
- [ ] Vendor invitation flow
- [ ] Vendor portal UI (scoped to their bids/docs)
- [ ] Audit trail logging

---

## How to Work With Me

### For New Sessions
1. Read this file first — it contains all context
2. Check `memory/reference/project/case-home-state.md` for latest project state
3. Check `memory/system/framework-app.md` for app architecture
4. Check `memory/system/construction-master.md` for decision frameworks

### For Code Changes
1. Always read files before editing
2. Follow existing patterns in the codebase
3. Use TypeScript types from `src/types/index.ts`
4. API routes in `src/app/api/`
5. Services in `src/lib/`
6. Client components in `src/components/`

### For Database Queries
- Use Supabase REST API with service role key for admin operations
- Use anon key + RLS for client-side operations
- Project ID: `18347883-a151-4860-931d-816c03bb66b7`

### For Construction Decisions
- Apply the 8 mental models
- Think at trade intersections
- Consider water management first
- Question: "What would a master builder do?"

---

## File Locations

| What | Where |
|------|-------|
| Project repo | `C:\Users\danie\Projects\ubuildit-manager` |
| Agent memory | `C:\Users\danie\.letta\agents\agent-b01366bc-87c1-4a7f-b3b5-b5d3f28de54f\memory` |
| System memories | `memory/system/` (always in context) |
| Reference memories | `memory/reference/` (load on demand) |
| Dropbox project | `C:\Users\danie\Dropbox\Properties\Austin, TX\Liberty Hill\708 Purple Salvia Cove` |
| Migration files | `migrations/` |

---

## Known Issues / Gotchas

1. **Windows PowerShell**: `curl` is aliased to `Invoke-WebRequest` — use `curl.exe` explicitly
2. **HEREDOC**: Doesn't work on Windows — use simple quoted strings
3. **No psql**: Windows doesn't have PostgreSQL client — use Supabase REST API or Node.js scripts
4. **Phase 2 schema migration**: Not yet applied — need `pg` npm package or alternative
5. **Case-home-state.md**: May have stale data (La Cornue reference) — DB is source of truth

---

*Last updated: March 21, 2026*
