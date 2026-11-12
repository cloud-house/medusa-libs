# @cloud-house/next-medusa

Next.js 16 storefront helpers for Medusa 2 shops. ESM + CJS, with types.

```sh
pnpm add @cloud-house/next-medusa @medusajs/js-sdk server-only
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peers: `next` `^16.3.3`, `@medusajs/js-sdk`, `server-only`.

## Entries

### `@cloud-house/next-medusa` (client-safe)

- `StoreUnavailableError` – the store cannot fetch data from Medusa
- `cachedInit({ tags, revalidate, versionHeader?, version? })` – `fetch` init with `cache: 'force-cache'`, `next: { tags, revalidate }` and, when both `versionHeader` and `version` are given, a version header. The backend ignores it; the `fetch` cache key includes headers, so bumping `version` drops entries of an old shape.

### `@cloud-house/next-medusa/server` (imports `server-only`)

- `medusaEnv({ defaultBackendUrl = 'http://localhost:9000', missingKeyMessage? })` – reads `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY`; a missing key throws `StoreUnavailableError`
- `createSdkGetter(env)` – lazy `Medusa` SDK singleton (`debug` in development)
- `revalidateTags(tags)` – dedupes, `revalidateTag(tag, { expire: 0 })`, ignores only the "outside a Next request" error
- `createRevalidateRoute(options)` – `{ POST }` for `app/api/revalidate/route.ts`
- `createCartCookie({ name, maxAgeDays = 30 })` – `getCartId()` / `setCartId()` / `removeCartId()`; httpOnly, `sameSite: 'lax'`, `secure` in production, path `/`
- also re-exports `StoreUnavailableError`, `REVALIDATE_ROUTE_MESSAGES`, `MAX_TAGS`

```ts
// app/api/revalidate/route.ts
import { createRevalidateRoute } from '@cloud-house/next-medusa/server'

export const { POST } = createRevalidateRoute()
```

## Revalidation route options

| Option | Default | Meaning |
| --- | --- | --- |
| `secretEnv` | `REVALIDATE_SECRET` | env var with the shared secret; unset means every request gets 401 |
| `header` | `x-revalidate-secret` | request header carrying the secret |
| `isAllowedTag` | `isKitTagAllowed` | allowlist (see `createTagRules` in `@cloud-house/commerce-rules`) |
| `locale` | `pl` | `pl` or `en` texts (`REVALIDATE_ROUTE_MESSAGES`) |
| `messages` | – | override `unauthorized`, `invalidTags(max)`, `secretMissing(env)`; `undefined` values are ignored |
| `logPrefix` | `next-medusa` | prefix of the log line |

Responses: 401 (bad or missing secret), 400 (not 1-100 allowed tags of at most 256 characters), `{ revalidated: string[] }`.
