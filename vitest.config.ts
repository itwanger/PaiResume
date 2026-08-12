import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'tests/components/**/*.test.tsx',
      'tests/admin/**/*.test.tsx',
    ],
    setupFiles: ['./tests/components/setup.ts'],
  },
})
