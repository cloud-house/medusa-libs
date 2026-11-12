import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // One StoreUnavailableError class for both entries (instanceof), also in CJS.
  splitting: true,
  target: 'es2022',
  external: ['next', 'server-only', '@medusajs/js-sdk'],
})
