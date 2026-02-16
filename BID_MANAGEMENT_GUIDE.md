# Bid Management System - Complete Guide

**Last Updated:** February 11, 2026

This guide explains how to use the AI-powered bid management system to track vendor quotes, compare options, and finalize your construction budget.

---

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Workflow](#workflow)
4. [Using the System](#using-the-system)
5. [API Reference](#api-reference)
6. [Examples](#examples)

---

## Overview

### The Problem
- Vendor bids come in via email, PDF, or phone
- Hard to track multiple options for the same work
- Difficult to compare apples-to-apples
- Manual entry into budget is error-prone

### The Solution
**AI-Powered Bid Extraction → Structured Storage → Easy Comparison → One-Click Finalization**

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│ Email with  │ AI   │ Structured   │ You  │ Select      │ Auto │ Budget Item  │
│ Bid         │ ───> │ Bid Options  │ ───> │ Winner      │ ───> │ (Finalized)  │
│ Quote/PDF   │      │ (Comparison) │      │             │      │              │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
```

### Key Features

✅ **Automatic Extraction** - AI reads emails and extracts:
- Vendor name and contact info
- Category of work (Windows, HVAC, Plumbing, etc.)
- Total price and line-item breakdown
- What's included/excluded
- Payment terms, timeline, lead time
- Warranty information

✅ **Smart Categorization** - Uses standard categories:
- Site Work, Well & Septic, Foundation, Framing
- Roofing, Windows & Doors, Siding & Exterior
- MEP (HVAC, Plumbing, Electrical)
- Insulation, Drywall, Flooring, Cabinetry
- Countertops, Interior Finishes, Appliances
- Landscaping, Pool & Spa

✅ **Easy Comparison** - Side-by-side view with:
- Pricing differences
- Scope variations (inclusions/exclusions)
- Timeline and lead times
- AI-generated pros/cons
- Recommendation based on value

✅ **One-Click Finalization** - Selected bid converts to:
- Approved budget_item
- Competing bids auto-rejected
- Vendor linked to project
- Full audit trail maintained

---

## Setup

### 1. Database Schema

Run the new schema file to add bid tables:

```bash
# In Supabase SQL Editor, run:
supabase-bids-schema.sql
```

This creates:
- `bids` table - Stores bid options
- `bid_comparisons` table - Tracks evaluations
- `bid_attachments` table - Linked files
- Helper views and functions

### 2. Environment Variables

Already set if you have Claude AI configured:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Email Integration

Make sure Gmail is connected (for automatic bid detection):
1. Go to `/emails` in your app
2. Click "Connect Gmail"
3. Authorize access

---

## Workflow

### Step 1: Receive Bid Email

When a vendor sends a bid via email:

**Option A: Automatic Detection (Recommended)**
- Email arrives from tracked vendor
- AI automatically detects if it contains a bid
- Extracts structured information
- Creates bid record with "needs_review" flag
- You get notification: "New bid detected"

**Option B: Manual Submission**
- Forward email to your system
- Or paste content into bid submission form
- AI extracts and creates bid record

### Step 2: Review Extracted Bid

Navigate to **Bids Dashboard** (`/bids`):

```
┌─────────────────────────────────────────────────────┐
│ 📋 Bids Awaiting Review (3)                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🔔 Prestige Steel - Windows & Doors                │
│    $68,446 • Received Feb 10, 2026                  │
│    AI Confidence: 92% • Needs Review                │
│    [View Details] [Edit] [Compare]                  │
│                                                      │
│ 🔔 Chuck F. - Septic System (Aerobic)              │
│    $25,210 • Received Feb 8, 2026                   │
│    AI Confidence: 85% • Needs Review                │
│    [View Details] [Edit] [Compare]                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Click **View Details** to see:
- Vendor information
- Complete pricing breakdown
- Scope of work
- Inclusions/exclusions
- Payment terms
- Timeline and lead time
- AI confidence score
- Extraction notes (any uncertainties)

### Step 3: Compare Multiple Bids

If you have multiple bids for same category:

```
┌─────────────────────────────────────────────────────┐
│ 🔄 Compare: Septic System (2 bids)                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────┐  ┌─────────────────┐           │
│ │ Chuck F.        │  │ Paul Swoyer     │           │
│ │ $25,210         │  │ $44,850         │           │
│ ├─────────────────┤  ├─────────────────┤           │
│ │ ✅ Lower price  │  │ ✅ More complete│           │
│ │ ✅ Local vendor │  │ ✅ Larger system│           │
│ │ ❌ Smaller GPD  │  │ ✅ 2-yr service │           │
│ │ ❌ Unclear scope│  │ ✅ Sandy loam   │           │
│ └─────────────────┘  └─────────────────┘           │
│                                                      │
│ 🤖 AI Recommendation:                               │
│ "Paul Swoyer bid is $19K higher but includes       │
│  significant extras: larger 1500 GPD system,       │
│  20 loads sandy loam, 2-year service agreement.    │
│  Chuck F. needs scope clarification. If budgets    │
│  allow, Paul Swoyer offers better value."          │
│                                                      │
│ [Select Chuck F.] [Select Paul Swoyer]             │
└─────────────────────────────────────────────────────┘
```

### Step 4: Select Winner

Click **Select** on chosen bid:

1. Status changes to "Selected"
2. Competing bids auto-rejected
3. Selection notes field appears
4. **Finalize to Budget** button enabled

### Step 5: Finalize to Budget

Click **Finalize to Budget**:

```
┌─────────────────────────────────────────────────────┐
│ ✅ Confirm Finalization                             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Vendor: Paul Swoyer Septics LLC                     │
│ Category: Site Work - Septic System                 │
│ Amount: $44,850                                      │
│                                                      │
│ This will:                                           │
│ • Create approved budget_item for $44,850           │
│ • Link to Paul Swoyer vendor record                 │
│ • Mark bid as finalized (cannot be changed)         │
│ • Add to total committed spend                      │
│                                                      │
│ [Cancel] [Confirm Finalize]                         │
└─────────────────────────────────────────────────────┘
```

After confirmation:
- New budget_item created (status: "approved")
- Appears in budget dashboard
- Counts toward total committed spend
- Bid record linked to budget for audit trail

---

## Using the System

### Accessing Bids

**Main Dashboard:**
```
/bids                  # All bids overview
/bids/pending          # Bids needing review
/bids/compare          # Comparison tool
/bids/finalized        # History of finalized bids
```

**Quick Stats Widget (Dashboard):**
```
┌─────────────────────────────────┐
│ 📊 Bids Summary                 │
├─────────────────────────────────┤
│ Pending Review: 3               │
│ Under Review: 2                 │
│ Selected: 5                     │
│ Finalized: 8                    │
│                                 │
│ Total Value Pending: $215,483   │
│ [Review Bids →]                 │
└─────────────────────────────────┘
```

### Filtering & Searching

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Filters                                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Category: [All ▼]                                   │
│ Status: [Pending ▼]                                 │
│ Vendor: [All ▼]                                     │
│ Date Range: [Last 30 days ▼]                       │
│                                                      │
│ Sort by: [Received Date ▼] [Amount] [Vendor]       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Manual Bid Entry

If bid comes via phone or in-person:

```
┌─────────────────────────────────────────────────────┐
│ ➕ Add Bid Manually                                 │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Vendor Name: [________________]                     │
│ Category: [Select Category ▼]                      │
│ Total Amount: $[___________]                        │
│                                                      │
│ Line Items: [+ Add Item]                            │
│  • Item 1: [_____] Qty: [__] Price: $[____]       │
│  • Item 2: [_____] Qty: [__] Price: $[____]       │
│                                                      │
│ Scope of Work: [________________________]           │
│ Inclusions: [___________________________]           │
│ Exclusions: [___________________________]           │
│                                                      │
│ Payment Terms: [_______________________]            │
│ Lead Time: [__] weeks                               │
│                                                      │
│ [Cancel] [Save Bid]                                 │
└─────────────────────────────────────────────────────┘
```

### Editing Extracted Bids

AI might miss details or misclassify:

```
┌─────────────────────────────────────────────────────┐
│ ✏️ Edit Bid - Prestige Steel                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ⚠️ AI Confidence: 85%                              │
│ Note: "Unclear if installation included"            │
│                                                      │
│ Category: Windows & Doors ✓                         │
│ Total: $68,446.00 ✓                                 │
│                                                      │
│ ✏️ Edit this field:                                │
│ Inclusions:                                          │
│ [✓] All hardware                                    │
│ [✓] Installation labor                              │
│ [✓] 3-year workmanship warranty                    │
│ [✓] 10-year material warranty                       │
│ [+] Add more                                         │
│                                                      │
│ [Cancel] [Save Changes]                             │
└─────────────────────────────────────────────────────┘
```

---

## API Reference

### Extract Bid from Email

```bash
POST /api/bids/extract-from-email

Body:
{
  "email_id": "uuid",           # Optional: Link to emails table
  "subject": "Bid for Windows",
  "body": "Email content...",
  "sender_email": "vendor@example.com",
  "sender_name": "John Vendor",  # Optional
  "project_id": "uuid"
}

Response:
{
  "success": true,
  "message": "Extracted 1 bid(s) from email",
  "is_bid_email": true,
  "bids": [
    {
      "id": "uuid",
      "vendor_name": "Prestige Steel",
      "category": "Windows & Doors",
      "total_amount": 68446.00,
      ...
    }
  ],
  "extraction_notes": ["Confidence: 92%. All details extracted clearly."]
}
```

### List Bids

```bash
GET /api/bids/manage?project_id=uuid&status=pending&category=Windows%20%26%20Doors

Response:
{
  "bids": [
    {
      "id": "uuid",
      "vendor_name": "Prestige Steel",
      "category": "Windows & Doors",
      "total_amount": 68446.00,
      "status": "pending",
      "needs_review": true,
      "ai_confidence": 0.92,
      ...
    }
  ]
}
```

### Update Bid (Select/Reject)

```bash
PATCH /api/bids/manage

Body:
{
  "bid_id": "uuid",
  "action": "select",              # select | reject | under_review | update
  "selection_notes": "Best value for thermal efficiency",
  "pros": "8-15 week lead acceptable",
  "cons": "None significant"
}

Response:
{
  "success": true,
  "message": "Bid selected successfully",
  "bid": { ... }
}
```

### Finalize to Budget

```bash
POST /api/bids/manage

Body:
{
  "bid_id": "uuid",
  "action": "finalize"
}

Response:
{
  "success": true,
  "message": "Bid finalized to budget",
  "budget_item": {
    "id": "uuid",
    "category": "Windows & Doors",
    "estimated_cost": 68446.00,
    "status": "approved",
    ...
  },
  "bid": { ... }
}
```

### Compare Bids

```bash
POST /api/bids/compare

Body:
{
  "bid_ids": ["uuid1", "uuid2", "uuid3"],
  "project_context": "Budget target $1.2M, prioritize thermal efficiency"
}

Response:
{
  "success": true,
  "bids": [
    {
      "id": "uuid1",
      "vendor_name": "Prestige Steel",
      "total_amount": 68446.00,
      "pros": ["Best value", "Good lead time"],
      "cons": ["Mid-tier thermal rating"]
    },
    ...
  ],
  "comparison": "Prestige Steel offers best balance...",
  "recommendation": "Select Prestige Steel Thermally Broken option",
  "comparison_id": "uuid"
}
```

---

## Examples

### Example 1: Processing Window Bid Email

**Email received:**
```
From: Tina <tina@prestigesteel.com>
Subject: Quote #2025-0142 - 708 Purple Salvia Windows & Doors

Hi Daniel,

Thank you for your inquiry. Here's our quote for your project:

WINDOWS & DOORS - THERMALLY BROKEN OPTION
- Living Room Steel Door (8' x 10'): $8,500
- Kitchen Steel Windows (6 units @ $2,800 ea): $16,800
- Master Bedroom Steel Door: $6,200
- Additional windows (12 units): $28,500
- Hardware & installation: $8,446

Total: $68,446

This includes:
• All hardware and installation
• 3-year workmanship warranty
• 10-year material warranty
• Thermal breaks for energy efficiency

Lead time: 8-12 weeks from order
Valid until: March 15, 2026

Let me know if you have questions!
```

**System processes:**

1. **AI Extraction:**
```json
{
  "vendor_name": "Prestige Steel",
  "category": "Windows & Doors",
  "subcategory": "Steel Windows & Doors",
  "total_amount": 68446.00,
  "line_items": [
    {
      "item": "Living Room Steel Door (8' x 10')",
      "quantity": 1,
      "unit_price": 8500.00,
      "total": 8500.00
    },
    {
      "item": "Kitchen Steel Windows",
      "quantity": 6,
      "unit_price": 2800.00,
      "total": 16800.00
    },
    ...
  ],
  "inclusions": [
    "All hardware and installation",
    "3-year workmanship warranty",
    "10-year material warranty",
    "Thermal breaks for energy efficiency"
  ],
  "lead_time_weeks": 10,
  "valid_until": "2026-03-15",
  "ai_confidence": 0.95
}
```

2. **Stored in Database:**
- Bid record created
- Status: "pending"
- needs_review: false (high confidence)
- Linked to email record

3. **You Review:**
- See bid in dashboard
- Compare with other window vendors
- Select as winner

4. **Finalize:**
- Click "Finalize to Budget"
- Budget item created: $68,446
- Competing bids rejected
- Appears in budget tracking

### Example 2: Comparing Septic Bids

**You have two septic bids:**

1. **Chuck F. - $25,210**
   - Aerobic spray system
   - Installation + design/permit
   - Scope unclear on GPD capacity

2. **Paul Swoyer - $44,850**
   - 1500 GPD Aerobic system
   - 6,500 SF drip field
   - 20 loads sandy loam included
   - 2-year service agreement
   - Full design/permit

**Use comparison tool:**

```bash
POST /api/bids/compare
{
  "bid_ids": ["chuck-uuid", "paul-uuid"],
  "project_context": "7,526 sq ft home, 2 kitchens, budget conscious but value quality"
}
```

**AI Analysis:**
```
COMPARISON:
Paul Swoyer's bid is $19,640 higher but includes significant extras:
- Larger 1500 GPD system (Chuck F. capacity unspecified)
- 6,500 SF drip field vs unclear size
- 20 loads of sandy loam ($4,000+ value)
- 2-year service agreement ($1,100 value)
- Complete design/permit clearly itemized

Chuck F.'s bid is attractive on price but requires clarification on:
- GPD capacity (1500 needed for your home size)
- Drip field size and specs
- Whether sandy loam is included
- Service agreement terms

RECOMMENDATION:
If Chuck F. can confirm 1500 GPD system with comparable drip field and sandy loam,
their bid represents better value. Otherwise, Paul Swoyer's transparent and complete
package justifies the price difference.

ACTION: Request clarification from Chuck F. before deciding.
```

**You decide:**
- Email Chuck F. for clarification
- Mark Paul Swoyer bid as "under_review" backup
- Once Chuck responds, select winner and finalize

---

## Tips & Best Practices

### 1. Review AI Extractions
- Always review bids with AI confidence < 90%
- Check line items match totals
- Verify inclusions/exclusions are complete

### 2. Request Missing Info
- Use "selection_notes" to document clarifications needed
- Mark bid "under_review" while waiting for vendor response
- Update bid when vendor provides additional details

### 3. Track Decision Rationale
- Use "pros" and "cons" fields
- Document why you selected one bid over another
- Helps explain budget decisions later

### 4. Watch for Hidden Costs
- AI flags exclusions, but verify common add-ons
- Check if permits/fees are included
- Confirm installation vs material-only pricing

### 5. Use Comparison Tool
- Always compare when you have 2+ bids
- AI spots scope differences you might miss
- Get objective recommendation before deciding

### 6. Finalize Promptly
- Selected bids have expiration dates
- Finalize to lock in pricing
- Creates paper trail for construction loan

---

## Troubleshooting

### AI Doesn't Detect Bid in Email

**Possible reasons:**
- Email is general discussion, not actual quote
- Pricing is vague or mentioned in passing
- Bid is in PDF attachment (not extracted yet)

**Solution:**
- Use manual bid entry
- Or paste relevant sections into submission form

### Low AI Confidence

**Why it happens:**
- Unclear pricing structure
- Vendor used non-standard terms
- Missing key information

**What to do:**
1. Review extraction notes
2. Edit bid to correct/add details
3. Contact vendor for clarification
4. Use "internal_notes" to document issues

### Can't Compare Bids

**Check:**
- Are bids in same category?
- Are both at "pending" or "under_review" status?
- Do you have at least 2 bids?

### Finalize Button Disabled

**Requirements:**
- Bid status must be "selected"
- Can only finalize once
- Must have project_id

---

## Database Schema Reference

### bids Table

```sql
Key Columns:
- id (UUID)
- project_id (FK)
- vendor_id (FK, nullable)
- vendor_name (required)
- category (required) - "Windows & Doors", "HVAC", etc.
- subcategory
- total_amount (required)
- line_items (JSONB) - Detailed breakdown
- scope_of_work (TEXT)
- inclusions (JSONB Array)
- exclusions (JSONB Array)
- payment_terms
- warranty_terms
- lead_time_weeks
- valid_until (DATE)
- status - 'pending', 'under_review', 'selected', 'rejected', 'expired'
- ai_extracted (BOOLEAN)
- ai_confidence (0.00-1.00)
- needs_review (BOOLEAN)
- selection_notes
- pros, cons, internal_notes
- email_id (FK) - Links to source email
```

### Workflow States

```
pending → under_review → selected → [finalized to budget_item]
   ↓
rejected
   ↓
expired (auto, based on valid_until date)
```

---

## Support

### Common Questions

**Q: Can I edit a bid after it's finalized?**
A: No. Once finalized to budget, the bid is locked. The budget_item can be modified instead.

**Q: What if vendor changes price after selection?**
A: Create new bid with updated price, reject old one, or note change in budget_item.

**Q: How do I handle change orders?**
A: Change orders are separate. Finalized bid = original scope. Changes go in budget_items as adjustments.

**Q: Can I un-finalize a bid?**
A: Not directly. You'd need to delete the budget_item (cascades to update bid). Use with caution.

**Q: What categories should I use?**
A: Use standard categories listed in this guide. Helps with reporting and budgeting.

---

**Questions?** Check the API documentation or review example workflows above.

**Next Steps:**
1. Run `supabase-bids-schema.sql` to add tables
2. Test with a sample email bid
3. Review and select your first bid
4. Finalize to budget!

---

*Last updated: February 11, 2026*
*Version: 1.0*
