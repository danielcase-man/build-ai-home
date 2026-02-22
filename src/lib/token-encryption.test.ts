import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptTokens, decryptTokens, isEncryptedTokens } from './token-encryption'

describe('token-encryption', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // TOKEN_ENCRYPTION_KEY is set in vitest.config.ts env
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('encryptTokens / decryptTokens round-trip', () => {
    it('preserves data through encrypt → decrypt', () => {
      const tokens = {
        access_token: 'ya29.test-access-token',
        refresh_token: '1//test-refresh-token',
        expiry_date: 1700000000000,
      }
      const encrypted = encryptTokens(tokens)
      const decrypted = decryptTokens(encrypted)
      expect(decrypted).toEqual(tokens)
    })

    it('produces different ciphertext for same input (random IV)', () => {
      const tokens = { access_token: 'same-token' }
      const a = encryptTokens(tokens)
      const b = encryptTokens(tokens)
      expect(a.data).not.toBe(b.data)
      expect(a.iv).not.toBe(b.iv)
    })
  })

  describe('encrypted output shape', () => {
    it('has _encrypted, iv, data, tag fields', () => {
      const encrypted = encryptTokens({ test: true })
      expect(encrypted._encrypted).toBe(true)
      expect(typeof encrypted.iv).toBe('string')
      expect(typeof encrypted.data).toBe('string')
      expect(typeof encrypted.tag).toBe('string')
    })
  })

  describe('isEncryptedTokens', () => {
    it('returns true for encrypted output', () => {
      const encrypted = encryptTokens({ test: true })
      expect(isEncryptedTokens(encrypted)).toBe(true)
    })

    it('returns false for plain object', () => {
      expect(isEncryptedTokens({ access_token: 'abc' })).toBe(false)
    })

    it('returns false for null', () => {
      expect(isEncryptedTokens(null)).toBe(false)
    })

    it('returns false for non-object', () => {
      expect(isEncryptedTokens('string')).toBe(false)
      expect(isEncryptedTokens(42)).toBe(false)
    })
  })

  describe('error handling', () => {
    it('throws when no encryption key is available', () => {
      const saved = process.env.TOKEN_ENCRYPTION_KEY
      const savedCron = process.env.CRON_SECRET
      delete process.env.TOKEN_ENCRYPTION_KEY
      delete process.env.CRON_SECRET
      try {
        expect(() => encryptTokens({ test: true })).toThrow('No encryption key')
      } finally {
        process.env.TOKEN_ENCRYPTION_KEY = saved
        if (savedCron !== undefined) process.env.CRON_SECRET = savedCron
      }
    })

    it('throws on tampered ciphertext', () => {
      const encrypted = encryptTokens({ test: true })
      // Flip a character in the encrypted data
      encrypted.data = encrypted.data.slice(0, -1) + (encrypted.data.slice(-1) === '0' ? '1' : '0')
      expect(() => decryptTokens(encrypted)).toThrow()
    })
  })
})
