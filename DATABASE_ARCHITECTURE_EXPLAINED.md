# Database Architecture & Data Population - Complete Guide

**Project:** UBuildIt Manager - 708 Purple Salvia Cove
**Last Updated:** February 11, 2026

---

## Table of Contents

1. [Database Schema Overview](#database-schema-overview)
2. [Table Details](#table-details)
3. [Relationships](#relationships)
4. [Data Population Methods](#data-population-methods)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Examples](#examples)

---

## Database Schema Overview

### Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: CORE PROJECT                     │
├─────────────────────────────────────────────────────────────┤
│  projects (1 record)                                         │
│     ├─→ planning_phase_steps (6 records)                    │
│     └─→ project_status (daily snapshots)                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  LAYER 2: PEOPLE & VENDORS                   │
├─────────────────────────────────────────────────────────────┤
│  contacts (24+ individual people)                            │
│  vendors (12+ companies)                                     │
│  communications (logged interactions)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                LAYER 3: BUDGET & FINANCIAL                   │
├─────────────────────────────────────────────────────────────┤
│  budget_items (finalized expenses)                           │
│     ↑                                                        │
│  bids (options before finalization)                          │
│     ├─→ bid_comparisons (evaluations)                       │
│     └─→ bid_attachments (files)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 LAYER 4: TASKS & TIMELINE                    │
├─────────────────────────────────────────────────────────────┤
│  milestones (major phases)                                   │
│     └─→ tasks (action items)                                │
│  permits (regulatory)                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            LAYER 5: DOCUMENTS & COMMUNICATION                │
├─────────────────────────────────────────────────────────────┤
│  email_accounts (Gmail OAuth)                                │
│     └─→ emails (synced messages)                            │
│         └─→ email_attachments (files)                       │
│  documents (plans, contracts, receipts)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Table Details

### 1. projects

**Purpose:** Main project record - the "root" of everything

**Key Columns:**
```sql
id                  UUID PRIMARY KEY (auto-generated)
name                VARCHAR(255)        -- "708 Purple Salvia Cove Custom Home"
address             TEXT                -- "708 Purple Salvia Cove, Liberty Hill, TX 78642"
lot_info            TEXT                -- "Mesa Vista Ranch Phase 2, Lot 67, Block 1"
square_footage      INTEGER             -- 7526
style               VARCHAR(100)        -- "French Country Estate"
phase               VARCHAR(20)         -- 'planning' | 'construction' | 'completed'
current_step        INTEGER             -- 4 (which planning step you're on)
start_date          DATE                -- '2025-06-02'
target_completion   DATE                -- NULL (TBD)
budget_total        DECIMAL(12, 2)      -- 1200000.00
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**Population:**
- **Import script** creates initial record
- **Dashboard UI** updates phase/step as you progress
- **You** manually update target_completion when known

**Example Record:**
```json
{
  "id": "abc-123-def",
  "name": "708 Purple Salvia Cove Custom Home",
  "address": "708 Purple Salvia Cove, Liberty Hill, TX 78642",
  "square_footage": 7526,
  "phase": "planning",
  "current_step": 4,
  "budget_total": 1200000.00
}
```

---

### 2. planning_phase_steps

**Purpose:** Track progress through UBuildIt's 6-step planning process

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)  -- Links to your project
step_number         INTEGER                       -- 1-6
step_name           VARCHAR(100)                  -- "Dream Home & Site Selection"
status              VARCHAR(20)                   -- 'not_started' | 'in_progress' | 'completed'
start_date          DATE                          -- When you began this step
completion_date     DATE                          -- When you finished
notes               TEXT                          -- Details about this step
```

**Population:**
- **Import script** creates all 6 steps at once
- **Dashboard UI** updates status/dates as you complete each step
- **You** add notes about what happened

**The 6 Steps:**
1. Dream Home & Site Selection
2. Site Review & Evaluation
3. Plan Development
4. Cost Review & Specifications ← *You're here*
5. Financing
6. Pre-Construction Preparation

**Example Records:**
```json
[
  {
    "step_number": 1,
    "step_name": "Dream Home & Site Selection",
    "status": "completed",
    "start_date": "2025-03-01",
    "completion_date": "2025-06-02",
    "notes": "Land purchased June 2, 2025. $221,912 total."
  },
  {
    "step_number": 4,
    "step_name": "Cost Review & Specifications",
    "status": "in_progress",
    "start_date": "2025-10-01",
    "completion_date": null,
    "notes": "Flooring selected. Soliciting bids for windows, septic, well."
  }
]
```

---

### 3. contacts

**Purpose:** Individual people involved in the project

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
type                VARCHAR(50)         -- 'consultant' | 'vendor' | 'contractor' | 'architect' | 'engineer'
company             VARCHAR(255)        -- "Kipp Flores Architects LLC"
name                VARCHAR(255)        -- "Kipp Flores"
email               VARCHAR(255)        -- "kipp@kippflores.com"
phone               VARCHAR(50)         -- "(512) 555-1234"
role                VARCHAR(100)        -- "Architect"
is_ubuildit_team    BOOLEAN             -- true for UBuildIt staff
track_emails        BOOLEAN             -- true = sync emails from this person
notes               TEXT
```

**Population:**
- **Import script** creates initial 24 contacts from VENDOR_DIRECTORY.md
- **API route** (`/api/contacts`) adds new contacts
- **Email sync** can auto-create contacts from unknown senders
- **You** add contacts manually via UI

**Example Records:**
```json
[
  {
    "name": "Aaron Mischenko",
    "company": "UBuildIt - Williamson",
    "email": "aaronm.tx@ubuildit.com",
    "phone": "(512) 828-3187",
    "type": "consultant",
    "role": "Planning & Operations Manager",
    "is_ubuildit_team": true,
    "track_emails": true
  },
  {
    "name": "Jeff King",
    "company": "Synergetic Engineering / 3DAYDESIGN.COM",
    "email": "projects@3daydesign.com",
    "type": "engineer",
    "role": "Foundation Engineer",
    "track_emails": true
  }
]
```

---

### 4. vendors

**Purpose:** Companies (not individuals) you work with

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
company_name        VARCHAR(255)        -- "Kipp Flores Architects LLC"
category            VARCHAR(100)        -- "Architecture" | "Engineering" | "Flooring"
status              VARCHAR(20)         -- 'potential' | 'approved' | 'active' | 'completed'
primary_contact     UUID REFERENCES contacts(id)  -- Link to main contact person
email_domains       JSONB               -- ["@kippflores.com"]
auto_track_emails   BOOLEAN             -- true = auto-sync emails from this domain
notes               TEXT
added_date          DATE
```

**Population:**
- **Import script** creates 12 initial vendors
- **Bid extraction** can create vendors if new company detected
- **You** add vendors manually
- **Vendor status changes** as work progresses (potential → active → completed)

**Example Records:**
```json
[
  {
    "company_name": "Kipp Flores Architects LLC",
    "category": "Architecture",
    "status": "completed",
    "email_domains": ["@kippflores.com"],
    "auto_track_emails": true,
    "notes": "Plans complete Dec 17, 2025. KFA-0465."
  },
  {
    "company_name": "Prestige Steel",
    "category": "Windows & Doors",
    "status": "potential",
    "auto_track_emails": true,
    "notes": "Recommended: Thermally Broken $68,446. 8-15 week lead time."
  }
]
```

---

### 5. budget_items

**Purpose:** FINALIZED, approved expenses - your actual budget

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
category            VARCHAR(100)        -- "Soft Costs" | "Foundation" | "Finishes"
subcategory         VARCHAR(100)        -- "Architectural Services" | "Flooring"
description         TEXT                -- "Kipp Flores Architects - Final Design"
estimated_cost      DECIMAL(12, 2)      -- 4000.00 (original estimate)
actual_cost         DECIMAL(12, 2)      -- 4000.00 (what you actually paid)
vendor_id           UUID REFERENCES vendors(id)
status              VARCHAR(20)         -- 'estimated' | 'bid_received' | 'approved' | 'paid'
approval_date       DATE                -- When you approved spending this
payment_date        DATE                -- When you paid
notes               TEXT
```

**Population:**
- **Import script** creates initial budget items ($289K paid)
- **Bid finalization** converts selected bids to budget_items
- **Manual entry** via budget UI
- **Invoice processing** updates actual_cost and payment_date

**Workflow:**
```
estimated → bid_received → approved → paid
```

**Example Records:**
```json
[
  {
    "category": "Soft Costs",
    "subcategory": "Architectural Services",
    "description": "Kipp Flores Architects LLC - Final Design",
    "estimated_cost": 4000.00,
    "actual_cost": 4000.00,
    "status": "paid",
    "approval_date": "2025-08-01",
    "payment_date": "2025-10-01",
    "notes": "Plans dated Dec 17, 2025"
  },
  {
    "category": "Envelope",
    "subcategory": "Windows & Doors",
    "description": "Prestige Steel - Thermally Broken - Finalized from bid",
    "estimated_cost": 68446.00,
    "actual_cost": null,
    "status": "approved",
    "approval_date": "2026-02-15",
    "payment_date": null,
    "notes": "Finalized from bid #xyz. Lead time 8-12 weeks."
  }
]
```

---

### 6. bids (NEW!)

**Purpose:** Vendor quotes BEFORE you select them - your "options"

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
vendor_id           UUID REFERENCES vendors(id)  -- NULL until vendor identified
vendor_name         VARCHAR(255)        -- "Prestige Steel"
vendor_email        VARCHAR(255)
category            VARCHAR(100)        -- "Windows & Doors"
description         TEXT                -- "Thermally broken steel windows & doors"
total_amount        DECIMAL(12, 2)      -- 68446.00
line_items          JSONB               -- Detailed breakdown (see below)
scope_of_work       TEXT                -- What they'll do
inclusions          JSONB               -- Array: ["Installation", "3-yr warranty"]
exclusions          JSONB               -- Array: ["Structural mods", "Paint"]
payment_terms       TEXT                -- "50% deposit, 50% on completion"
warranty_terms      TEXT                -- "3-year workmanship, 10-year materials"
lead_time_weeks     INTEGER             -- 10
valid_until         DATE                -- '2026-03-15'
status              VARCHAR(20)         -- 'pending' | 'under_review' | 'selected' | 'rejected'
email_id            UUID REFERENCES emails(id)  -- Links to source email
ai_extracted        BOOLEAN             -- true if AI extracted (vs manual)
ai_confidence       DECIMAL(3, 2)       -- 0.95 (95% confidence)
needs_review        BOOLEAN             -- true if confidence < 85%
selection_notes     TEXT                -- Why you selected/rejected
pros                TEXT                -- Advantages
cons                TEXT                -- Disadvantages
```

**Population:**
- **AI extraction** from emails (automatic)
- **Manual entry** via bid submission form
- **Document upload** with AI parsing

**line_items Structure:**
```json
[
  {
    "item": "Living Room Steel Door (8' x 10')",
    "quantity": 1,
    "unit_price": 8500.00,
    "total": 8500.00,
    "specs": "Thermally broken, triple pane"
  },
  {
    "item": "Kitchen Steel Windows",
    "quantity": 6,
    "unit_price": 2800.00,
    "total": 16800.00,
    "specs": "Fixed + casement"
  }
]
```

**Example Record:**
```json
{
  "id": "bid-123",
  "vendor_name": "Prestige Steel",
  "category": "Windows & Doors",
  "total_amount": 68446.00,
  "line_items": [...],
  "inclusions": [
    "All hardware and installation",
    "3-year workmanship warranty",
    "10-year material warranty"
  ],
  "exclusions": [
    "Structural modifications",
    "Electrical work",
    "Paint/finish on walls"
  ],
  "payment_terms": "50% deposit to order, 50% on installation",
  "lead_time_weeks": 10,
  "valid_until": "2026-03-15",
  "status": "pending",
  "ai_extracted": true,
  "ai_confidence": 0.95,
  "needs_review": false
}
```

---

### 7. bid_comparisons

**Purpose:** Track when you compare multiple bids with AI analysis

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
category            VARCHAR(100)        -- "Windows & Doors"
bid_ids             UUID[]              -- Array: [bid1_id, bid2_id, bid3_id]
evaluation_criteria JSONB               -- AI analysis results
selected_bid_id     UUID REFERENCES bids(id)
selection_date      DATE
selection_rationale TEXT
```

**Population:**
- **Automatically** when you use Compare Bids API
- Stores AI analysis for future reference

**Example Record:**
```json
{
  "category": "Windows & Doors",
  "bid_ids": ["bid-123", "bid-456", "bid-789"],
  "evaluation_criteria": {
    "comparison": "Prestige Steel offers best balance...",
    "recommendation": "Select Prestige Thermally Broken",
    "pros_cons": [...]
  },
  "selected_bid_id": "bid-123",
  "selection_date": "2026-02-15",
  "selection_rationale": "Best value for thermal efficiency within budget"
}
```

---

### 8. milestones

**Purpose:** Major phases of construction

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
name                VARCHAR(255)        -- "Foundation Complete"
description         TEXT
target_date         DATE                -- '2026-07-01'
completed_date      DATE
status              VARCHAR(20)         -- 'pending' | 'in_progress' | 'completed' | 'delayed'
dependencies        JSONB               -- Array of milestone IDs that must finish first
```

**Population:**
- **Import script** creates 7 major milestones
- **You** update status/dates as work progresses
- **Dependencies** help track critical path

**Example Records:**
```json
[
  {
    "name": "Permits Approved",
    "description": "HOA + Building + Septic permits all approved",
    "target_date": "2026-05-15",
    "status": "pending",
    "dependencies": ["planning-complete-milestone-id"]
  },
  {
    "name": "Foundation Complete",
    "target_date": "2026-07-01",
    "status": "pending",
    "dependencies": ["permits-approved-milestone-id"]
  }
]
```

---

### 9. tasks

**Purpose:** Specific action items - the 148 construction tasks

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
milestone_id        UUID REFERENCES milestones(id)  -- Which milestone this belongs to
title               VARCHAR(255)        -- "Select Windows & Doors Contractor"
description         TEXT
due_date            DATE
priority            VARCHAR(20)         -- 'low' | 'medium' | 'high' | 'urgent'
assigned_to         UUID REFERENCES contacts(id)
status              VARCHAR(20)         -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
completed_date      DATE
```

**Population:**
- **Import script** creates 148 tasks from Construction_Tasks.csv
- **Dashboard UI** lets you add new tasks
- **You** update status as work progresses
- **Milestones** can auto-generate related tasks

**Example Records:**
```json
[
  {
    "title": "Select Windows & Doors Contractor",
    "description": "Review bids and select vendor. 8-15 week lead time - CRITICAL PATH",
    "due_date": "2026-02-20",
    "priority": "urgent",
    "status": "in_progress"
  },
  {
    "title": "Submit HOA Application",
    "description": "Submit architectural review application with plans, site plan, materials",
    "due_date": "2026-03-01",
    "priority": "high",
    "status": "pending"
  }
]
```

---

### 10. emails

**Purpose:** Synced Gmail messages from vendors/team

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
email_account_id    UUID REFERENCES email_accounts(id)
message_id          VARCHAR(255) UNIQUE -- Gmail message ID
thread_id           VARCHAR(255)        -- Gmail conversation thread
sender_email        VARCHAR(255)
sender_name         VARCHAR(255)
recipients          JSONB               -- Array of recipient emails
subject             TEXT
body_text           TEXT                -- Plain text version
body_html           TEXT                -- HTML version
received_date       TIMESTAMP
is_read             BOOLEAN
category            VARCHAR(50)         -- 'bid' | 'invoice' | 'general'
ai_summary          TEXT                -- Claude AI summary
action_items        JSONB               -- Extracted action items
```

**Population:**
- **Gmail sync** automatically fetches new emails
- **API route** (`/api/emails/fetch`) triggers sync
- **Cron job** (`/api/cron/sync-emails`) runs periodically
- **AI analysis** adds summary and action_items

**Search Query Used:**
```
from:(
  @ubuildit.com OR
  @kippflores.com OR
  @asiri-designs.com OR
  @fouraengineering.com
) OR subject:("708 Purple Salvia")
newer_than:7d
```

**Example Record:**
```json
{
  "message_id": "gmail-msg-123",
  "sender_email": "aaronm.tx@ubuildit.com",
  "sender_name": "Aaron Mischenko",
  "subject": "Quote from Prestige Steel - Windows & Doors",
  "body_text": "Hi Daniel, Attached is the quote...",
  "received_date": "2026-02-10T14:30:00Z",
  "category": "bid",
  "ai_summary": "Bid received from Prestige Steel for $68,446. 10-week lead time. Thermally broken option recommended.",
  "action_items": [
    {
      "item": "Review Prestige Steel bid and compare with alternatives",
      "priority": "high",
      "deadline": "2026-02-20"
    }
  ]
}
```

---

### 11. email_accounts

**Purpose:** Store Gmail OAuth credentials for email sync

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
user_id             UUID                -- Your user ID
email_address       VARCHAR(255) UNIQUE -- "danielcase@gmail.com"
provider            VARCHAR(50)         -- "gmail"
oauth_tokens        JSONB               -- Encrypted OAuth tokens
sync_enabled        BOOLEAN             -- true = auto-sync
last_sync           TIMESTAMP           -- Last successful sync
sync_frequency      INTEGER             -- 30 (minutes)
```

**Population:**
- **Gmail OAuth flow** creates record when you connect
- **User clicks** "Connect Gmail" in app
- **OAuth callback** stores tokens
- **Tokens refresh** automatically when expired

**⚠️ Security Note:** oauth_tokens should be encrypted before storage

**Example Record:**
```json
{
  "email_address": "danielcase@gmail.com",
  "provider": "gmail",
  "oauth_tokens": {
    "access_token": "ya29.xxx",
    "refresh_token": "1//xxx",
    "token_type": "Bearer",
    "expiry_date": 1707753600000
  },
  "sync_enabled": true,
  "sync_frequency": 30
}
```

---

### 12. documents

**Purpose:** Track important files (plans, contracts, receipts)

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
category            VARCHAR(100)        -- 'Plans' | 'Contracts' | 'Receipts' | 'Legal'
name                VARCHAR(255)        -- "Main House Plans - Dec 17, 2025"
description         TEXT
file_url            TEXT                -- URL to file in Supabase Storage or Dropbox
file_size           INTEGER
file_type           VARCHAR(50)         -- "application/pdf"
version             INTEGER             -- 1, 2, 3 (for plan revisions)
tags                JSONB               -- ["architectural-plans", "final"]
upload_date         TIMESTAMP
```

**Population:**
- **Import script** catalogs key documents
- **File upload** via UI (`/api/upload`)
- **Email attachments** can auto-create document records
- **You** add document metadata manually

**Example Records:**
```json
[
  {
    "category": "Plans",
    "name": "Main House Plans - Dec 17, 2025",
    "description": "Final architectural plans for main residence",
    "file_url": "Dropbox/.../Case Residence - 708 Purple Salvia Cove 12-17-25.pdf",
    "file_type": "application/pdf",
    "version": 4,
    "tags": ["architectural-plans", "main-house", "final"]
  },
  {
    "category": "Contracts",
    "name": "Kristynik Flooring Contract",
    "file_url": "Dropbox/.../Est_21646R_from_Kristynik.pdf",
    "tags": ["contract", "flooring"]
  }
]
```

---

### 13. project_status

**Purpose:** Daily snapshots of project state (like a logbook)

**Key Columns:**
```sql
id                  UUID PRIMARY KEY
project_id          UUID REFERENCES projects(id)
date                DATE UNIQUE         -- '2026-02-11'
phase               VARCHAR(20)         -- 'planning'
current_step        INTEGER             -- 4
progress_percentage INTEGER             -- 15%
hot_topics          JSONB               -- Array of current issues
action_items        JSONB               -- Array of TODOs
recent_decisions    JSONB               -- Array of decisions made
budget_status       VARCHAR(50)         -- "On Track"
budget_used         DECIMAL(12, 2)      -- 289195.60
ai_summary          TEXT                -- AI-generated status summary
```

**Population:**
- **Import script** creates initial snapshot
- **Daily cron job** creates new snapshot each day
- **AI analysis** of emails generates ai_summary
- **Dashboard** shows latest snapshot

**hot_topics Structure:**
```json
[
  "Civil engineering grading plan under review",
  "Windows/Doors decision urgent - 8-15 week lead time",
  "Septic contractor selection needed"
]
```

**action_items Structure:**
```json
[
  {
    "item": "Select and order windows/doors",
    "priority": "critical",
    "owner": "Daniel Case",
    "due": "2026-02-20"
  }
]
```

**recent_decisions Structure:**
```json
[
  {
    "date": "2026-01-14",
    "decision": "Contracted Four A Engineering for civil ($5,275)",
    "impact": "Critical path - enables permit submission"
  }
]
```

---

## Relationships

### Foreign Key Map

```
projects (root)
    │
    ├─→ planning_phase_steps (project_id)
    ├─→ project_status (project_id)
    ├─→ contacts (project_id)
    ├─→ vendors (project_id)
    │       ↑
    │       └─ contacts.id (vendors.primary_contact)
    ├─→ budget_items (project_id)
    │       ↑
    │       └─ vendors.id (budget_items.vendor_id)
    ├─→ bids (project_id)
    │       ├─→ bid_comparisons (bid_ids[])
    │       ├─→ bid_attachments (bid_id)
    │       ├─→ vendors.id (bids.vendor_id)
    │       └─→ emails.id (bids.email_id)
    ├─→ milestones (project_id)
    │       └─→ tasks (milestone_id)
    ├─→ tasks (project_id)
    │       └─→ contacts.id (tasks.assigned_to)
    ├─→ permits (project_id)
    ├─→ documents (project_id)
    ├─→ communications (project_id)
    │       └─→ contacts.id (communications.contact_id)
    └─→ emails (project_id)
            ├─→ email_accounts.id (emails.email_account_id)
            └─→ email_attachments (email_id)
```

### Key Relationships Explained

**1. Bids → Budget Items (One-Way Conversion)**
```
bids (status: selected)
    ↓ [Finalize button]
budget_items (status: approved)
```
- Bid is NEVER deleted after finalization
- Budget item notes include "Finalized from bid #xyz"
- Can trace back to original bid for audit

**2. Vendors ↔ Contacts (Many-to-Many)**
```
vendors
    ├─→ primary_contact (one main person)
    └─ Multiple contacts can work for same vendor
```

**3. Emails → Bids (Trigger)**
```
emails (received)
    ↓ [AI extraction]
bids (created if quote detected)
    ↓
emails.category = 'bid'
emails.ai_summary = "Bid extracted: $X"
```

**4. Tasks → Milestones (Grouped)**
```
milestones (e.g., "Foundation Complete")
    └─→ tasks (e.g., "Pour footings", "Install plumbing")
```

---

## Data Population Methods

### Method 1: Initial Import Script

**File:** `scripts/import-project-data.js`

**What it does:**
```javascript
// Run once to populate baseline data
node scripts/import-project-data.js
```

**Populates:**
- ✅ 1 project record
- ✅ 6 planning_phase_steps
- ✅ 24 contacts
- ✅ 12 vendors
- ✅ 30+ budget_items (paid + pending)
- ✅ 3 permits
- ✅ 7 milestones
- ✅ 1 project_status snapshot

**Source data:**
- Dropbox files (VENDOR_DIRECTORY.md, ACTION_ITEMS.md, etc.)
- Budget spreadsheets
- Expense tracking documents
- Construction tasks CSV

**When to use:** Once, at the beginning

---

### Method 2: AI Bid Extraction from Emails

**Trigger:** Email arrives from vendor with quote

**Flow:**
```
1. Gmail API receives new email
2. App checks: Is this from tracked vendor?
3. If yes → extractBidFromEmail()
4. AI analyzes content
5. If bid detected → Insert into bids table
6. Update email.category = 'bid'
7. Notify user: "New bid from X"
```

**API Endpoint:**
```javascript
POST /api/bids/extract-from-email
{
  "email_id": "uuid",
  "subject": "Quote for Windows",
  "body": "Email content...",
  "sender_email": "vendor@example.com",
  "project_id": "uuid"
}
```

**Result:**
```json
{
  "success": true,
  "bids": [
    {
      "id": "new-bid-uuid",
      "vendor_name": "Prestige Steel",
      "total_amount": 68446.00,
      ...
    }
  ]
}
```

**What gets populated:**
- ✅ New record in `bids` table
- ✅ Links to `emails` table (email_id)
- ✅ May create new `vendor` record if unknown company
- ✅ Updates `emails.category` and `ai_summary`

---

### Method 3: Manual Entry via UI

**User actions populate database:**

**Add Contact:**
```
UI Form → POST /api/contacts → contacts table
```

**Add Budget Item:**
```
UI Form → POST /api/budget-items → budget_items table
```

**Update Task Status:**
```
Checkbox → PATCH /api/tasks → tasks.status = 'completed'
```

**Upload Document:**
```
File Upload → POST /api/upload → Supabase Storage
          → POST /api/documents → documents table
```

---

### Method 4: Gmail Sync (Automatic)

**Triggered by:**
- Cron job every 30 minutes
- Manual "Refresh" button
- New email detected (webhook if configured)

**Process:**
```
1. GET /api/emails/fetch
2. GmailService.getEmails(query)
3. For each email:
   - Check if message_id exists (deduplication)
   - If new → Insert into emails table
   - AI analyzes → Add ai_summary
   - Check if bid → extractBidFromEmail()
4. Return count of new emails
```

**What gets populated:**
- ✅ New records in `emails` table
- ✅ May create `bids` if quote detected
- ✅ May create `contacts` if unknown sender
- ✅ Updates `email_accounts.last_sync`

---

### Method 5: Bid Finalization (User Action)

**User selects winning bid:**

```
1. User clicks "Select Bid" on bid card
   → PATCH /api/bids/manage
   → bids.status = 'selected'
   → Competing bids.status = 'rejected'

2. User clicks "Finalize to Budget"
   → POST /api/bids/manage with action: 'finalize'
   → Creates new budget_items record
   → Links back to original bid
```

**Flow diagram:**
```
bids (status: pending)
    ↓ [User: Select]
bids (status: selected)
    ↓ [User: Finalize]
budget_items (status: approved) + bids (notes updated)
```

**What gets populated:**
- ✅ `bids.status` = 'selected'
- ✅ `bids.selected_date` = today
- ✅ Competing bids.status = 'rejected'
- ✅ NEW record in `budget_items`
- ✅ `budget_items.notes` includes bid reference

---

### Method 6: AI Daily Summary (Automated)

**Runs daily via cron:**

```
1. Fetch all emails from last 24 hours
2. AI analyzes with analyzeProjectEmails()
3. Extracts:
   - Hot topics
   - Action items
   - Recent decisions
4. Creates new project_status snapshot
```

**What gets populated:**
- ✅ New `project_status` record each day
- ✅ `ai_summary` field generated
- ✅ `hot_topics`, `action_items`, `recent_decisions` arrays

---

### Method 7: Milestone/Task Progress Updates

**As work progresses:**

```
Dashboard UI → User marks task complete
          ↓
PATCH /api/tasks
          ↓
tasks.status = 'completed'
tasks.completed_date = today
          ↓
Check: Are all tasks for milestone complete?
          ↓ (if yes)
milestones.status = 'completed'
milestones.completed_date = today
          ↓
projects.current_step += 1 (if planning phase)
```

**What gets populated:**
- ✅ `tasks.status` and `completed_date`
- ✅ `milestones.status` (auto when all tasks done)
- ✅ `projects.current_step` (planning phase)
- ✅ `projects.phase` (when moving to construction)

---

## Data Flow Diagrams

### Flow 1: Email → Bid → Budget

```
┌──────────────────────────────────────────────────────────┐
│  1. EMAIL ARRIVES                                         │
│  From: vendor@example.com                                 │
│  Subject: "Quote #123"                                    │
│  Body: "Total: $68,446..."                               │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  2. GMAIL SYNC                                            │
│  • Fetches email via Gmail API                           │
│  • Checks message_id (deduplication)                     │
│  • Inserts into `emails` table                           │
│  • record created with id: email-abc-123                 │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  3. AI BID DETECTION                                      │
│  • extractBidFromEmail() analyzes content                │
│  • Detects: Yes, this is a quote                         │
│  • Extracts: vendor, pricing, terms, scope               │
│  • Confidence: 95%                                        │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  4. CREATE BID RECORD                                     │
│  • INSERT INTO bids (...)                                │
│  • vendor_name: "Prestige Steel"                         │
│  • category: "Windows & Doors"                           │
│  • total_amount: 68446.00                                │
│  • status: "pending"                                      │
│  • email_id: email-abc-123 (link back)                   │
│  • needs_review: false (high confidence)                 │
│  • record created with id: bid-xyz-789                   │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  5. UPDATE EMAIL RECORD                                   │
│  • UPDATE emails SET category = 'bid'                    │
│  • SET ai_summary = "Bid extracted: $68,446"             │
│  • WHERE id = email-abc-123                              │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  6. USER NOTIFICATION                                     │
│  • Dashboard shows: "New bid from Prestige Steel"        │
│  • Badge count: "3 bids need review"                     │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  7. USER REVIEWS BID                                      │
│  • Views bid details in UI                               │
│  • Compares with other window bids                       │
│  • Clicks "Select Bid"                                   │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  8. BID SELECTION                                         │
│  • PATCH /api/bids/manage                                │
│  • UPDATE bids SET status = 'selected'                   │
│  • WHERE id = bid-xyz-789                                │
│  • Auto-reject competing bids:                           │
│    UPDATE bids SET status = 'rejected'                   │
│    WHERE category = 'Windows & Doors'                    │
│    AND id != bid-xyz-789                                 │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  9. USER FINALIZES                                        │
│  • Clicks "Finalize to Budget"                           │
│  • POST /api/bids/manage {action: "finalize"}            │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  10. CREATE BUDGET ITEM                                   │
│  • INSERT INTO budget_items (                            │
│      category: "Envelope",                               │
│      subcategory: "Windows & Doors",                     │
│      description: "Prestige Steel - Thermally Broken",   │
│      estimated_cost: 68446.00,                           │
│      vendor_id: (lookup Prestige Steel),                 │
│      status: "approved",                                  │
│      approval_date: today,                               │
│      notes: "Finalized from bid #bid-xyz-789"            │
│    )                                                      │
│  • record created with id: budget-item-456               │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  11. UPDATE BID RECORD                                    │
│  • UPDATE bids SET                                        │
│      internal_notes = "Finalized to budget_item #456"    │
│    WHERE id = bid-xyz-789                                │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  12. DASHBOARD UPDATE                                     │
│  • Budget shows new $68,446 approved expense             │
│  • Total committed: $289,196 → $357,642                  │
│  • Bid removed from "pending" list                       │
│  • Vendor status: potential → active                     │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 2: Initial Data Import

```
┌──────────────────────────────────────────────────────────┐
│  START: node scripts/import-project-data.js              │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  1. READ SOURCE DATA                                      │
│  • VENDOR_DIRECTORY.md (contacts & vendors)              │
│  • ACTION_ITEMS.md (current status)                      │
│  • PROJECT_SPECIFICATIONS.json (specs)                   │
│  • Budget files (expenses, bids)                         │
│  • Construction_Tasks.csv (148 tasks)                    │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  2. CONNECT TO SUPABASE                                   │
│  • createClient(supabaseUrl, supabaseKey)                │
│  • Verify connection                                      │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  3. INSERT PROJECT                                        │
│  • INSERT INTO projects (...)                            │
│  • name: "708 Purple Salvia Cove"                        │
│  • budget_total: 1200000.00                              │
│  • Save project_id for FK relationships                  │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  4. INSERT PLANNING STEPS (6 records)                    │
│  • Loop through 6 steps                                   │
│  • INSERT INTO planning_phase_steps                      │
│  • Link to project_id                                    │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  5. INSERT CONTACTS (24 records)                         │
│  • Loop through contacts array                           │
│  • INSERT INTO contacts                                  │
│  • Save contact_ids for FK relationships                 │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  6. INSERT VENDORS (12 records)                          │
│  • Loop through vendors array                            │
│  • INSERT INTO vendors                                   │
│  • Link primary_contact to contact_id                    │
│  • Save vendor_ids                                       │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  7. INSERT BUDGET ITEMS (30+ records)                    │
│  • Paid items ($289K)                                    │
│  • Contracted items ($67K)                               │
│  • Pending bids                                          │
│  • Estimated items                                       │
│  • Link to vendor_ids                                    │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  8. INSERT PERMITS (3 records)                           │
│  • HOA Architectural Review                              │
│  • Building Permit                                       │
│  • Septic Permit                                         │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  9. INSERT MILESTONES (7 records)                        │
│  • Planning Phase Complete                               │
│  • Permits Approved                                      │
│  • Foundation Complete                                   │
│  • Dried-In (Weather Tight)                              │
│  • Rough-In Complete                                     │
│  • Interior Finishes Complete                            │
│  • Final Inspection & CO                                 │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  10. INSERT PROJECT STATUS (1 snapshot)                  │
│  • Current date                                          │
│  • hot_topics array                                      │
│  • action_items array                                    │
│  • recent_decisions array                                │
│  • budget_used: 289195.60                                │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  11. LOG SUMMARY                                          │
│  • Projects: 1                                           │
│  • Planning Steps: 6                                     │
│  • Contacts: 24                                          │
│  • Vendors: 12                                           │
│  • Budget Items: 30                                      │
│  • Permits: 3                                            │
│  • Milestones: 7                                         │
│  • Status: 1                                             │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  ✅ IMPORT COMPLETE                                       │
│  Database ready to use!                                  │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 3: Daily AI Summary Generation

```
┌──────────────────────────────────────────────────────────┐
│  TRIGGER: Daily Cron Job (midnight)                      │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  1. FETCH RECENT EMAILS                                   │
│  • SELECT * FROM emails                                  │
│  • WHERE received_date >= today - 1 day                  │
│  • AND project_id = current_project                      │
│  • Returns: 5 emails                                     │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  2. AI ANALYSIS                                           │
│  • analyzeProjectEmails(emails)                          │
│  • Claude AI reads all 5 emails                          │
│  • Extracts patterns, themes, urgency                    │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  3. GENERATE INSIGHTS                                     │
│  • Hot Topics: ["Civil eng review", "Window urgency"]    │
│  • Action Items: [{item, priority, due}, ...]            │
│  • Decisions: [{date, decision, impact}, ...]            │
│  • Overall Summary: "Project on track..."                │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  4. GET CURRENT PROJECT STATE                             │
│  • SELECT budget_used FROM budget_items                  │
│  • SELECT current_step FROM projects                     │
│  • SELECT phase FROM projects                            │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  5. CREATE PROJECT STATUS SNAPSHOT                        │
│  • INSERT INTO project_status (                          │
│      date: today,                                        │
│      phase: "planning",                                  │
│      current_step: 4,                                    │
│      hot_topics: [...],                                  │
│      action_items: [...],                                │
│      recent_decisions: [...],                            │
│      budget_used: 289195.60,                             │
│      ai_summary: "Project on track..."                   │
│    )                                                      │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│  6. DASHBOARD UPDATED                                     │
│  • "Daily Status" widget shows new snapshot              │
│  • Hot topics displayed prominently                      │
│  • Action items flagged by priority                      │
└──────────────────────────────────────────────────────────┘
```

---

## Examples

### Example 1: Complete Bid Lifecycle

Let's trace a single bid from email to budget:

**Day 1: Email Arrives**
```sql
-- Email synced from Gmail
INSERT INTO emails (
  message_id, sender_email, subject, body_text, received_date
) VALUES (
  'gmail-msg-abc',
  'tina@prestigesteel.com',
  'Quote #2025-0142 - Windows & Doors',
  'Total: $68,446...',
  '2026-02-10 14:30:00'
);
-- Result: email id = 'email-123'
```

**Day 1: AI Extraction (automatic)**
```sql
-- Bid extracted by AI
INSERT INTO bids (
  project_id, vendor_name, category, total_amount,
  line_items, inclusions, status, email_id,
  ai_extracted, ai_confidence
) VALUES (
  'project-abc',
  'Prestige Steel',
  'Windows & Doors',
  68446.00,
  '[{"item": "Living room door", "total": 8500}, ...]',
  '["Installation", "3-yr warranty"]',
  'pending',
  'email-123',
  true,
  0.95
);
-- Result: bid id = 'bid-456'

-- Update email category
UPDATE emails SET
  category = 'bid',
  ai_summary = 'Bid extracted: $68,446 for windows & doors'
WHERE id = 'email-123';
```

**Day 2: User Reviews**
```sql
-- User views bid in dashboard
SELECT * FROM bids WHERE id = 'bid-456';

-- User adds notes
UPDATE bids SET
  pros = 'Best value, reasonable lead time',
  cons = 'Mid-tier thermal rating'
WHERE id = 'bid-456';
```

**Day 3: User Compares**
```sql
-- User compares with competing bid
-- (This happens via API, creates bid_comparison record)
INSERT INTO bid_comparisons (
  project_id, category, bid_ids, evaluation_criteria
) VALUES (
  'project-abc',
  'Windows & Doors',
  ARRAY['bid-456', 'bid-789'],
  '{"comparison": "Prestige offers best value...", "recommendation": "Select Prestige"}'
);
-- Result: comparison id = 'comp-321'
```

**Day 3: User Selects Winner**
```sql
-- User clicks "Select Bid"
UPDATE bids SET
  status = 'selected',
  selected_date = '2026-02-12',
  selection_notes = 'Best value for thermal efficiency'
WHERE id = 'bid-456';

-- Auto-reject competing bids
UPDATE bids SET
  status = 'rejected',
  selection_notes = 'Alternative bid selected'
WHERE category = 'Windows & Doors'
  AND project_id = 'project-abc'
  AND id != 'bid-456';
```

**Day 3: User Finalizes**
```sql
-- User clicks "Finalize to Budget"
-- Creates budget item
INSERT INTO budget_items (
  project_id, category, subcategory, description,
  estimated_cost, status, approval_date, notes
) VALUES (
  'project-abc',
  'Envelope',
  'Windows & Doors',
  'Prestige Steel - Thermally Broken',
  68446.00,
  'approved',
  '2026-02-12',
  'Finalized from bid #bid-456. Lead time 8-12 weeks.'
);
-- Result: budget_item id = 'budget-789'

-- Update bid with reference
UPDATE bids SET
  internal_notes = 'Finalized to budget_item #budget-789 on 2026-02-12'
WHERE id = 'bid-456';
```

**Result: Full Audit Trail**
```sql
-- Can trace complete history:
SELECT
  e.subject as email_subject,
  e.received_date,
  b.vendor_name,
  b.total_amount,
  b.status as bid_status,
  b.selected_date,
  bi.description as budget_description,
  bi.status as budget_status,
  bi.approval_date
FROM emails e
JOIN bids b ON b.email_id = e.id
LEFT JOIN budget_items bi ON bi.notes LIKE '%' || b.id || '%'
WHERE b.id = 'bid-456';
```

---

### Example 2: Task Progress Updating Milestone

**Initial State:**
```sql
-- Milestone: "Permits Approved"
SELECT * FROM milestones WHERE name = 'Permits Approved';
-- status: 'pending'

-- Related tasks:
SELECT * FROM tasks WHERE milestone_id = 'milestone-permits';
-- Task 1: Submit HOA Application - status: 'pending'
-- Task 2: Submit Building Permit - status: 'pending'
-- Task 3: Submit Septic Permit - status: 'pending'
```

**User completes HOA task:**
```sql
UPDATE tasks SET
  status = 'completed',
  completed_date = '2026-03-15'
WHERE title = 'Submit HOA Application';
```

**User completes Building Permit task:**
```sql
UPDATE tasks SET
  status = 'completed',
  completed_date = '2026-04-20'
WHERE title = 'Submit Building Permit';
```

**User completes Septic Permit task:**
```sql
UPDATE tasks SET
  status = 'completed',
  completed_date = '2026-04-22'
WHERE title = 'Submit Septic Permit';

-- Trigger checks: All tasks for milestone complete?
SELECT COUNT(*) FROM tasks
WHERE milestone_id = 'milestone-permits'
  AND status != 'completed';
-- Returns: 0

-- Auto-update milestone
UPDATE milestones SET
  status = 'completed',
  completed_date = '2026-04-22'
WHERE id = 'milestone-permits';
```

---

### Example 3: Email Sync with Vendor Creation

**New email from unknown sender:**
```sql
-- Gmail sync finds email from new vendor
-- Email: info@newcontractor.com
-- Subject: "Bid for Foundation Work"

-- Check: Does contact exist?
SELECT id FROM contacts WHERE email = 'info@newcontractor.com';
-- Returns: NULL

-- Auto-create contact
INSERT INTO contacts (
  project_id, name, email, type, notes
) VALUES (
  'project-abc',
  'New Contractor',
  'info@newcontractor.com',
  'contractor',
  'Auto-created from email sync'
);
-- Result: contact id = 'contact-999'

-- Insert email
INSERT INTO emails (
  project_id, message_id, sender_email, subject, body_text
) VALUES (
  'project-abc',
  'gmail-new-123',
  'info@newcontractor.com',
  'Bid for Foundation Work',
  'We can do your foundation for $95,000...'
);

-- AI detects bid
-- Creates bid record (links to email)
-- May also create vendor record
INSERT INTO vendors (
  project_id, company_name, category, status
) VALUES (
  'project-abc',
  'New Contractor',
  'Foundation',
  'potential'
);
```

---

## Summary

### Key Takeaways

1. **Hierarchical Structure**
   - `projects` is the root
   - Everything links to project_id
   - Clear parent-child relationships

2. **Multiple Entry Points**
   - Import script (initial data)
   - AI extraction (emails → bids)
   - Manual entry (UI forms)
   - API routes (programmatic)
   - Cron jobs (automated syncs)

3. **Bids vs Budget Items**
   - **Bids** = Options (before selection)
   - **Budget Items** = Finalized (approved spending)
   - One-way flow: Bid → Budget Item

4. **Audit Trail**
   - Every bid links to source email
   - Budget items reference original bids
   - All timestamps preserved
   - Can trace complete history

5. **AI Automation**
   - Email analysis (summaries, action items)
   - Bid extraction (structured data)
   - Comparison recommendations
   - Daily status updates

6. **Foreign Keys Ensure Integrity**
   - Can't delete project while data exists
   - Vendor links maintained
   - Email-bid-budget chain preserved

---

**Questions?** Review specific table sections above or check the data flow diagrams for visual understanding.

---

*Last Updated: February 11, 2026*
*Version: 1.0*
