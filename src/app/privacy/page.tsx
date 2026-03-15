import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — FrameWork',
  description: 'Privacy policy for the FrameWork construction project management application.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-3xl py-12 px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: March 15, 2026
        </p>
      </header>

      <div className="space-y-10 text-[15px] leading-relaxed text-foreground/90">
        {/* Introduction */}
        <section>
          <p>
            FrameWork is a personal construction project management application
            built and operated by Daniel Case. It is not a commercial product and
            is not offered to the general public. This privacy policy describes
            how the application collects, uses, and protects data in connection
            with managing a single home construction project.
          </p>
        </section>

        {/* 1. Data Collection */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            1. Information Collected
          </h2>
          <p className="mb-3">
            FrameWork collects and processes the following categories of data,
            all initiated by the application owner:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="font-medium">Bank account and transaction data</span>{' '}
              — Connected via Plaid to retrieve account balances and transaction
              history for construction expense tracking and vendor payment
              reconciliation.
            </li>
            <li>
              <span className="font-medium">Email messages</span> — Synced from
              Gmail via the Google Gmail API to track vendor communications, bid
              submissions, and project correspondence.
            </li>
            <li>
              <span className="font-medium">Construction project data</span> —
              Budget line items, bids, vendor contacts, milestones, tasks,
              permits, documents, and daily logs entered directly or synced from
              JobTread.
            </li>
            <li>
              <span className="font-medium">AI-generated summaries</span> —
              Derived from the data above using the Anthropic Claude API to
              produce status reports, email summaries, and project insights.
            </li>
          </ul>
        </section>

        {/* 2. How Data is Used */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            2. How Data is Used
          </h2>
          <p className="mb-3">
            All collected data is used exclusively for managing the owner&apos;s
            personal home construction project:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Tracking construction expenses against the project budget</li>
            <li>Matching bank transactions to vendor invoices and budget categories</li>
            <li>Monitoring vendor and contractor communications</li>
            <li>Generating project status reports and actionable insights</li>
            <li>Managing construction milestones, tasks, and timelines</li>
          </ul>
          <p className="mt-3">
            Data is never sold, shared with advertisers, or used for any purpose
            other than personal project management.
          </p>
        </section>

        {/* 3. Data Storage & Security */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            3. Data Storage and Security
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Application data is stored in a <span className="font-medium">Supabase</span> PostgreSQL
              database with Row-Level Security (RLS) enabled on all tables.
            </li>
            <li>
              OAuth tokens (Gmail, Plaid) are encrypted at rest using{' '}
              <span className="font-medium">AES-256-GCM</span> before storage.
            </li>
            <li>
              All data in transit is protected with{' '}
              <span className="font-medium">TLS 1.2+</span> encryption.
            </li>
            <li>
              Plaid access tokens are stored encrypted and are never exposed to
              the browser. All Plaid API communication occurs server-side.
            </li>
            <li>
              The application is deployed on Vercel with HTTPS enforced on all
              endpoints.
            </li>
          </ul>
        </section>

        {/* 4. Third-Party Services */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            4. Third-Party Services
          </h2>
          <p className="mb-3">
            FrameWork integrates with the following third-party services, each
            governed by their own privacy policies:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <span className="font-medium">Plaid</span> — Bank account
              connection and transaction retrieval.{' '}
              <a
                href="https://plaid.com/legal/#end-user-privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Plaid Privacy Policy
              </a>
            </li>
            <li>
              <span className="font-medium">Google (Gmail API)</span> — Email
              synchronization with read-only access to the owner&apos;s Gmail
              account.{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Google Privacy Policy
              </a>
            </li>
            <li>
              <span className="font-medium">Anthropic (Claude API)</span> — AI
              processing for email summaries, project status reports, and
              insights. Data sent to Anthropic is processed per their{' '}
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Privacy Policy
              </a>{' '}
              and is not used to train models.
            </li>
            <li>
              <span className="font-medium">Supabase</span> — Database hosting
              and file storage.{' '}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Supabase Privacy Policy
              </a>
            </li>
            <li>
              <span className="font-medium">Vercel</span> — Application hosting
              and deployment.{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Vercel Privacy Policy
              </a>
            </li>
          </ul>
        </section>

        {/* 5. Data Retention & Deletion */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            5. Data Retention and Deletion
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Data is retained for the duration of the construction project and
              any applicable warranty periods.
            </li>
            <li>
              Bank account connections through Plaid can be revoked at any time,
              which stops further transaction syncing. Previously synced
              transactions remain stored until manually deleted.
            </li>
            <li>
              Gmail connections can be disconnected, and synced email data can be
              deleted from the database on request.
            </li>
            <li>
              All stored data can be permanently deleted by the owner at any time
              by removing records from the database or deleting the Supabase
              project.
            </li>
          </ul>
        </section>

        {/* 6. Contact */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">
            6. Contact
          </h2>
          <p>
            For questions about this privacy policy or data handling practices,
            contact:
          </p>
          <p className="mt-2 font-medium">
            Daniel Case
            <br />
            <a
              href="mailto:danielcase.info@gmail.com"
              className="text-primary underline underline-offset-2 hover:text-primary/80 font-normal"
            >
              danielcase.info@gmail.com
            </a>
          </p>
        </section>

        {/* Footer note */}
        <section className="border-t pt-6 mt-10">
          <p className="text-sm text-muted-foreground">
            This policy may be updated from time to time. Changes will be
            reflected on this page with an updated revision date.
          </p>
        </section>
      </div>
    </div>
  )
}
