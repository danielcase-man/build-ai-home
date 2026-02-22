import crypto from 'crypto'
import type { EncryptedTokens } from '@/types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.CRON_SECRET || ''
  if (!secret) {
    throw new Error('No encryption key available. Set TOKEN_ENCRYPTION_KEY or CRON_SECRET.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptTokens(tokens: Record<string, unknown>): EncryptedTokens {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const plaintext = JSON.stringify(tokens)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag()

  return {
    _encrypted: true,
    iv: iv.toString('hex'),
    data: encrypted,
    tag: tag.toString('hex'),
  }
}

export function decryptTokens(payload: EncryptedTokens): Record<string, unknown> {
  const key = getEncryptionKey()
  const iv = Buffer.from(payload.iv, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'))

  let decrypted = decipher.update(payload.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}

export function isEncryptedTokens(value: unknown): value is EncryptedTokens {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_encrypted' in value &&
    (value as EncryptedTokens)._encrypted === true
  )
}
