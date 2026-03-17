import { GmailService } from './gmail'
import { db } from './database'
import { env } from './env'
import { encryptTokens, decryptTokens, isEncryptedTokens } from './token-encryption'

/**
 * Returns an authenticated GmailService with fresh tokens, or null if
 * no email account is configured.
 *
 * Single source of truth: tokens always come from the database.
 * If the access token is expired, it is refreshed and the new tokens
 * are persisted (encrypted) back to the database.
 *
 * Legacy unencrypted tokens are transparently migrated to encrypted
 * storage on first access.
 */
export async function getAuthenticatedGmailService(): Promise<GmailService | null> {
  const emailAccount = await db.getEmailAccount(env.gmailUserEmail || '')
  if (!emailAccount?.oauth_tokens) return null

  // Decrypt or handle legacy unencrypted tokens
  let tokens: Record<string, unknown>
  let needsEncryptionMigration = false

  if (isEncryptedTokens(emailAccount.oauth_tokens)) {
    try {
      tokens = decryptTokens(emailAccount.oauth_tokens)
    } catch (error) {
      // Decryption failed — likely TOKEN_ENCRYPTION_KEY changed between deployments.
      // Clear the broken tokens so the user can re-auth.
      console.error('Failed to decrypt OAuth tokens (encryption key mismatch?):', error)
      await db.clearEmailAccountTokens(env.gmailUserEmail || '')
      return null
    }
  } else {
    // Legacy plaintext tokens — use directly, flag for migration
    tokens = emailAccount.oauth_tokens as Record<string, unknown>
    needsEncryptionMigration = true
  }

  const gmailService = new GmailService()
  gmailService.setCredentials({
    access_token: (tokens.access_token as string) || null,
    refresh_token: (tokens.refresh_token as string) || null,
    expiry_date: (tokens.expiry_date as number) || null,
  })

  // Refresh if expired
  if (gmailService.isTokenExpired()) {
    const refreshed = await gmailService.refreshAccessToken()
    if (!refreshed) return null

    // Merge refreshed fields (refresh_token is NOT returned on refresh)
    tokens.access_token = refreshed.access_token
    tokens.expiry_date = refreshed.expiry_date
    needsEncryptionMigration = true // force persist
  }

  // Persist if tokens were refreshed or need encryption migration
  if (needsEncryptionMigration) {
    await db.upsertEmailAccount({
      ...emailAccount,
      oauth_tokens: encryptTokens(tokens),
    })
  }

  return gmailService
}
