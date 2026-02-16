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
  get openaiApiKey() { return optionalEnv('OPENAI_API_KEY') },
  get anthropicApiKey() { return optionalEnv('ANTHROPIC_API_KEY') },

  // Gmail
  get gmailUserEmail() { return optionalEnv('GMAIL_USER_EMAIL', '') },

  // Cron
  get cronSecret() { return optionalEnv('CRON_SECRET') },

  // App
  get vercelUrl() { return optionalEnv('VERCEL_URL') },
  get nodeEnv() { return optionalEnv('NODE_ENV', 'development') },
} as const
