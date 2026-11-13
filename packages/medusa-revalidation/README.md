# @cloud-house/medusa-revalidation

Storefront cache revalidation for Medusa 2 shops (Next.js `revalidateTag`). A library, not a Medusa plugin: it maps Medusa events to cache tags, POSTs them to the storefront webhook and gives you a subscriber factory.

```sh
pnpm add @cloud-house/medusa-revalidation
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc`. Peer: `@medusajs/framework`. Tags come from `@cloud-house/commerce-rules`.

## Exports

- `REVALIDATE_TIMEOUT_MS` – `10_000`
- `DEFAULT_REVALIDATION_EVENTS` – product, variant, category, inventory, reservation, pricing, promotion events plus `brand.created|updated|deleted` and `product-brand.updated` (matched by name only)
- `defaultTagsForEvent(name, data, lookup)` – tags for a default event (`catalog`, `product:<handle>`, `category:<handle>`, `brand:<handle>` and `brand:<previous_handle>`, `promotions`); `null` for any other event, `[]` for `product-brand.updated` without a brand change
- `TagLookup` – `{ productHandle(id), categoryHandle(id) }`
- `postRevalidate(tags, { url, secret, header = 'x-revalidate-secret', isAllowedTag = isKitTagAllowed, fetch, logger, logPrefix })` – POSTs `{ tags }` to `<url>/api/revalidate`; drops tags the allowlist rejects (logged), times out, never throws, returns `false` on failure
- `createRevalidationSubscriber({ events, tagsForEvent, urlEnv = 'STOREFRONT_URL', secretEnv = 'REVALIDATE_SECRET', header, isAllowedTag, logPrefix })` – returns `{ handler, config }`; warns once when the URL or secret is missing

## Subscriber

```ts
// src/subscribers/revalidate-storefront.ts
import { createTagRules, KIT_TAG_KINDS, KIT_TAGS } from '@cloud-house/commerce-rules'
import {
  createRevalidationSubscriber,
  DEFAULT_REVALIDATION_EVENTS,
  defaultTagsForEvent,
} from '@cloud-house/medusa-revalidation'

// 'pages' is outside the kit allowlist. Build the rules once and pass the SAME `isAllowedTag`
// here and to `createRevalidateRoute` in the storefront, or the tag is dropped / rejected.
const { isAllowedTag } = createTagRules({
  tags: [...Object.values(KIT_TAGS), 'pages'],
  kinds: [...KIT_TAG_KINDS],
})

const { handler, config: subscriberConfig } = createRevalidationSubscriber({
  events: [...DEFAULT_REVALIDATION_EVENTS, 'shop.page.changed'],
  tagsForEvent: async (name, data, lookup) =>
    (await defaultTagsForEvent(name, data, lookup)) ?? ['pages'],
  isAllowedTag,
  logPrefix: 'MyShop',
})

export default handler
export const config = subscriberConfig
```
