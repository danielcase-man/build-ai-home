import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      // Dummy values so Supabase client can initialize without real credentials
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      // Encryption key for token-encryption tests
      TOKEN_ENCRYPTION_KEY: 'test-encryption-key-for-vitest',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
