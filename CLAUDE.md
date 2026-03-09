# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm test
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **External APIs**: Gmail API, Anthropic Claude API
- **Deployment**: Vercel

## High-Level Architecture

### Application Structure

This is a **Next.js App Router** application managing home construction projects with email integration and AI-powered insights. The architecture follows these patterns:

1. **Server Components by Default**: Most pages are server components in `src/app/`
2. **API Routes**: RESTful endpoints in `src/app/api/` for external integrations
3. **Client Components**: Interactive UI in `src/components/` (marked with 'use client')
4. **Shared Libraries**: Reusable services in `src/lib/`

### Core Domain Model

The application models the **UBuildIt construction process** with two main phases:

- **Planning Phase**: 6-step process tracked via `planning_phase_steps` table
- **Construction Phase**: Milestone-based tracking with tasks, permits, and budget management

### Key Integration Patterns

#### Gmail Integration (`src/lib/gmail.ts`, `src/lib/gmail-auth.ts`)
- **OAuth2 Flow**: Uses Google OAuth with offline access for token refresh
- **Token Management**: Centralized in `gmail-auth.ts` — tokens stored encrypted (AES-256-GCM) in `email_accounts.oauth_tokens` (JSONB), with automatic refresh and legacy plaintext migration
- **Email Sync**: Queries Gmail API with custom filters (e.g., tracking vendor communications)
- **Parsing**: Recursive MIME traversal extracts plain text from multipart messages, base64-decodes payloads

#### Anthropic Claude Integration (`src/lib/ai-clients.ts`, `src/lib/ai-summarization.ts`, `src/lib/claude-email-agent.ts`)
- **Model**: Claude Sonnet 4.6 (`claude-sonnet-4-6`) for all AI tasks (email summaries, triage, status reports, bid extraction, cross-email insights)
- **Unified Status System**: `project_status` table is single source of truth — all pages read from it, `generateProjectStatusSnapshot()` is the sole AI status generator
- **Cascading Updates**: AI-derived action items auto-sync to `tasks` table; status updates triggered by email fetch, cron sync, and manual generation
- **Stored Results**: AI summaries cached in `emails.ai_summary` and `project_status.ai_summary`

#### Supabase Client Pattern (`src/lib/supabase.ts`)
- Single shared client instance using `@supabase/supabase-js`
- Uses public anon key from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Row-Level Security (RLS) enabled on all tables - requires authenticated user

## Database Architecture

### Schema Patterns

The database uses **UUID primary keys** throughout with automatic `updated_at` triggers. Key relationships:

```
projects (main entity)
├── planning_phase_steps (1:many) - 6 steps of planning phase
├── milestones (1:many) - construction milestones
├── budget_items (1:many) - cost tracking line items
├── contacts (1:many) - vendors, consultants, contractors
├── documents (1:many) - file storage references
├── tasks (1:many) - action items linked to milestones
├── permits (1:many) - regulatory approvals
├── emails (1:many) - synced communications
├── vendors (1:many) - company-level vendor tracking
├── communications (1:many) - logged interactions
└── project_status (1:many) - daily snapshots with AI summaries
```

### Email Data Model

Emails have a **normalized structure**:
- `emails` table: Core email data with `message_id` from Gmail for deduplication
- `email_attachments` table: Separate table for file references
- `email_accounts` table: OAuth credentials with sync settings
- **Threading**: Preserved via `thread_id` from Gmail API

### Important JSONB Fields

Several tables use JSONB for flexible data:
- `milestones.dependencies`: Array of dependent milestone IDs
- `emails.recipients`, `emails.action_items`: Structured email metadata
- `project_status.hot_topics`, `project_status.action_items`, `project_status.recent_decisions`: Daily status data
- `email_accounts.oauth_tokens`: Encrypted OAuth2 tokens (encrypt in application layer)

### Indexes

Performance-critical indexes exist on:
- Foreign keys (`project_id` on all child tables)
- Query fields (`emails.sender_email`, `emails.received_date`, `tasks.due_date`)
- Status enums (`milestones.status`, `tasks.status`)

## API Routes Structure

Next.js API routes in `src/app/api/`:

- **`/api/auth/google/callback`**: OAuth2 callback handler for Gmail
- **`/api/gmail/auth`**: Initiates Gmail OAuth flow
- **`/api/emails/fetch`**: Fetches emails from Gmail and saves to Supabase
- **`/api/upload`**: Handles document uploads to Supabase Storage
- **`/api/cron/sync-emails`**: Automated email sync endpoint (for Vercel Cron)

### API Route Patterns

All API routes:
1. Validate authentication/authorization first
2. Use try-catch for error handling
3. Return JSON responses with consistent structure
4. Log errors for debugging

## Environment Variables

Required in `.env.local` (see existing `.env.local` for full list):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Gmail OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Anthropic Claude
ANTHROPIC_API_KEY=

# Token Encryption
TOKEN_ENCRYPTION_KEY=

# Optional: Vercel-specific
VERCEL_URL=
```

**Security Note**: OAuth tokens from Gmail are stored in `email_accounts.oauth_tokens` encrypted with AES-256-GCM via `src/lib/token-encryption.ts`. Legacy unencrypted tokens are automatically migrated on first access.

## Key Architectural Decisions

### 1. Next.js App Router vs Pages Router
Using **App Router** for:
- React Server Components (reduced client JS)
- Nested layouts
- Streaming and Suspense support

### 2. Supabase Client-Side vs Server-Side
Currently using **client-side Supabase client** (`createClient` with anon key) relying on RLS. For sensitive operations, consider:
- Server-side client with service role key
- Row-level policies based on user association to projects

### 3. Email Sync Strategy
**Pull-based sync** via API routes rather than push webhooks:
- Simpler to implement and debug
- Controlled rate limiting
- Uses Vercel Cron for periodic syncing (`/api/cron/sync-emails`)

### 4. State Management
No global state library. Relies on:
- **React `cache()`** for server-side request deduplication (e.g., `getProject()`)
- **Server Components** for initial data fetching
- **React hooks** (`useState`, `useEffect`) for local component state
- **API routes** as mutation endpoints called via `fetch()`

### 5. Type Safety
All shared types are centralized in `src/types/index.ts`. Types are:
- Manually maintained (not auto-generated from Supabase)
- Includes interfaces for Email, EmailRecord, Bid, ProjectStatusData, DashboardData, API envelopes, and more
- Co-located types used for component-specific concerns

## Important Patterns

### 1. OAuth Token Refresh
Gmail OAuth tokens expire. The centralized `getAuthenticatedGmailService()` in `src/lib/gmail-auth.ts` handles the full lifecycle:
- Loads encrypted tokens from `email_accounts.oauth_tokens` in the database
- Decrypts with AES-256-GCM via `token-encryption.ts`
- Checks token expiry (5-minute buffer) and refreshes via Google OAuth if needed
- Re-encrypts and persists updated tokens back to the database
- Transparently migrates legacy unencrypted tokens on first access

### 2. Email Deduplication
Use `emails.message_id` (from Gmail) as unique identifier:
```sql
INSERT INTO emails (...)
ON CONFLICT (message_id) DO UPDATE SET ...
```

### 3. AI Cost Management
Anthropic Claude API cost optimization strategies:
- **Single model**: Claude Sonnet 4.6 (`claude-sonnet-4-6`) for all AI tasks — email summaries, triage, status reports, bid extraction, draft generation
- Only summarize unread or recent emails
- Cache summaries in database (`emails.ai_summary`, `project_status.ai_summary`)

### 4. Document Storage
Documents use Supabase Storage:
- URLs stored in `documents.file_url`
- Organize by project: `{project_id}/{document_id}/filename`
- Set up storage policies to match RLS

## Common Development Tasks

### Adding a New Page
1. Create route in `src/app/{route}/page.tsx`
2. Use existing layout (`src/app/layout.tsx`)
3. Access params via Next.js 15 App Router props
4. Fetch data directly in Server Component or via API route

### Adding API Integration
1. Create service class in `src/lib/{service-name}.ts`
2. Add environment variables to `.env.local`
3. Create API route in `src/app/api/{endpoint}/route.ts`
4. Handle authentication/errors consistently

### Modifying Database Schema
1. Update `supabase-schema.sql` with changes
2. Run migration via Supabase Dashboard or CLI
3. Update TypeScript types if using generated types
4. Verify RLS policies cover new tables/columns

## Known Issues / Technical Debt

Based on docs in `/docs` directory:

1. **Gmail OAuth 403 Errors**: Check `docs/fix-google-oauth-403.md` and `docs/GMAIL_403_FIX_SUMMARY.md` for resolution steps related to OAuth consent screen configuration

2. **Email Sync Automation**: Reference `docs/automated-email-sync.md` for Vercel Cron setup and webhook configuration

3. ~~**Token Encryption**~~: **Resolved** — OAuth tokens are now encrypted with AES-256-GCM via `src/lib/token-encryption.ts`

4. ~~**Type Generation**~~: **Resolved** — Types are centralized in `src/types/index.ts` (manually maintained)

## Project Context

**UBuildIt Williamson Team** contact info (for test data/communications):
- Office: 212 W 10th St, Georgetown TX 78626
- Phone: (512) 828-3187
- Email: Williamson.tx@ubuildit.com

This is a **private/proprietary project** for managing personal home construction with UBuildIt process.

## 📧 Gmail MCP Server (Direct Email Access)

Claude Code has access to a Gmail MCP server (`@sowonai/mcp-gmail`) that provides direct email capabilities. This is configured in `.claude/settings.local.json`.

### Available MCP Tools

| Tool | What It Does |
|------|-------------|
| `gmail_listMessages` | List recent emails (default: 10 most recent) |
| `gmail_searchMessages` | Search with Gmail query syntax (e.g., `from:vendor@email.com`, `subject:bid`, `is:unread`) |
| `gmail_readMessage` | Read full content of a specific email by message ID |
| `gmail_sendMessage` | Compose and send an email (TO, SUBJECT, BODY) |

### ⚠️ Email Sending Protocol — MANDATORY

**NEVER send emails without explicit owner approval.**

When asked to draft or write an email:
1. **Draft first, send never (unless told to).** Show the full email content for the owner to review before sending.
2. **If the owner explicitly says "send it"**, then use `gmail_sendMessage` — but **always use HTML formatting** in the `body` parameter.

### HTML Formatting Rules for Gmail
Gmail renders HTML. Plain text with `\n` will display as a wall of text. Always use:
- `<p>` tags for paragraphs (NOT bare text)
- `<br>` for line breaks within a block
- `<b>` or `<strong>` for bold text
- `<ul>` and `<li>` for bullet lists
- `<h3>` for section headers

**Example body format:**
```html
<p>Hi Randy,</p>
<p>Thanks for taking the time to speak with me. Here's a summary:</p>
<p><b>Project Overview</b></p>
<ul>
  <li><b>Address:</b> 708 Purple Salvia Cove, Liberty Hill, TX</li>
  <li><b>Style:</b> French Country Estate</li>
  <li><b>Total SF:</b> ~7,526 sq ft</li>
</ul>
<p>Best regards,<br>Daniel Case</p>
```

### Attachments
The Gmail MCP does **NOT** support attachments. When files need to be attached:
- Note which files should be attached (with full paths)
- Remind the owner to attach them manually
- Suggest sharing via Dropbox link if files are large

### Note on OAuth Credentials
This MCP server uses a separate Google Cloud OAuth client (`52695817098`) from the app's built-in Gmail integration (`217172068796` in `.env.local`). Both access the same Gmail account (`danielcase.info@gmail.com`). Setup details are in `GMAIL_MCP_SETUP_FOR_CLAUDE_CODE.md`.

## 🔧 JobTread MCP Server (Construction Project Data)

Claude Code has access to a JobTread MCP server that provides direct read/write access to the Case Home project in JobTread (the WCG building consultant's project management platform). Configured in `.claude/settings.local.json`.

### Available MCP Tools

| Tool | What It Does |
|------|-------------|
| `jobtread_getJob` | Get Case Home project details (status, description, custom fields) |
| `jobtread_getCostItems` | Get budget/cost items with cost codes and pricing |
| `jobtread_getTasks` | Get tasks/schedule from the project |
| `jobtread_getDailyLogs` | Get daily log entries |
| `jobtread_getComments` | Get comments on the project |
| `jobtread_getFiles` | Get files (photos, documents) |
| `jobtread_createComment` | Add a comment to the project |
| `jobtread_createDailyLog` | Add a daily log entry (date + notes) |
| `jobtread_createTask` | Create a task (name, description, dates) |

### JobTread API Details
- **API**: Proprietary "Pave" query language at `POST https://api.jobtread.com/pave`
- **Auth**: Grant key in query body (scoped to the Case Home project)
- **Org**: Texas Home Consulting LLC (`22P8e7iPShMR`)
- **Job**: Case Home #23 (`22PEVyJVCikd`)
- **Max page size**: 100 items per query
- **Cost values**: Stored in cents (divide by 100 for dollars)

### JobTread Integration Architecture

#### Source Files
- `src/lib/jobtread-client.ts` — Low-level Pave API HTTP client (rate limiting, pagination, error handling)
- `src/lib/jobtread.ts` — High-level typed service with domain methods (getJob, getCostItems, getTasks, etc.)
- `src/lib/jobtread-sync.ts` — Sync service: maps JobTread data to Supabase tables
- `src/app/api/jobtread/sync/route.ts` — Manual sync endpoint (POST)
- `src/app/api/cron/sync-jobtread/route.ts` — Cron sync (runs daily at 7:55 AM, before email sync)
- `mcp-servers/jobtread/` — MCP server (9 tools wrapping Pave queries)

#### Data Sync Mapping
| JobTread Entity | Supabase Table | Key Fields |
|---|---|---|
| `costItems` | `budget_items` | `costCode.name` → `category`, `cost/100` → `estimated_cost`, `source='jobtread'` |
| `tasks` | `tasks` | `name` → `title`, `endDate` → `due_date`, `completed` → `status` |
| `dailyLogs` | `communications` | `notes` → `summary`, `type='daily_log'` |
| `comments` | `communications` | `message` → `summary`, `type='jobtread_comment'` |
| `files` | `documents` | `name` → `name`, `url` → `file_url`, `folder` → `category` |

All upserts use `ON CONFLICT (jobtread_id) DO UPDATE` for idempotent re-sync. Records with `source='jobtread'` are distinguished from manual entries. The AI summarization pipeline automatically picks up synced data via `getFullProjectContext()`.

#### Database Columns Added
- `jobtread_id VARCHAR(50) UNIQUE` on: `budget_items`, `tasks`, `documents`, `vendors`, `contacts`, `communications`
- `source VARCHAR(20) DEFAULT 'manual'` on: `budget_items`
- `jobtread_sync_state` table for tracking per-entity sync timestamps
