// ============================================================
// Validated Environment Variable Access
// Replaces scattered process.env.X! assertions
// ============================================================

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue?: string): string | undefined {
  return process.env[name] ?? defaultValue
}

export const env = {
  // Supabase
  get supabaseUrl() { return requiredEnv('NEXT_PUBLIC_SUPABASE_URL') },
  get supabaseAnonKey() { return requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') },

  // Google OAuth
  get googleClientId() { return requiredEnv('GOOGLE_CLIENT_ID') },
  get googleClientSecret() { return requiredEnv('GOOGLE_CLIENT_SECRET') },
  get googleRedirectUri() { return requiredEnv('GOOGLE_REDIRECT_URI') },

  // AI
  get anthropicApiKey() { return optionalEnv('ANTHROPIC_API_KEY') },

  // Gmail
  get gmailUserEmail() { return optionalEnv('GMAIL_USER_EMAIL', '') },

  // Cron
  get cronSecret() { return optionalEnv('CRON_SECRET') },

  // Project
  get projectAddress() { return optionalEnv('PROJECT_ADDRESS', '708 Purple Salvia Cove, Liberty Hill, TX') },
  get projectName() { return optionalEnv('PROJECT_NAME', 'Purple Salvia Cove Construction') },

  // Document Repository
  get documentRepositoryPath() {
    return optionalEnv('DOCUMENT_REPOSITORY_PATH',
      '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove')
  },

  // Supabase Service Role (for seed scripts)
  get supabaseServiceRoleKey() { return optionalEnv('SUPABASE_SERVICE_ROLE_KEY') },

  // JobTread
  get jobtreadApiKey() { return optionalEnv('JOBTREAD_API_KEY') },
  get jobtreadApiUrl() { return optionalEnv('JOBTREAD_API_URL', 'https://api.jobtread.com/pave') },
  get jobtreadOrgId() { return optionalEnv('JOBTREAD_ORG_ID', '22P8e7iPShMR') },
  get jobtreadJobId() { return optionalEnv('JOBTREAD_JOB_ID', '22PEVyJVCikd') },

  // Plaid
  get plaidClientId() { return optionalEnv('PLAID_CLIENT_ID') },
  get plaidSecret() { return optionalEnv('PLAID_SECRET') },
  get plaidEnv() { return optionalEnv('PLAID_ENV', 'sandbox') },
  get plaidWebhookUrl() { return optionalEnv('PLAID_WEBHOOK_URL') },

  // App
  get vercelUrl() { return optionalEnv('VERCEL_URL') },
  get nodeEnv() { return optionalEnv('NODE_ENV', 'development') },
} as const
