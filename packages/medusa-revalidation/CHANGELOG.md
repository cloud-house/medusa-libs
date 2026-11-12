# @cloud-house/medusa-revalidation

## 0.1.1

### Patch Changes

- 6d08ba8: `product.deleted` no longer emits the shop-specific `cms` tag (the default allowlist rejected it); shops add their own tags.

## 0.1.0

### Minor Changes

- 84f2505: Initial release: `DEFAULT_REVALIDATION_EVENTS`, `defaultTagsForEvent`, `postRevalidate` and `createRevalidationSubscriber`.
