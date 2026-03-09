import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**', 'mcp-servers/**'],
    env: {
      // Dummy values so Supabase client can initialize without real credentials
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      // Encryption key for token-encryption tests
      TOKEN_ENCRYPTION_KEY: 'test-encryption-key-for-vitest',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/components/**',
        'src/hooks/**',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/lib/seed-parsers.ts',
        'src/lib/security-testing.ts',
        'src/lib/document-analyzer.ts',
      ],
      thresholds: {
        statements: 40,
        functions: 37,
        lines: 41,
        branches: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
