# Data Retention and Disposal Policy

**Organization:** Daniel Case (FrameWork Application)
**Effective Date:** March 15, 2026
**Last Reviewed:** March 16, 2026
**Owner:** Daniel Case — danielcase.info@gmail.com

---

## 1. Purpose

This policy defines the retention periods and disposal procedures for data collected and processed by the FrameWork construction project management application. FrameWork is a single-user personal application operated solely by its owner.

## 2. Scope

This policy applies to all data stored in connection with the FrameWork application, including:

- Financial data received from the Plaid API (bank account metadata, transaction history)
- OAuth access and refresh tokens (Gmail, Plaid)
- Email messages synced via the Gmail API
- Construction project data (budgets, bids, milestones, tasks, contacts, documents)
- AI-generated summaries and status reports
- Application logs

## 3. Data Categories and Retention Periods

| Data Category | Retention Period | Justification |
|---|---|---|
| **Plaid access tokens** | Until bank connection is revoked or project concludes | Required for ongoing transaction sync |
| **Bank transaction data** | Duration of construction project + 7 years | Tax and financial record-keeping obligations |
| **Gmail OAuth tokens** | Until email connection is disconnected | Required for email sync functionality |
| **Synced email messages** | Duration of construction project + 3 years | Contractual reference and dispute resolution |
| **Construction project data** (budgets, bids, milestones, tasks, permits) | Duration of construction project + 7 years | Tax, warranty, and regulatory compliance |
| **Vendor/contractor contacts** | Duration of construction project + warranty periods | Warranty claims and follow-up |
| **AI-generated summaries** | Same as underlying source data | Derived from retained data |
| **Application logs** | 30 days (Vercel automatic rotation) | Debugging and operational monitoring |

## 4. Data Storage and Encryption

- All application data is stored in a **Supabase PostgreSQL** database with Row-Level Security (RLS) enabled on all tables.
- Plaid access tokens and Gmail OAuth tokens are encrypted at rest using **AES-256-GCM** with random initialization vectors and authentication tags.
- All data in transit is protected by **TLS 1.2+** (enforced by Vercel and Supabase).
- No financial data is stored in browser local storage, cookies, or client-side caches.

## 5. Disposal Procedures

### 5.1 Plaid Data

- **Revoking a connection:** The owner can disconnect a bank account at any time via the FrameWork Payments page. This deletes the Plaid access token from the database and stops further transaction syncing.
- **Transaction data:** Previously synced transactions are retained per the schedule above. When the retention period expires or upon owner request, transaction records are permanently deleted from the database using SQL `DELETE` operations.
- **Plaid token disposal:** Encrypted tokens are deleted from the `plaid_connections` table. Due to AES-256-GCM encryption, the token data is unrecoverable without the encryption key even if database backups are retained.

### 5.2 Email Data

- Gmail OAuth connections can be disconnected at any time, which revokes the stored token.
- Synced email records can be deleted from the `emails` table on demand.

### 5.3 Full Data Disposal

The owner can permanently dispose of all application data at any time by:

1. Revoking all third-party connections (Plaid, Gmail) via their respective provider dashboards
2. Deleting all records from the Supabase database
3. Deleting the Supabase project entirely (removes all data, backups, and storage)
4. Removing environment variables containing API keys from the Vercel deployment

### 5.4 Backup Disposal

Supabase manages automated database backups. Upon project deletion, all backups are removed per Supabase's data disposal procedures. No additional backup systems are maintained by the application.

## 6. Review Schedule

This policy is reviewed annually or whenever a significant change is made to the application's data handling practices. The next scheduled review date is **March 2027**.

## 7. Compliance

This policy is maintained in compliance with applicable data privacy laws and Plaid's data access requirements. The application does not collect data from third-party consumers — the sole user is the application owner.

---

**Approved by:** Daniel Case, Owner & Developer
**Date:** March 16, 2026
