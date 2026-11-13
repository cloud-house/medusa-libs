# @cloud-house/next-medusa

## 0.1.2

### Patch Changes

- 2eb000a: The built `dist/server.*` now imports `next/headers.js` and `next/cache.js`. `next` has no `exports` map, so plain Node ESM (Vitest externalizing the package) could not resolve the extensionless specifiers. A CI test checks the specifiers in `dist` resolve.

## 0.1.1

### Patch Changes

- Updated dependencies [ad45e92]
  - @cloud-house/commerce-rules@0.4.0

## 0.1.0

### Minor Changes

- a9fd827: First release: env check, Medusa JS SDK singleton, cached fetch init with a version header, revalidation route factory and cart cookie for Next 16 storefronts.
