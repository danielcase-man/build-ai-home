# AI Email Summarization Setup

## What's New

Your email summarization is now powered by **Claude AI** instead of OpenAI. This provides:

- ✅ **Action Items** - Automatically identified with priority levels
- ❓ **Questions** - Extracts questions that need answers
- ➡️ **Next Steps** - Identifies planned actions
- 📊 **Key Data Points** - Extracts costs, dates, vendor info, decisions
- 🚨 **Urgent Triage** - Flags emails needing immediate attention
- 💰 **Cost Effective** - Uses efficient models (Haiku for quick tasks, Sonnet for analysis)

## Setup Instructions

### Step 1: Get Your Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to "API Keys" in the dashboard
4. Click "Create Key"
5. Copy your API key (starts with `sk-ant-`)

### Step 2: Add API Key to Environment

Edit your `.env.local` file and replace:

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

With your actual key:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Step 3: Restart the Development Server

If the server is already running:
1. Stop it (Ctrl+C in terminal)
2. Start it again: `npm run dev`

### Step 4: Test It Out

1. Open http://localhost:3000/emails
2. Connect your Gmail if not already connected
3. The AI will automatically analyze your emails and extract:
   - Action items with priority
   - Questions needing answers
   - Key data points (costs, dates, decisions)
   - Urgent matters flagged at the top

## Cost Information

Claude pricing (as of Feb 2026):
- **Haiku** (individual emails): $0.25 per million input tokens, $1.25 per million output
- **Sonnet** (project analysis): $3 per million input tokens, $15 per million output

For typical usage:
- 20 emails/day = ~$0.10-0.30/day
- Much more cost-effective than GPT-4

## Features

### Individual Email Insights
Each email is analyzed to extract:
- **Action Items**: What needs to be done, who should do it, when
- **Questions**: Questions asked and who needs to respond
- **Next Steps**: Planned actions mentioned
- **Key Data**: Costs, dates, vendor names, decisions
- **Summary**: 1-2 sentence impact on project

### Project-Wide Intelligence
Analyzes all recent emails together to provide:
- **Consolidated Action Items**: De-duplicated across emails
- **Open Questions**: Unresolved questions needing answers
- **Urgent Matters**: Time-sensitive items flagged prominently
- **Key Data Points**: All important costs, dates, decisions
- **Overall Status**: Project health based on email patterns

### Priority Triage
Each email is automatically triaged:
- **Critical**: Project blockers, safety issues, legal deadlines
- **High**: Decisions needed this week, vendor coordination
- **Medium**: Information needed, routine updates
- **Low**: FYI, documentation

## Files Changed

- `src/lib/claude-email-agent.ts` - New Claude AI summarization service
- `src/app/api/emails/fetch/route.ts` - Updated to use Claude
- `src/components/EmailInsightsDisplay.tsx` - New UI showing structured insights
- `src/app/emails/page.tsx` - Uses new insights component
- `.env.local` - Added ANTHROPIC_API_KEY

## Troubleshooting

### Error: "ANTHROPIC_API_KEY is not set"
- Make sure you added the key to `.env.local`
- Restart the development server after adding it

### Error: "Invalid API key"
- Check that your key starts with `sk-ant-`
- Make sure you copied the full key
- Regenerate a new key from the Anthropic console

### Old OpenAI errors still showing
- Restart the development server
- Clear your browser cache
- Check that you're using the new `/emails` page at http://localhost:3000/emails

## Need Help?

- Anthropic Console: https://console.anthropic.com/
- Claude API Docs: https://docs.anthropic.com/
- Claude Pricing: https://www.anthropic.com/pricing
