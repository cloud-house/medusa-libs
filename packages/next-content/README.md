# @cloud-house/next-content

Storefront side of `@cloud-house/medusa-content` for Next.js 16: content client for `/store/content/*`, preview session and routes, Lexical → JSX renderer and the live preview refresh. No styles and no shop texts; components stay in the shop.

```sh
pnpm add @cloud-house/next-content @medusajs/js-sdk server-only
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peers: `next` `^16.3.3`, `react` `^19`, `@medusajs/js-sdk`, `server-only`.

## Entries

- `@cloud-house/next-content` (client-safe): `createContentClient`, `renderLexical`, types `ReadMode`, `LexicalNode`, `LexicalConverters`, `DatedSlug`.
- `@cloud-house/next-content/server` (imports `server-only`): `createPreviewSession`, `createPreviewRoutes`.
- `@cloud-house/next-content/live-preview` (`'use client'`): `LivePreviewRefresh`, `isPreviewRefreshMessage`.

## Content client

```ts
// lib/content-client.ts
import { createContentClient } from '@cloud-house/next-content'
import { getSdk } from '@/lib/medusa/sdk'

export const contentClient = createContentClient({
  fetch: (path, init) => getSdk().client.fetch(path, init),
  viewVersion: 5, // bump when the view shapes change; sent in `versionHeader`
  versionHeader: 'x-shop-content-version',
})

// published read, cached with tags; edits purge them (medusa-revalidation)
const layout = await contentClient.layout({ tags: ['cms'] })
```

| Option | Default | Meaning |
| --- | --- | --- |
| `fetch` | – | `(path, init) => sdk.client.fetch(path, init)` |
| `viewVersion`, `versionHeader` | – | version of the cached shapes; the backend ignores the header, the `fetch` cache key includes it |
| `revalidate` | `3600` | safety-net seconds of a published read |
| `previewHeader` | `x-preview-token` | header with the panel's token |

Readers (all take a `ReadMode`: `{ tags }` for the cached published state, `{ previewToken }` for the working copy with `cache: 'no-store'` and `?draft=1`): `catalog(type, handle)`, `page`, `pageIndex`, `article`, `articleList`, `articleSummaries`, `articleCategories`, `articleCategory`, `home`, `layout`, `moved`, `sitemap`, and `kind(path, mode, query?)` for routes of the shop's own kinds. Path segments are URL-encoded.

## Preview

```ts
// lib/preview.ts
import { createPreviewSession } from '@cloud-house/next-content/server'
export const preview = createPreviewSession({ cookieName: 'shop_preview' })

// in a data function
const mode = await preview.readMode(['cms', 'pages'], draft) // { tags } or { previewToken }

// app/api/preview/route.ts
import { createPreviewRoutes } from '@cloud-house/next-content/server'
export const { GET } = createPreviewRoutes({ cookieName: 'shop_preview' }).enter

// app/api/preview/exit/route.ts
export const { POST } = createPreviewRoutes({ cookieName: 'shop_preview' }).exit
```

The secret is read from `CONTENT_PREVIEW_SECRET` (option `secretEnv`) and must match `previewSecret` of the plugin. `enter.GET` returns 401 without a valid token and 400 for an invalid `slug`/`collection`; `exit.POST` always returns 303. The messages are Polish by default (`messages` option).

```tsx
import { LivePreviewRefresh } from '@cloud-house/next-content/live-preview'
// inside the preview bar; listens to `content:preview-refresh` from the panel
<LivePreviewRefresh adminOrigin={process.env.NEXT_PUBLIC_ADMIN_ORIGIN} />
```

## Lexical

```tsx
import { renderLexical } from '@cloud-house/next-content'
renderLexical(article.content, { link: (node, children) => <a href={...}>{children}</a>, blocks: { contact: () => <Contact /> } })
```

Saved editor state → JSX without the editor library. Unknown nodes render their children; a missing root renders nothing.
