---
'@cloud-house/next-medusa': patch
---

The built `dist/server.*` now imports `next/headers.js` and `next/cache.js`. `next` has no `exports` map, so plain Node ESM (Vitest externalizing the package) could not resolve the extensionless specifiers. A CI test checks the specifiers in `dist` resolve.
