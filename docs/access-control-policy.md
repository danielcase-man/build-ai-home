# Access Control Policy

**Organization:** Daniel Case — FrameWork Application
**Effective Date:** March 16, 2026
**Last Reviewed:** March 16, 2026
**Next Review:** March 2027
**Owner:** Daniel Case — danielcase.info@gmail.com

---

## 1. Purpose

This policy defines the access controls for all systems and data associated with the FrameWork application to ensure that consumer financial data and other sensitive information is appropriately protected.

## 2. Scope

This policy applies to all infrastructure, platforms, APIs, and data stores used by the FrameWork application.

## 3. Access Control Principles

- **Least Privilege:** All credentials, tokens, and API keys are scoped to the minimum permissions required for their function.
- **Single Operator:** FrameWork is operated by a single individual (the owner). There are no employees, contractors, or additional users with access to any system.
- **Zero Trust:** No implicit trust between application components. Every request is authenticated and authorized independently.

## 4. System Access Inventory

| System | Purpose | Auth Method | MFA | Access Level |
|---|---|---|---|---|
| **GitHub** | Source code repository | Password + SSH key | Yes | Owner (sole account) |
| **Vercel** | Application hosting & deployment | OAuth (GitHub SSO) | Yes | Owner (sole account) |
| **Supabase** | Database & storage | Password | Yes | Owner (sole account) |
| **Plaid Dashboard** | Financial data API management | Password | Yes | Owner (sole account) |
| **Google Cloud Console** | Gmail API OAuth credentials | Google account | Yes | Owner (sole account) |
| **Anthropic Console** | Claude AI API keys | Password | Yes | Owner (sole account) |

## 5. Authentication Requirements

### 5.1 Infrastructure Accounts
- All infrastructure accounts listed above require multi-factor authentication (MFA).
- Passwords must be unique per service and stored in a password manager.
- SSH keys are used for GitHub repository access (Ed25519).

### 5.2 Application-Level Authentication
- API routes are protected by session-based middleware using httpOnly, secure, SameSite=Lax cookies.
- Session tokens are derived from a server-side secret and validated on every API request.
- Public API routes (OAuth callbacks, cron endpoints) use their own authentication mechanisms (OAuth flow, Bearer token).

### 5.3 Third-Party API Authentication
- **Plaid:** Client ID + Secret (server-side only, never exposed to browser)
- **Gmail:** OAuth2 with offline refresh tokens, encrypted with AES-256-GCM
- **Anthropic:** API key (server-side only)
- **JobTread:** Grant key scoped to a single project (server-side only)

## 6. Token and Credential Management

### 6.1 Storage
- All API keys and secrets are stored as environment variables in Vercel (production) and .env.local (development).
- OAuth tokens (Gmail, Plaid) are encrypted with AES-256-GCM before storage in the database.
- No credentials are stored in source code, client-side storage, or cookies.

### 6.2 Rotation
- API keys are rotated if a compromise is suspected or when recommended by the service provider.
- OAuth refresh tokens are automatically rotated by the token refresh flow.
- The AES-256-GCM encryption key can be rotated by updating the TOKEN_ENCRYPTION_KEY environment variable and re-encrypting stored tokens.

### 6.3 Revocation
- Plaid connections can be revoked instantly via the application UI or Plaid Dashboard.
- Gmail OAuth tokens can be revoked via Google Account settings.
- API keys can be regenerated in their respective provider dashboards.

## 7. Access Reviews

As a single-operator application:
- **Frequency:** Semi-annual (every 6 months)
- **Process:** The owner reviews all active credentials, API keys, and OAuth connections. Unused or stale credentials are revoked. MFA status is verified on all accounts.
- **Next Review:** September 2026

## 8. De-Provisioning

- **No employees or contractors** have access to any FrameWork system.
- If the owner transfers or ceases operation of the application:
  1. All Plaid connections are revoked via the Plaid Dashboard
  2. All OAuth tokens (Gmail) are revoked via Google Account settings
  3. All API keys (Anthropic, JobTread) are deleted from provider dashboards
  4. The Supabase project is deleted (removes all data and backups)
  5. Environment variables are removed from Vercel
  6. The Vercel project is deleted

## 9. Centralized Identity Management

All FrameWork systems are accessed under a single identity (danielcase.info@gmail.com) with:
- Google SSO where supported (Vercel)
- MFA enabled on all accounts
- Unique strong passwords per service
- No shared or service accounts

## 10. Policy Review

This policy is reviewed semi-annually or when infrastructure changes occur. The next review is scheduled for September 2026.

---

**Approved by:** Daniel Case, Owner & Developer
**Date:** March 16, 2026
