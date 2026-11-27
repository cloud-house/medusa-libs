import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cart: 'src/cart/index.ts',
    checkout: 'src/checkout/index.ts',
    newsletter: 'src/newsletter/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  // One copy of the cart client for the cart and checkout entries.
  splitting: true,
  target: 'es2022',
  external: ['resend', '@stripe/stripe-js', '@medusajs/types'],
})
