# @cloud-house/next-commerce

## 0.2.0

### Minor Changes

- fc7f7d9: New entries `./account` (customer account client, forms, saved addresses, cart sync on sign-in, safe return path), `./favorites` (guest list in localStorage with a configurable key, sync with the account, Medusa calls) and `./returns` (return lookup and claim forms with an optional order prefix, label helpers, Medusa calls). `SavedAddress` now lives in `./account`; `./checkout` still exports it.

### Patch Changes

- Updated dependencies [fc7f7d9]
  - @cloud-house/commerce-rules@0.9.0

## 0.1.1

### Patch Changes

- 55d1d27: `addToCartFlow` also treats Medusa's 400 "already completed" as a stale cart (new cart, one retry) on the default `line-items` route; README: the default route is not atomic.

## 0.1.0

### Minor Changes

- 2a64b28: New package `@cloud-house/next-commerce` (part 1): cart client and view, checkout form with Polish validation, checkout flow and Medusa calls, Stripe adapter, order view and the newsletter sign-up core.
