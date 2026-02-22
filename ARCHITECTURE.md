# UBuildIt Manager - Technical Architecture

## 1. What This Application Does

UBuildIt Manager is a **single-user construction project management application** built for a homeowner managing the construction of a custom home at 708 Purple Salvia Cove, Liberty Hill, TX using the **UBuildIt owner-builder process**. It provides:

- **Project Dashboard**: Real-time view of project phase, planning step progress, budget, upcoming milestones, and pending tasks.
- **Email Integration**: Gmail OAuth connection that syncs construction-related emails, runs AI analysis on each, and surfaces actionable intelligence (urgent matters, action items, decisions, questions).
- **AI-Powered Status Reports**: Iterative daily status snapshots that build on previous reports using Claude Sonnet, producing hot topics, action items, recent decisions, and a narrative summary.
- **Bid Management**: AI extraction of bids from emails and documents, side-by-side comparison with pros/cons analysis, bid selection workflow that auto-rejects competing bids, and finalization to budget line items.
- **Budget Tracking**: Line-item budget with estimated vs. actual costs, linked to vendors and bid selections.
- **Selections Tracking**: Product/material selections (appliances, flooring, countertops, windows) with status tracking from "considering" through "installed".
- **Document Upload & Analysis**: Upload construction documents (PDF, DOC, EML) for AI extraction of milestones, tasks, hot topics, and vendor data.
- **Draft Email Generation**: AI-suggested email drafts based on project insights, with an in-app editor and send-via-Gmail capability.
- **Mobile Views**: Simulated mobile job-site dashboard with task lists and crew status (demo/prototype).

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.4.6 |
| Language | TypeScript | 5.9.2 |
| React | React + React DOM | 19.1.1 |
| Styling | Tailwind CSS + tailwindcss-animate | 3.4.17 |
| UI Components | shadcn/ui (Radix primitives) + Lucide icons | Various |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2.54.0 |
| AI | Anthropic Claude Sonnet 4.5 | @anthropic-ai/sdk 0.74.0 |
| Email | Google Gmail API | googleapis 155.0.1 |
| State | Zustand (declared dep, not actively used) | 5.0.7 |
| Auth | next-auth (declared dep, not actively used) | 4.24.13 |
| Charts | Recharts | 3.7.0 |
| Animations | Framer Motion | 12.34.0 |
| Toasts | Sonner | 2.0.7 |
| Dates | date-fns + date-holidays | 4.1.0 / 3.26.8 |
| Deployment | Vercel | Cron + Edge |

---

## 3. Application Architecture

### 3.1 Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Navigation + Toaster)
│   ├── page.tsx                  # Dashboard (/)
│   ├── loading.tsx               # Root loading spinner
│   ├── error.tsx                 # Root error boundary (client)
│   ├── HomeClient.tsx            # Client component for dashboard interactivity
│   ├── emails/
│   │   ├── page.tsx              # Gmail connection check + EmailDashboard (client)
│   │   └── loading.tsx
│   ├── bids/
│   │   ├── page.tsx              # Bid list (server + Suspense)
│   │   ├── BidsClient.tsx        # Interactive bid management
│   │   └── loading.tsx
│   ├── budget/
│   │   ├── page.tsx              # Budget items (server + Suspense)
│   │   ├── BudgetClient.tsx      # Interactive budget editor
│   │   └── loading.tsx
│   ├── project-status/
│   │   ├── page.tsx              # Multi-stream status (4 Suspense boundaries)
│   │   └── loading.tsx
│   ├── selections/
│   │   ├── page.tsx              # Selections list (server + Suspense)
│   │   ├── SelectionsClient.tsx  # Interactive selection management
│   │   └── loading.tsx
│   ├── mobile/
│   │   ├── page.tsx              # Mobile dashboard wrapper
│   │   └── tasks/page.tsx        # Mobile quick actions
│   └── api/                      # API routes (see Section 5)
├── components/
│   ├── ui/                       # 26 shadcn/ui primitives + custom
│   │   ├── button.tsx, card.tsx, badge.tsx, dialog.tsx, ...
│   │   ├── LoadingSpinner.tsx    # Skeleton loading state
│   │   ├── ErrorCard.tsx         # Error display with retry
│   │   ├── error-boundary.tsx    # React error boundary
│   │   └── construction-date-picker.tsx  # Work-day aware picker
│   ├── construction/             # Domain-specific UI
│   │   ├── status-indicator.tsx  # Configurable status badges
│   │   ├── project-button.tsx    # Project card button
│   │   └── timeline-chart.tsx    # Gantt-style timeline
│   ├── mobile/                   # Mobile prototype components
│   │   ├── MobileLayout.tsx      # Simulated phone UI
│   │   ├── JobSiteDashboard.tsx  # Demo task/crew dashboard
│   │   └── QuickActions.tsx
│   ├── Navigation.tsx            # Top nav bar (client)
│   ├── UBuildItWorkflowBar.tsx   # 6-step planning progress (client)
│   ├── EmailDashboard.tsx        # Email intelligence view (client)
│   ├── DraftEmailsPanel.tsx      # AI draft editor + send (client)
│   ├── GmailConnect.tsx          # OAuth connection flow (client)
│   ├── FileUpload.tsx            # Drag-drop document upload (client)
│   └── BidReviewCard.tsx         # Detailed bid card with actions (client)
├── lib/                          # Service layer (see Section 4)
├── hooks/
│   └── use-mobile.tsx            # useIsMobile() responsive hook
└── types/
    └── index.ts                  # All shared TypeScript interfaces
```

### 3.2 Rendering Strategy

The app uses **Server Components by default** with strategic client boundaries:

| Page | Rendering | Pattern |
|------|-----------|---------|
| `/` (Dashboard) | Server | Single Suspense wrapping async `DashboardData` component |
| `/emails` | Client | `useEffect` checks Gmail auth, conditionally renders `EmailDashboard` or `GmailConnect` |
| `/bids` | Server | Suspense wrapping async `BidsData` |
| `/budget` | Server | Suspense wrapping async `BudgetData` |
| `/project-status` | Server | **4 independent Suspense boundaries** (QuickStats, StatusContent, Communications, Budget) |
| `/selections` | Server | Suspense wrapping async `SelectionsData` |
| `/mobile/*` | Server | Static wrappers for client mobile components |

**Data fetching pattern for server pages:**
```
page.tsx (server) → async inner component → service function → Supabase query
                  → passes data as props to Client component
```

**Data fetching pattern for client pages:**
```
page.tsx (client) → useEffect → fetch('/api/...') → setState → render
```

### 3.3 State Management

Despite Zustand being a declared dependency, **no Zustand stores exist**. State management relies on:

1. **Server Components** for initial data (fetched at render time)
2. **React useState/useEffect** for local component state
3. **API routes** as data mutation endpoints called via `fetch()`
4. **No global client state** - each page manages its own data independently

---

## 4. Service Layer (`src/lib/`)

### 4.1 Core Services

#### `supabase.ts` / `supabase-server.ts` - Database Client
- **Client-side**: Singleton `createClient(url, anonKey)` shared across app
- **Server-side**: Factory function creating per-request instances
- Both use the **public anon key**, relying on Row-Level Security
- No service role key usage in production code

#### `database.ts` - DatabaseService (Singleton: `db`)
All methods are error-safe (return null/empty on failure, never throw).

| Method | Purpose |
|--------|---------|
| `getEmailAccount(email)` | Fetch OAuth account by email address |
| `upsertEmailAccount(account)` | Insert/update email account (onConflict: email_address) |
| `updateLastSync(email)` | Update last_sync timestamp |
| `getStoredEmails(projectId?, limit)` | Fetch emails, optionally filtered by project |
| `storeEmail(email)` / `storeEmails(emails[])` | Upsert emails (onConflict: message_id for dedup) |
| `emailExists(messageId)` | Check deduplication |
| `getRecentEmails(days)` | Fetch emails within N days |
| `getOrCreateProject(address?)` | Find project by address or create with defaults |
| `getLatestProjectStatus(projectId)` | Fetch most recent status row |
| `upsertProjectStatus(projectId, data)` | Insert/update daily status (onConflict: project_id+date) |
| `getProjectContactEmails(projectId)` | Get tracked contact email addresses |
| `buildEmailSearchQuery(projectId, days)` | Build Gmail query from contacts + UBuildIt domain + property address |

#### `project-service.ts` - Project Orchestration
| Function | Purpose |
|----------|---------|
| `getProject()` | Fetch first project (ordered by created_at ascending) |
| `getProjectDashboard()` | Parallel fetch of 5 queries → DashboardData |
| `getProjectStatus()` | Parallel fetch of 6 queries → ProjectStatusData |
| `updateProjectStatus(projectId)` | Fetch previous status + emails → AI generation → upsert |
| `getActiveHotTopics(projectId)` | Extract hot_topics text from latest status |
| `getRecentCommunications(projectId)` | Recent email sender + AI summary pairs |
| `getBudgetSummary(projectId)` | Total/spent/categories budget breakdown |

#### `gmail.ts` - GmailService
| Method | Purpose |
|--------|---------|
| `getAuthUrl()` | Generate Google OAuth authorization URL (scopes: gmail.readonly, gmail.modify) |
| `getTokens(code)` | Exchange auth code for OAuth tokens |
| `setCredentials(tokens)` | Load tokens into OAuth client |
| `refreshAccessToken()` | Refresh expired access token using refresh_token |
| `isTokenExpired()` | Check expiry (5-minute buffer) |
| `getEmails(query)` | Search Gmail, fetch up to 20 full messages, parse bodies |
| `sendEmail(to, subject, htmlBody)` | Compose RFC 2822 message and send via Gmail API |
| `markAsRead(messageId)` | Remove UNREAD label |

OAuth tokens stored in httpOnly cookies (access: 7-day, refresh: 30-day) and in `email_accounts.oauth_tokens` (JSONB, **currently unencrypted**).

### 4.2 AI Services

All AI calls use **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`) via the Anthropic SDK.

#### `ai-clients.ts` - Client Management
- Lazy singleton `getAnthropicClient()` (instantiated on first call)
- `parseAIJsonResponse(text)` - strips markdown code fences, parses JSON

#### `ai-summarization.ts` - Summarization & Status
| Function | Temp | Max Tokens | Purpose |
|----------|------|------------|---------|
| `summarizeIndividualEmail(email)` | 0.3 | 200 | 2-3 sentence email summary |
| `summarizeEmails(emails[])` | 0.2 | 2048 | Batch analysis → ProjectSummary |
| `generateDailyProjectSummary(data, emails, activity)` | 0.7 | 600 | Friendly narrative summary |
| `generateProjectStatusSnapshot(emails, context, previousStatus?)` | 0.2 | 3000 | **Iterative** status with hot_topics, action_items, decisions, summary |

The status snapshot function is **iterative** - it receives the previous report and instructs the AI to:
- KEEP relevant hot topics, REMOVE resolved ones, ADD new ones
- UPDATE action item statuses from email evidence, KEEP unresolved
- KEEP all previous decisions, ADD new ones
- REWRITE the narrative summary incorporating both old and new context

#### `claude-email-agent.ts` - Email Intelligence
| Function | Temp | Max Tokens | Purpose |
|----------|------|------------|---------|
| `summarizeEmail(email)` | 0.2 | 1024 | Deep email analysis → EmailInsights |
| `analyzeProjectEmails(emails[])` | 0.2 | 2048 | Cross-email analysis → ProjectInsights |
| `triageEmail(email)` | 0.0 | 256 | Priority classification (critical/high/medium/low) |
| `generateDraftEmails(insights, emails[])` | 0.3 | 3000 | Up to 5 recommended email drafts (HTML) |

#### `bid-extractor.ts` - Bid Intelligence
| Function | Temp | Max Tokens | Purpose |
|----------|------|------------|---------|
| `extractBidFromEmail(subject, body, sender, name?)` | 0.1 | 4096 | Extract structured bid data from email text |
| `extractBidFromDocument(text, vendor?, filename?)` | 0.1 | 4096 | Extract bid from document content |
| `refineBidExtraction(bid, context, feedback?)` | 0.1 | 4096 | Re-analyze with additional context |
| `compareBids(bids[], context?)` | 0.2 | 3000 | Side-by-side analysis with recommendation |

#### `document-analyzer.ts` - Document Processing
| Function | Purpose |
|----------|---------|
| `analyzeProjectDocument(content, filename)` | Extract milestones, tasks, hot topics, vendors, budget data from documents |

### 4.3 Supporting Services

| File | Purpose |
|------|---------|
| `env.ts` | Centralized environment variable access with `requiredEnv()` / `optionalEnv()` |
| `api-utils.ts` | `successResponse()`, `errorResponse()`, `validationError()` helpers |
| `errors.ts` | `AppError`, `AuthenticationError`, `ValidationError`, `ExternalServiceError` classes |
| `ui-helpers.ts` | Email formatting, priority colors, date formatting |
| `utils.ts` | `cn()` class merger, currency/date formatting, accessibility helpers, localStorage wrappers, debounce/throttle |
| `construction-phases.ts` | 8-phase construction data model with trades, bid categories, budget estimates |
| `budget-service.ts` | `getBudgetItems(projectId)` |
| `bids-service.ts` | `getBids(projectId)` |
| `selections-service.ts` | `getSelections()`, `updateSelection()`, `createSelection()` |
| `accessibility-testing.ts` | WCAG 2.1 AA automated audit (9 tests, 0-100 scoring) |
| `seed-parsers.ts` | Database seeding with 15 contacts, 22 vendors, 16 bids, 13 action items, 6 selections |

---

## 5. API Routes

### 5.1 Gmail OAuth Flow

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/gmail/auth` | GET | Generate Google OAuth URL → redirect user |
| `/api/auth/google/callback` | GET | Exchange auth code → store tokens in DB + cookies → redirect to `/?success=connected` |

### 5.2 Email Operations

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/emails/fetch` | GET | Returns cached DB emails or fetches from Gmail API (params: `refresh`, `analyze`) |
| `/api/emails/send` | POST | Send HTML email via Gmail API (body: `to`, `subject`, `body`) |
| `/api/emails/drafts` | GET | Generate AI-suggested email drafts from recent email analysis |
| `/api/emails/drafts/generate` | POST | Generate single draft from action item context |

### 5.3 Project Status

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/project-status` | GET | Return latest ProjectStatusData |
| `/api/project-status/generate` | POST | Trigger iterative AI status generation → upsert to DB |

### 5.4 Bid Management

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/bids/manage` | GET | List bids (params: `project_id`, `category`, `status`) |
| `/api/bids/manage` | PATCH | Update bid status (select/reject/under_review/update) |
| `/api/bids/manage` | POST | Finalize selected bid → create budget_item |
| `/api/bids/compare` | POST | AI comparison of 2+ bids |
| `/api/bids/extract-from-email` | POST | AI extraction of bid data from email content |

### 5.5 Other

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/selections` | PATCH | Update product selection |
| `/api/upload` | POST | Upload document (max 10MB) → AI analysis → store results |
| `/api/cron/sync-emails` | POST | Vercel Cron job (daily 8 AM UTC): sync Gmail, run AI summaries, update project status |
| `/api/admin/seed` | POST | Seed database from document repository |

---

## 6. Database Architecture

### 6.1 Schema Overview

PostgreSQL via Supabase. All tables use **UUID primary keys** and automatic `updated_at` triggers.

```
projects (central entity)
├── planning_phase_steps    UNIQUE(project_id, step_number)
├── milestones              status: pending|in_progress|completed|delayed
│   └── tasks               linked to milestones, priority + status
├── budget_items            estimated vs actual cost tracking
├── contacts                type enum, track_emails flag
│   └── communications      logged interactions
├── vendors                 company-level tracking, email_domains (JSONB)
│   └── bids                full bid lifecycle with AI extraction
│       └── bid_attachments
│       └── bid_comparisons
├── documents               file references to Supabase Storage
├── emails                  UNIQUE(message_id) for Gmail dedup
│   └── email_attachments
├── project_status          UNIQUE(project_id, date) daily snapshots
├── permits                 regulatory tracking
├── selections              product/material tracking
├── site_information        survey, soil, zoning (JSONB heavy)
├── building_specifications foundation, structural, mechanical (JSONB heavy)
└── notification_queue      push/email/sms queue
```

**email_accounts** (standalone): OAuth credentials with sync settings.

### 6.2 Key JSONB Fields

| Table.Column | Content |
|-------------|---------|
| `milestones.dependencies` | Array of dependent milestone IDs |
| `emails.recipients` | Array of recipient objects |
| `emails.action_items` | AI-extracted action items |
| `project_status.hot_topics` | `[{priority, text}]` |
| `project_status.action_items` | `[{status, text, action_type?, action_context?}]` |
| `project_status.recent_decisions` | `[{decision, impact}]` |
| `email_accounts.oauth_tokens` | `{access_token, refresh_token, expiry_date, ...}` |
| `bids.line_items` | `[{item, quantity?, unit_price?, total, specs?}]` |
| `bids.inclusions` / `exclusions` | String arrays |
| `vendors.email_domains` | String arrays for auto-tracking |
| `site_information.*` | Heavy JSONB for survey, soil, utilities, zoning data |
| `building_specifications.*` | Heavy JSONB for structural, mechanical, interior specs |

### 6.3 Database Functions

| Function | Purpose |
|----------|---------|
| `update_updated_at_column()` | Trigger on all tables to auto-set `updated_at` |
| `finalize_bid_to_budget()` | Convert selected bid → approved budget_item |
| `reject_competing_bids()` | Auto-reject other bids when one is selected |

### 6.4 Row-Level Security

RLS is enabled on all tables with a **generic policy**:
```sql
CREATE POLICY "Users can view {table}" FOR ALL USING (auth.uid() IS NOT NULL);
```
This permits any authenticated user full access. There are no project-scoped or role-based policies.

### 6.5 Indexes

Performance indexes exist on all foreign keys (`project_id`), query fields (`sender_email`, `received_date`, `due_date`), status enums, and GIN indexes on JSONB columns for `site_information` and `building_specifications`.

---

## 7. Integration Architecture

### 7.1 Gmail Integration Flow

```
User clicks "Connect Gmail"
  → GET /api/gmail/auth → returns OAuth URL
  → User authorizes in Google → callback to /api/auth/google/callback
  → Exchange code for tokens → store in DB (email_accounts) + httpOnly cookies
  → Redirect to /?success=connected

Email Fetch (on-demand):
  GET /api/emails/fetch
  → Check cookies for tokens → refresh if expired
  → db.buildEmailSearchQuery() → Gmail API search
  → For each email: summarizeIndividualEmail() via Claude
  → Store in emails table (dedup by message_id)
  → If analyze=true: analyzeProjectEmails() for cross-email insights
  → Return structured response

Email Fetch (automated):
  Vercel Cron → POST /api/cron/sync-emails (daily 8 AM UTC)
  → Get tokens from DB → Gmail API → AI summaries → store → update project status
```

### 7.2 AI Status Report Flow

```
User clicks "Generate AI Report" on /project-status
  → POST /api/project-status/generate
  → getProject() → same project as the page
  → updateProjectStatus(projectId):
      1. Fetch project details, planning steps, budget
      2. db.getLatestProjectStatus(projectId) → previous report
      3. db.getRecentEmails(14) → all emails (no project filter)
      4. Normalize legacy string fields in previous status
      5. generateProjectStatusSnapshot(emails, context, previousStatus)
         → Claude builds iterative report:
           - Keeps/removes/adds hot topics
           - Updates/adds/keeps action items
           - Preserves + adds decisions
           - Rewrites narrative summary
      6. db.upsertProjectStatus() → keyed on (project_id, today's date)
  → Page re-fetches → renders updated data
```

### 7.3 Bid Extraction Flow

```
Email with bid content arrives
  → POST /api/bids/extract-from-email
  → extractBidFromEmail() via Claude (temp=0.1, max_tokens=4096)
     → Structured extraction: vendor, category, line items, scope, terms
     → ai_confidence score (0.0-1.0)
  → Match vendor in database or create
  → Insert bid(s) with ai_extracted=true, needs_review=true
  → User reviews in /bids page
  → PATCH /api/bids/manage (action: select) → auto-reject competitors
  → POST /api/bids/manage (action: finalize) → create budget_item
```

---

## 8. Type System

All shared types live in `src/types/index.ts`. Key interfaces:

| Interface | Purpose |
|-----------|---------|
| `Email` | Lightweight shape for AI (subject, from, body, date) |
| `EmailRecord` | Full DB record with 20+ fields |
| `EmailAccountRecord` | OAuth account with tokens |
| `ProjectStatusData` | Complete status snapshot for UI rendering |
| `DashboardData` | Summary metrics for home dashboard |
| `Bid` | Full bid record with AI extraction fields |
| `ExtractedBid` | AI output shape for bid extraction |
| `Selection` | Product selection with status lifecycle |
| `DraftEmail` | AI-generated email draft |
| `ProjectInsights` | Cross-email AI analysis output |
| `EmailInsights` | Single-email AI analysis output |
| `ActionItem`, `Question`, `KeyDataPoint` | Structured AI extraction types |
| `ApiResponse<T>`, `ApiErrorResponse` | Standard API envelope types |

Types are **not auto-generated from Supabase** - they are manually maintained.

---

## 9. Environment Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public key (RLS enforced) |
| `SUPABASE_SERVICE_KEY` | No | Admin operations (seeding) |
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `GOOGLE_CLIENT_ID` | Yes | Gmail OAuth client |
| `GOOGLE_CLIENT_SECRET` | Yes | Gmail OAuth secret |
| `GOOGLE_REDIRECT_URI` | Yes | OAuth callback URL |
| `GMAIL_USER_EMAIL` | Yes | Target Gmail account |
| `CRON_SECRET` | Yes | Bearer token for cron/admin routes |
| `NEXT_PUBLIC_APP_URL` | No | App base URL |
| `NEXT_PUBLIC_PROJECT_NAME` | No | Default project name |
| `NEXT_PUBLIC_PROJECT_ADDRESS` | No | Default project address |

---

## 10. Deployment

- **Platform**: Vercel
- **Build**: `next build` (static generation + server-side rendering)
- **Cron**: Single job at 8 AM UTC daily (`/api/cron/sync-emails`)
- **Database**: Supabase hosted PostgreSQL
- **Secrets**: Vercel environment variables dashboard
- **Domain**: Default Vercel URL (no custom domain documented)

---

## 11. Key Architectural Decisions & Their Implications

### Single-User Assumption
The entire app assumes one project and one user. `getProject()` returns the first row. No multi-tenancy, no user-project associations, no access control beyond "is authenticated."

### Client-Side Supabase with RLS
All database access (even from server components) uses the **public anon key**. RLS policies check `auth.uid() IS NOT NULL` but don't scope to specific projects or users. Security relies on the app being single-user.

### Cookie-Based OAuth Token Passing
Gmail tokens are passed to API routes via httpOnly cookies. The `email_accounts` table also stores tokens for the cron job. This creates two token storage locations that can drift.

### All AI on Claude Sonnet 4.5
Every AI call (email summaries, bid extraction, status reports, draft generation, document analysis) uses the same model. No cost optimization with cheaper models for simpler tasks.

### JSONB for Flexible Schema
Hot topics, action items, decisions, bid line items, site data, and building specs all use JSONB columns. This provides flexibility but means no referential integrity or type enforcement at the database level. Legacy format normalization (string vs. array) is handled in application code.

### No Authentication Layer
Despite `next-auth` being a dependency, there is no sign-in page or session management. Supabase RLS with the anon key provides the only gate.

### Pull-Based Email Sync
Emails are fetched via polling (cron job + on-demand), not push webhooks. This is simpler but means there's up to 24-hour latency for automated sync.

---

## 12. Data Flow Summary

```
Gmail ──(OAuth)──→ /api/emails/fetch ──→ AI Summary ──→ emails table
                                                            │
                                                            ▼
Vercel Cron ──→ /api/cron/sync-emails ──→ AI Summary ──→ emails table
                                                            │
                                                            ▼
User clicks "Generate" ──→ /api/project-status/generate     │
  │                                                         │
  ▼                                                         │
getLatestProjectStatus() ──→ previous report                │
getRecentEmails(14) ◄──────────────────────────────────────┘
  │
  ▼
generateProjectStatusSnapshot(emails, context, previousStatus)
  │  (Claude Sonnet 4.5, temp=0.2, 3000 tokens)
  ▼
upsertProjectStatus() ──→ project_status table
  │
  ▼
/project-status page ──→ 4 Suspense streams ──→ UI

Email bids ──→ /api/bids/extract-from-email ──→ AI extraction ──→ bids table
  │                                                                    │
  ▼                                                                    ▼
/bids page ──→ BidReviewCard ──→ select/reject ──→ finalize ──→ budget_items
```
