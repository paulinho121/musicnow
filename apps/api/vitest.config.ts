import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Os testes da API usam o banco de desenvolvimento (túnel aberto) e o .env local.
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
