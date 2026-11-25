import { defineConfig } from 'tsup'

/** The panel building blocks for a shop's admin code; React and the Medusa admin stay the shop's own. */
export default defineConfig({
  entry: { 'admin-kit': 'src/admin/kit.ts' },
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  tsconfig: 'src/admin/tsconfig.json',
  dts: true,
  clean: true,
  target: 'es2022',
  external: [
    'react',
    'react-dom',
    'react-router-dom',
    '@medusajs/ui',
    '@medusajs/icons',
    '@medusajs/js-sdk',
    '@medusajs/admin-sdk',
    '@tanstack/react-query',
  ],
})
