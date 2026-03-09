# UBuildIt Process Manager

A comprehensive home construction management application for tracking the UBuildIt process from planning through construction.

## Features

### 📊 Dashboard Overview
- Project phase tracking (Planning vs Construction)
- Timeline visualization with milestones
- Budget vs actual spending
- Daily task management
- Document storage

### 📧 Email Integration
- Gmail sync for UBuildIt team communications
- Vendor email tracking
- Instant notifications for new emails
- AI-powered email summarization
- Historical email import

### 📝 Daily Project Status
- One-page summary for family members
- Current hot topics and action items
- Recent decisions and changes
- Budget snapshots
- AI-generated project summaries

### 💰 Budget Management
- Line-item tracking from Cost Review
- Bid collection and comparison
- Change order management
- Lender draw reports

### 📅 Timeline & Milestones
- 6-step Planning Phase tracking
- Construction phase management
- Automated task generation
- Deadline alerts

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Email**: Gmail API
- **AI**: OpenAI API for summarization
- **Hosting**: Vercel

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Supabase account
3. Google Cloud Console account (for Gmail API)
4. OpenAI API key
5. Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/[your-username]/ubuildit-manager.git
cd ubuildit-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Fill in your API keys and configuration

4. Set up Supabase:
   - Create a new Supabase project
   - Run the migrations in `supabase/migrations`
   - Copy your project URL and keys to `.env.local`

5. Configure Gmail API:
   - Go to Google Cloud Console
   - Create a new project or select existing
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`

6. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
ubuildit-manager/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── (dashboard)/      # Main dashboard pages
│   │   ├── project-status/   # Daily status page
│   │   └── api/             # API routes
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   └── features/       # Feature-specific components
│   ├── lib/                # Utility functions
│   │   ├── supabase/       # Supabase client
│   │   ├── gmail/          # Gmail integration
│   │   └── openai/         # OpenAI integration
│   └── types/              # TypeScript type definitions
├── supabase/               # Supabase migrations and functions
└── public/                 # Static assets
```

## Environment Variables

See `.env.local.example` for all required environment variables.

Key variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `OPENAI_API_KEY`: Your OpenAI API key
- `GOOGLE_CLIENT_ID`: Gmail OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Gmail OAuth client secret

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

## Usage

### Initial Setup
1. Connect your Gmail account
2. Import historical emails
3. Set up your project details
4. Add team contacts

### Daily Workflow
1. Check dashboard for today's tasks
2. Review new emails and notifications
3. Update progress on milestones
4. Log any decisions or changes

### Project Status Page
Access `/project-status` for the daily summary page designed for family members to stay informed.

## Contact Information

**UBuildIt Williamson Team**
- Office: 212 W 10th St, Georgetown TX 78626
- Phone: (512) 828-3187
- Email: Williamson.tx@ubuildit.com

## License

This project is private and proprietary.
