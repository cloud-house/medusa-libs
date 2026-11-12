# @cloud-house/medusa-brands

Medusa 2 plugin: product brands. The `brand` module, a link from products to brands (a product has
at most one brand), workflows that emit `brand.*` events with handles, an admin page and a product
widget, and `GET /store/brands` with the number of published products per brand.

```sh
pnpm add --save-exact @cloud-house/medusa-brands@0.1.0
```

Requires `@cloud-house:registry=https://npm.pkg.github.com` in `.npmrc` (see the repo README).

## Setup

```ts
// medusa-config.ts
plugins: [
  {
    resolve: '@cloud-house/medusa-brands',
    options: {
      locale: 'pl', // 'pl' | 'en', default 'pl'
      messages: { saved: '…' }, // single texts over the dictionary
      storeRoute: true, // default; false: GET /store/brands answers 404
    },
  },
],
```

Then `medusa db:migrate` (module `brand`, table `brand`) and `medusa db:sync-links` (link table
`product_product_brand_brand`). Do not also list the module under `modules`: an entry there replaces
the plugin's module and its options. The admin menu label ("Marki") is fixed when the panel is built
and is not an option.

## API

| Route | |
|---|---|
| `GET /admin/brands` | `{ brands: [{ id, name, handle, product_count }], count }`, sorted by name |
| `POST /admin/brands` | `{ name, handle? }` (handle from the name when omitted) → `{ brand }` |
| `GET /admin/brands/:id` | `{ brand }` |
| `POST /admin/brands/:id` | `{ name?, handle? }` → `{ brand }` |
| `DELETE /admin/brands/:id` | `{ id, object: 'brand', deleted: true }`; clears the brand from its products |
| `GET /admin/products/:id/brand` | `{ brand: { id, name, handle } \| null }` |
| `POST /admin/products/:id/brand` | `{ brand_id: string \| null }` → `{ brand }` |
| `GET /admin/brands/messages` | `{ locale, messages }` for the admin pages |
| `GET /store/brands` | `{ brands: [{ id, handle, name, product_count }] }`; see below |

Error codes (`code` in the body, `BRAND_ERROR_CODES`): `brand_handle_taken` (422),
`brand_handle_invalid` (400), `brand_handle_underivable` (400), `brand_name_invalid` (400),
`brand_product_not_found` (404). An unknown brand id is Medusa's own 404.

### `GET /store/brands`

`product_count` is the number of the brand's products that are `published` and in a sales channel of
the request's publishable key. That is a plain count; a shop that counts only buyable products
(price, stock) writes its own route.

A route file of the shop at `src/api/store/brands/route.ts` **replaces** the plugin's route (the
shop's routes are loaded after the plugin's), so no option is needed. `storeRoute: false` is for a
shop that has no such route and wants none: the plugin's route hands the request on and the answer
is the 404 of an unknown path. To reuse the handler in your own route:

```ts
import { brandsStoreRoute } from '@cloud-house/medusa-brands'
export const GET = brandsStoreRoute
```

## Events

Medusa's generated `brand.*` events carry only the id; these carry handles (`BRAND_EVENTS`):

| Event | Data |
|---|---|
| `brand.created` | `{ id, handle }` |
| `brand.updated` | `{ id, handle, previous_handle? }` (`previous_handle` only when the handle changed) |
| `brand.deleted` | `{ id, handle }` |
| `product-brand.updated` | `{ product_id, brand_id, previous_brand_id }` (`null` for no brand) |

## Workflows

`createBrandWorkflow({ name, handle? })`, `updateBrandWorkflow({ id, name?, handle? })`,
`deleteBrandWorkflow({ id })`, `setProductBrandWorkflow({ product_id, brand_id })` (`null` clears).
Also under `@cloud-house/medusa-brands/workflows`.

## Exports

`BRAND_MODULE`, `BrandModuleService` (type; `getOptions()`), `BrandsOptions`, `resolveOptions`,
`messages`, `resolveMessages`, `BrandMessages`, `BRAND_EVENTS`, `BRAND_ERROR_CODES`,
`brandsStoreRoute`, the four workflows.

## License

MIT
