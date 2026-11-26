import { defineConfig } from 'tsup'

const shared = {
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  dts: true,
  target: 'es2022' as const,
  external: ['next', 'react', 'server-only', '@medusajs/js-sdk'],
}

export default defineConfig([
  {
    ...shared,
    entry: ['src/index.ts', 'src/server.ts'],
    clean: false,
    splitting: true,
  },
  {
    // Next needs the directive at the very top of the client entry; a banner on the whole
    // build would also mark the server entry.
    ...shared,
    entry: ['src/live-preview.ts'],
    clean: false,
    banner: { js: "'use client'" },
  },
])
