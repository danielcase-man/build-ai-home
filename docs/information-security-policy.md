# Information Security Policy (ISP)

**Organization:** Daniel Case — FrameWork Application
**Effective Date:** March 16, 2026
**Last Reviewed:** March 16, 2026
**Next Review:** March 2027
**Owner:** Daniel Case — danielcase.info@gmail.com

---

## 1. Purpose

This policy establishes the information security requirements for the FrameWork construction project management application. FrameWork is a single-user, non-commercial application operated solely by its owner.

## 2. Scope

This policy covers all systems, data, and infrastructure used to develop, deploy, and operate the FrameWork application, including:

- Application source code (GitHub)
- Production deployment (Vercel)
- Database and storage (Supabase PostgreSQL)
- Third-party API integrations (Plaid, Gmail, Anthropic Claude, JobTread)
- Development environment (local workstation)

## 3. Roles and Responsibilities

| Role | Person | Responsibility |
|---|---|---|
| Owner / Operator | Daniel Case | All security responsibilities: policy, implementation, monitoring, incident response |

As a single-operator application, all security functions are performed by the owner.

## 4. Access Control

- **Principle of Least Privilege:** All API keys, tokens, and credentials are scoped to the minimum required permissions.
- **Multi-Factor Authentication (MFA):** Required on all infrastructure accounts (Vercel, Supabase, GitHub, Google, Plaid).
- **No Shared Accounts:** All accounts are individual accounts under the owner's control.
- **Session Management:** Application API routes are protected by session-based middleware. Sessions are httpOnly, secure, and SameSite=Lax.
- **Database Security:** Row-Level Security (RLS) is enabled on all Supabase tables.
- See the Access Control Policy for detailed access controls.

## 5. Data Protection

### 5.1 Encryption in Transit
- All client-server communication uses TLS 1.2+ enforced by Vercel.
- All database connections use TLS (enforced by Supabase).
- All third-party API calls (Plaid, Gmail, Anthropic) use HTTPS/TLS.

### 5.2 Encryption at Rest
- OAuth tokens (Gmail, Plaid) are encrypted using AES-256-GCM with random initialization vectors and authentication tags before database storage.
- Encryption keys are stored as environment variables, never in source code.
- The Supabase database provides additional at-rest encryption at the storage layer.

### 5.3 Sensitive Data Handling
- API keys and secrets are stored exclusively in environment variables (.env.local, Vercel environment settings).
- Secrets are excluded from version control via .gitignore.
- Financial tokens (Plaid access tokens) are never exposed to the browser; all Plaid communication is server-side.

## 6. Infrastructure Security

### 6.1 Production Environment
- **Hosting:** Vercel serverless functions — no user-managed servers, OS patches, or network configuration.
- **Database:** Supabase managed PostgreSQL — automated backups, encryption at rest, network isolation.
- **Zero Trust Architecture:** No implicit trust between components. API routes require session authentication. Database requires RLS policy evaluation. External APIs require per-request credentials.

### 6.2 Development Environment
- Source code stored in a private GitHub repository with MFA-protected access.
- Development secrets in .env.local, excluded from version control.
- No production credentials stored in code or committed to the repository.

## 7. Vulnerability Management

- **Dependency Scanning:** GitHub Dependabot monitors dependencies for known vulnerabilities.
- **Package Auditing:** `npm audit` is run periodically to identify vulnerable packages.
- **Platform Patching:** Vercel and Supabase manage all OS-level and infrastructure patching as managed services.
- **Code Review:** All code changes are reviewed before deployment.

## 8. Incident Response

In the event of a suspected security incident:

1. **Identify:** Detect the issue via application logs (Vercel), database audit logs (Supabase), or third-party notifications.
2. **Contain:** Revoke affected credentials immediately (rotate API keys, revoke OAuth tokens, disable Plaid connections).
3. **Remediate:** Patch the vulnerability, deploy the fix, and issue new credentials.
4. **Notify:** If consumer financial data is affected, notify Plaid per their incident notification requirements.
5. **Review:** Document the incident and update security controls to prevent recurrence.

## 9. Secure Development Practices

- No secrets or credentials in source code.
- Input validation on all API route handlers.
- Server-side rendering by default (Next.js Server Components) to minimize client-side attack surface.
- Session-based CSRF protection via httpOnly cookies with SameSite=Lax.
- Content Security Policy headers enforced by Vercel.

## 10. Data Retention and Disposal

See the Data Retention and Disposal Policy for detailed retention schedules and disposal procedures.

## 11. Policy Review

This policy is reviewed annually or when significant changes are made to the application's architecture, data handling, or third-party integrations. The next review is scheduled for March 2027.

---

**Approved by:** Daniel Case, Owner & Developer
**Date:** March 16, 2026
