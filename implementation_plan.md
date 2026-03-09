# Implementation Plan

## Overview
Integrate core email reading and AI summarization features from UBuildIt Manager into Build AI Home's existing project management workflow to provide construction-focused email insights.

This implementation will extract the essential email reading and summarization capabilities from UBuildIt Manager and adapt them to work within Build AI Home's React/Vite architecture with existing Supabase integration. The focus is on providing construction project stakeholders with AI-powered email insights without the complexity of full email management system. The feature will integrate seamlessly into the existing project management interface, enhancing the platform's ability to track construction project communications and extract actionable insights.

## Types
Define TypeScript interfaces and types for email data structures and AI summaries.

```typescript
// Email interfaces
export interface Email {
  id: string
  subject: string
  from: string
  body: string
  date: string
  snippet: string
}

export interface EmailSummary {
  hotTopics: string[]
  actionItems: string[]
  decisions: string[]
  concerns: string[]
  nextSteps: string[]
  overallStatus: string
}

export interface GmailCredentials {
  access_token: string
  refresh_token?: string
}

// Component props
export interface EmailDisplayProps {
  projectId?: string
  maxEmails?: number
  refreshInterval?: number
}

export interface GmailAuthProps {
  onAuthSuccess?: (credentials: GmailCredentials) => void
  onAuthError?: (error: string) => void
}
```

## Files
Adaptation of UBuildIt Manager email components and services for Build AI Home architecture.

**New Files to Create:**
- `src/lib/gmail-service.ts` - Gmail API integration service adapted for Vite/React
- `src/lib/openai-service.ts` - OpenAI email summarization service
- `src/components/EmailInsights.tsx` - Main email display component for project management integration
- `src/components/GmailAuth.tsx` - Gmail authentication component
- `src/api/gmail-auth.ts` - Gmail OAuth handling (adapted for Build AI Home's API structure)
- `src/api/fetch-emails.ts` - Email fetching API endpoint
- `src/hooks/useEmails.ts` - React hook for email management
- `src/types/email.ts` - Email-related TypeScript types

**Files to Modify:**
- `package.json` - Add googleapis and openai dependencies
- `src/env.ts` or environment config - Add Gmail and OpenAI API keys
- Main project management page/component - Integrate EmailInsights component
- `supabase/migrations/` - Add email tables if needed for caching

**Configuration Updates:**
- `.env` file additions for API keys and OAuth configuration
- Supabase environment variables for database connection

## Functions
Core functionality extracted and adapted from UBuildIt Manager.

**New Functions:**
- `GmailService.authenticate()` - Handle Gmail OAuth flow
- `GmailService.fetchEmails(query: string)` - Fetch emails from Gmail API
- `GmailService.parseEmailData(rawEmail)` - Parse Gmail API response
- `OpenAIService.summarizeEmail(email: Email)` - Generate individual email summary
- `OpenAIService.summarizeProjectEmails(emails: Email[])` - Generate project overview
- `EmailHooks.useGmailAuth()` - Manage Gmail authentication state
- `EmailHooks.useEmailFetch()` - Fetch and cache emails
- `EmailHooks.useEmailSummaries()` - Manage AI summaries

**Adapted Functions:**
- Simplified email parsing (remove complex HTML processing)
- Streamlined OAuth handling for client-side React app
- Lightweight caching mechanism (localStorage or minimal Supabase)

## Classes
Object-oriented services for Gmail and OpenAI integration.

**New Classes:**
- `GmailService` - Gmail API interactions
  - Methods: `authenticate()`, `setCredentials()`, `fetchEmails()`, `parseEmail()`
  - Properties: `oauth2Client`, `isAuthenticated`
  - Location: `src/lib/gmail-service.ts`

- `OpenAIService` - AI summarization
  - Methods: `summarizeIndividualEmail()`, `summarizeProjectEmails()`, `generateInsights()`
  - Properties: `apiKey`, `client`
  - Location: `src/lib/openai-service.ts`

**Modified Classes:**
- Adapt UBuildIt Manager's class structure to work with React/Vite instead of Next.js
- Remove server-side specific functionality
- Simplify database interactions for client-side caching

## Dependencies
Package additions required for email and AI functionality.

```json
{
  "googleapis": "^155.0.1",
  "openai": "^5.12.2"
}
```

Additional considerations:
- Ensure React/Vite compatibility for googleapis package
- May need to configure Vite for OAuth redirect handling
- OpenAI package should work directly in browser environment with proper API key management

## Testing
Testing approach for email integration features.

**Component Testing:**
- `EmailInsights.tsx` - Test email display, loading states, error handling
- `GmailAuth.tsx` - Test authentication flow, success/error callbacks
- Email hooks - Test data fetching, caching, state management

**Integration Testing:**
- Gmail API integration - Test OAuth flow, email fetching
- OpenAI API integration - Test summarization accuracy, error handling
- End-to-end email workflow from authentication to summary display

**Manual Testing:**
- OAuth flow in development environment
- Email parsing with various email formats
- AI summary quality with construction-related emails

## Implementation Order
Sequential steps to minimize conflicts and ensure successful integration.

1. **Setup Dependencies and Environment** - Install packages, configure environment variables, setup OAuth credentials
2. **Create Core Services** - Implement GmailService and OpenAIService classes with basic functionality
3. **Build Authentication Component** - Create GmailAuth component and OAuth flow
4. **Develop Email Display Component** - Create EmailInsights component with basic email listing
5. **Implement AI Summarization** - Add OpenAI integration and summary generation
6. **Create React Hooks** - Develop useEmails and useGmailAuth hooks for state management
7. **Integrate with Project Management** - Add EmailInsights to existing project management interface
8. **Add Error Handling and Loading States** - Implement comprehensive error handling and user feedback
9. **Setup Caching Strategy** - Implement localStorage or minimal Supabase caching for performance
10. **Testing and Refinement** - Test all components, fix bugs, optimize performance
11. **Documentation and Deployment** - Document usage, test in production environment
