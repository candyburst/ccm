import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include:     ['packages/core/src/__tests__/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include:  ['packages/core/src/**/*.js'],
      exclude:  ['packages/core/src/index.js', 'packages/core/src/__tests__/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
    globals:    true,
    clearMocks: true,
  },
})
