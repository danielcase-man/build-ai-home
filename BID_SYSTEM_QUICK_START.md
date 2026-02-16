# Bid Management System - Quick Start

**Created:** February 11, 2026
**Status:** ✅ Ready to Implement

---

## What You Asked For

> "I need a way to add bids as an option that I can then choose to finalize each item into the final budget. The bids I get from emails, how can I submit these to have an agent review and then provide a structured output that populates a portion of my database so that I can then select which choices (with prices) we are finalizing on?"

## What I Built

A complete **AI-powered bid management system** that:

1. ✅ **Extracts bids from emails automatically** using Claude AI
2. ✅ **Stores bids as "options"** in a dedicated `bids` table
3. ✅ **Compares multiple bids** side-by-side with AI analysis
4. ✅ **One-click selection** of winning bids
5. ✅ **Auto-converts** selected bids to finalized budget items
6. ✅ **Full audit trail** of all bid activity

---

## Files Created

### 1. Database Schema
**`supabase-bids-schema.sql`** - New tables:
- `bids` - Stores bid options with detailed breakdown
- `bid_comparisons` - Tracks bid evaluations
- `bid_attachments` - Links to PDFs/documents
- Helper views and SQL functions

### 2. AI Extraction Engine
**`src/lib/bid-extractor.ts`** - Claude AI integration:
- `extractBidFromEmail()` - Parse email content
- `extractBidFromDocument()` - Parse PDF text
- `compareBids()` - AI comparison analysis
- `refineBidExtraction()` - Correct/improve extraction

### 3. API Routes
**`src/app/api/bids/`**:
- `extract-from-email/route.ts` - Process email → create bid records
- `manage/route.ts` - List, update, select, reject, finalize bids
- `compare/route.ts` - Get AI comparison of multiple bids

### 4. UI Component
**`src/components/BidReviewCard.tsx`** - Example React component showing:
- Bid details display
- Line item breakdown
- Select/Reject buttons
- Finalize to budget action
- AI confidence indicators

### 5. Documentation
**`BID_MANAGEMENT_GUIDE.md`** - Complete guide (26 pages):
- Full workflow explanation
- API reference
- Usage examples
- Best practices
- Troubleshooting

**`BID_SYSTEM_QUICK_START.md`** - This file

---

## How It Works

### Simple Workflow

```
┌─────────────────┐
│ 1. Email arrives│
│ with bid quote  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. AI extracts: │
│ • Vendor        │
│ • Pricing       │
│ • Line items    │
│ • Terms         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Stored as    │
│ bid "option"    │
│ in database     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. You review   │
│ & compare with  │
│ other bids      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Select winner│
│ (others auto-   │
│  rejected)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. Finalize     │
│ → Budget Item   │
│ (approved)      │
└─────────────────┘
```

### Example: Processing a Window Bid

**Email from Prestige Steel:**
```
Subject: Quote #2025-0142
Total: $68,446
- Living room door: $8,500
- Kitchen windows: $16,800
...
Lead time: 8-12 weeks
Valid until: March 15, 2026
```

**AI automatically extracts:**
```json
{
  "vendor_name": "Prestige Steel",
  "category": "Windows & Doors",
  "total_amount": 68446.00,
  "line_items": [...],
  "lead_time_weeks": 10,
  "valid_until": "2026-03-15",
  "ai_confidence": 0.95
}
```

**Stored in `bids` table as:**
- Status: "pending"
- Needs review: false (high confidence)
- Ready for your review

**You then:**
1. View in dashboard
2. Compare with competing window bids (if any)
3. Click "Select Bid"
4. Click "Finalize to Budget"
5. Done! Now in `budget_items` as approved $68,446 expense

---

## Setup (5 minutes)

### Step 1: Add Database Tables

In Supabase SQL Editor:
```sql
-- Run this file:
supabase-bids-schema.sql
```

This creates:
- `bids` table
- `bid_comparisons` table
- `bid_attachments` table
- Helper views and functions

### Step 2: Environment Check

Verify you have:
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...        # ✓ Already set
NEXT_PUBLIC_SUPABASE_URL=...         # ✓ Already set
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # ✓ Already set
```

### Step 3: Test API Endpoint

```bash
curl -X POST http://localhost:3000/api/bids/extract-from-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Quote for Foundation Work",
    "body": "Total: $95,000 for post-tension slab...",
    "sender_email": "contractor@example.com",
    "project_id": "your-project-uuid"
  }'
```

Should return:
```json
{
  "success": true,
  "is_bid_email": true,
  "bids": [...]
}
```

---

## Usage Examples

### Manual Bid Extraction (From Gmail)

When you receive a bid email:

```javascript
// In your email processing code:
const result = await fetch('/api/bids/extract-from-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email_id: emailRecord.id,      // Link to emails table
    subject: email.subject,
    body: email.body,
    sender_email: email.from,
    sender_name: email.fromName,
    project_id: PROJECT_ID
  })
})

const { success, bids } = await result.json()

if (success && bids.length > 0) {
  console.log(`Extracted ${bids.length} bid(s)`)
  // Show notification: "New bid from X"
}
```

### List Pending Bids

```javascript
const response = await fetch('/api/bids/manage?status=pending&project_id=' + PROJECT_ID)
const { bids } = await response.json()

console.log(`You have ${bids.length} bids to review`)
```

### Select a Bid

```javascript
await fetch('/api/bids/manage', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bid_id: 'uuid',
    action: 'select',
    selection_notes: 'Best value for thermal efficiency'
  })
})
// Other bids in same category automatically rejected
```

### Finalize to Budget

```javascript
const result = await fetch('/api/bids/manage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bid_id: 'uuid',
    action: 'finalize'
  })
})

const { budget_item } = await result.json()
console.log(`Budget item created: $${budget_item.estimated_cost}`)
```

### Compare Multiple Bids

```javascript
const result = await fetch('/api/bids/compare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bid_ids: ['uuid1', 'uuid2', 'uuid3'],
    project_context: 'Budget target $1.2M, prioritize energy efficiency'
  })
})

const { comparison, recommendation, bids } = await result.json()

console.log('AI Analysis:', comparison)
console.log('Recommendation:', recommendation)
bids.forEach(bid => {
  console.log(`${bid.vendor_name}:`)
  console.log('  Pros:', bid.pros)
  console.log('  Cons:', bid.cons)
})
```

---

## What AI Extracts

From any bid email or document, Claude AI pulls:

### Vendor Information
- Company name
- Contact person
- Email/phone

### Pricing Details
- Total bid amount
- Line-item breakdown
  - Item description
  - Quantity
  - Unit price
  - Subtotal
  - Specifications

### Scope & Terms
- What work is included
- What materials/services provided
- What is explicitly excluded
- Payment terms (deposits, progress payments)
- Warranty information
- Timeline/duration
- Lead time for materials
- Bid validity period

### AI Metadata
- Confidence score (0.0 - 1.0)
- Extraction notes (any uncertainties)
- Whether human review is needed

### Categories Recognized

AI automatically classifies into:
- Site Work, Well & Septic
- Foundation, Framing, Roofing
- Windows & Doors, Siding & Exterior
- MEP: HVAC, Plumbing, Electrical
- Insulation, Drywall, Flooring
- Cabinetry, Countertops, Interior Finishes
- Appliances, Landscaping, Pool & Spa
- Other

---

## Key Features

### 1. Automatic Detection
- Emails from vendors automatically scanned
- Only creates bid record if actual quote/proposal
- Not fooled by general discussions

### 2. Smart Categorization
- Uses standard construction categories
- Makes budget reporting easier
- Groups competing bids automatically

### 3. Confidence Scoring
- AI rates its own extraction accuracy
- Low-confidence bids flagged for review
- You can edit any field if AI missed something

### 4. Comparison Analysis
- AI compares pricing differences
- Identifies scope variations (inclusions/exclusions)
- Highlights timeline considerations
- Generates pros/cons for each option
- Provides recommendation with reasoning

### 5. One-Click Finalization
- Selected bid → approved budget_item
- Competing bids auto-rejected
- Vendor linked to project
- Full audit trail maintained
- Can't be accidentally changed

### 6. Expiration Tracking
- Tracks bid validity dates
- Warns when expiring soon
- Auto-marks as expired

---

## Database Structure

### bids Table (Main)

```sql
Key fields:
- id, project_id, vendor_id
- vendor_name, category, subcategory
- total_amount
- line_items (JSONB) - detailed breakdown
- scope_of_work, inclusions, exclusions
- payment_terms, warranty_terms
- lead_time_weeks, valid_until
- status: pending/under_review/selected/rejected/expired
- ai_extracted, ai_confidence, needs_review
- selection_notes, pros, cons
- email_id (links to source)
```

### Workflow States

```
pending
   │
   ├─→ under_review (while you research)
   │
   ├─→ selected (winner chosen)
   │      │
   │      └─→ [Finalize] → budget_item created
   │
   ├─→ rejected (not chosen)
   │
   └─→ expired (past valid_until date)
```

---

## Benefits

### For You
- ✅ **No manual data entry** - AI extracts everything
- ✅ **Apples-to-apples comparison** - Structured format
- ✅ **Never miss details** - Inclusions/exclusions tracked
- ✅ **Fast decisions** - AI recommendations guide you
- ✅ **Audit trail** - Full history of why you chose each bid
- ✅ **Budget accuracy** - Directly converts to budget items

### For Your Lender
- ✅ **Documentation** - Every bid stored and categorized
- ✅ **Comparison proof** - Shows you got multiple quotes
- ✅ **Paper trail** - Links bid → budget → payment

### For Your Project
- ✅ **Cost tracking** - Know exactly what's committed
- ✅ **Timeline planning** - Lead times captured
- ✅ **Vendor management** - Contact info organized
- ✅ **Change orders** - Baseline for future changes

---

## Next Steps

### Immediate (Today)
1. ✅ Run `supabase-bids-schema.sql` in Supabase
2. ✅ Test extraction with a sample email
3. ✅ Review extracted bid data
4. ✅ Edit if needed, then select

### This Week
1. Process existing bid emails you've received
2. Set up automatic detection on new emails
3. Compare vendors for critical path items (windows, septic, well)
4. Finalize first few bids to budget

### Ongoing
- New bid emails auto-processed
- Review and compare options
- Select winners and finalize
- Build complete project budget

---

## Support

### Documentation
- **`BID_MANAGEMENT_GUIDE.md`** - Full 26-page guide with examples
- **`supabase-bids-schema.sql`** - Database schema with comments
- **API files** - Inline documentation in route files

### Examples
- Example email extraction in guide
- Example comparison workflow
- Example finalization process
- Sample API calls

### Troubleshooting
- Low AI confidence → Edit extraction
- Missing details → Contact vendor for clarification
- Can't compare → Check category matches
- Finalize disabled → Must select bid first

---

## Summary

You now have a complete system to:

1. **Receive** bid emails from vendors
2. **Extract** structured data automatically (AI)
3. **Store** as bid "options" in database
4. **Compare** multiple bids with AI analysis
5. **Select** winner (auto-reject others)
6. **Finalize** to approved budget item

**All integrated with your existing ubuildit-manager app!**

---

## Quick Reference

### Key Commands

```bash
# Run database schema
psql -f supabase-bids-schema.sql

# Test extraction
curl -X POST /api/bids/extract-from-email -d {...}

# List bids
curl /api/bids/manage?status=pending

# Select bid
curl -X PATCH /api/bids/manage -d '{"bid_id":"...", "action":"select"}'

# Finalize
curl -X POST /api/bids/manage -d '{"bid_id":"...", "action":"finalize"}'

# Compare
curl -X POST /api/bids/compare -d '{"bid_ids":[...]}'
```

### Key Files

- `supabase-bids-schema.sql` - Database tables
- `src/lib/bid-extractor.ts` - AI extraction
- `src/app/api/bids/` - API routes
- `src/components/BidReviewCard.tsx` - UI example
- `BID_MANAGEMENT_GUIDE.md` - Full documentation

---

**Ready to use!** Start by running the schema file and testing with your first bid email.

---

*Created: February 11, 2026*
*Version: 1.0*
*For: 708 Purple Salvia Cove Construction Project*
