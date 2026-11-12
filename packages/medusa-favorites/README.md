# @cloud-house/medusa-favorites

Medusa 2 plugin: customer favourites. The `favorite` module (one row per customer and product), the
account routes under `/store/account/favorites` (list, add, remove, merge the browser's guest
list after sign-in) and a visibility filter: only products that are published and in a sales channel
of the request's publishable key are shown. Hidden products are not deleted – a product set to
draft for a while comes back. No admin panel.

```sh
pnpm add --save-exact @cloud-house/medusa-favorites@0.1.0
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README).

## Setup

```ts
// medusa-config.ts
plugins: [
  {
    resolve: '@cloud-house/medusa-favorites',
    options: {
      limit: 100, // most visible favourites per customer, default 100
      locale: 'pl', // 'pl' | 'en', default 'pl'
      messages: { productNotFound: '…', limitReached: '… {limit} …' }, // single texts over the dictionary
    },
  },
],
```

Then `medusa db:migrate` (module `favorite`, table `favorite`). Do not also list the module under
`modules`: an entry there replaces the plugin's module and its options.

## API

All routes need a signed-in customer (session or bearer token) and a publishable key.

| Route | |
|---|---|
| `GET /store/account/favorites` | `{ product_ids }` – visible products, newest first |
| `POST /store/account/favorites` | `{ product_id }` → `{ product_ids }`; a product already on the list stays where it is |
| `DELETE /store/account/favorites/:product_id` | `{ product_ids }`; removing a product that is not there changes nothing |
| `POST /store/account/favorites/merge` | `{ items: [{ product_id, added_at }] }` (up to 500, `added_at` an ISO datetime) → `{ product_ids, trimmed }` |

Merge: one entry per product, the newer date wins, dates from the future become now, newest first;
the oldest entries above `limit` are dropped (`trimmed: true`), products the shop does not show are
ignored. The limit counts only visible products; at the limit, hidden rows make room for a new one.

Error codes (`code` in the body, `FAVORITES_ERROR_CODES`):

| Code | Status | `type` | Default text (`pl`) |
|---|---|---|---|
| `product_not_found` | 404 | `not_found` | `Nie znaleziono produktu.` |
| `favorites_limit_reached` | 400 | `invalid_data` | `Masz już {limit} ulubionych – usuń któryś, żeby dodać nowy.` |

`{limit}` is replaced with the `limit` option. The Polish text for 100 is the one many shops
already compare word for word.

## Exports

```ts
import {
  FAVORITE_MODULE, // 'favorite'
  type FavoriteModuleService, // listForCustomer, addForCustomer, removeForCustomer, mergeForCustomer, pruneForCustomer, removeAllForCustomer, getOptions
  FAVORITES_ERROR_CODES,
  type FavoritesOptions,
  resolveOptions,
  messages,
  formatLimitMessage,
  mergeFavorites, // pure merge of two lists
  visibleProductIds, // (container, productIds, salesChannelIds) => Promise<string[]>
} from '@cloud-house/medusa-favorites'
```

`visibleProductIds` keeps the input order and drops duplicates, drafts, deleted products and
products outside the given sales channels – reuse it in your own routes (a shop's "which of these
products are still visible" endpoint).

Static, not options: the route paths and the 500-item merge limit.
