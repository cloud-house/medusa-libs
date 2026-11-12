# @cloud-house/medusa-brands

## 0.1.1

### Patch Changes

- aec7ee9: Remove the plugin's `/brands/:id` admin page (a shop's own page at that path collided with it); the list shows a "details" button only with the new option `adminDetailLinks`, which `GET /admin/brands/messages` reports as `settings.detailLinks`. Neutral default texts (`adminDescription`, `handleHint` no longer name a storefront path). Fix option and event comments, `types` condition on the `./workflows` export.

## 0.1.0

### Minor Changes

- ad45e92: First release: the `brand` module with its product link, workflows (create, update, delete, set the product's brand) that emit `brand.*` events, admin page and product widget, `GET /store/brands` with product counts.

### Patch Changes

- Updated dependencies [ad45e92]
  - @cloud-house/commerce-rules@0.4.0
